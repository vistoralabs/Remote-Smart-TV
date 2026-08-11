import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Google Play In-App Review — official API only.
 *
 * There is no custom star popup any more: Play owns the whole rating UI. Our
 * job is only to decide *when* the app is allowed to ask, and to leave a clear
 * [REVIEW] trail so the decision can be inspected from the diagnostics screen.
 */
interface ReviewNativePlugin {
  requestReview(): Promise<{ launched: boolean; openedStore?: boolean; reason?: string }>;
  openStore(): Promise<{ openedStore: boolean }>;
  status(): Promise<{ debug: boolean; playAvailable: boolean; lastReason?: string }>;
}

const Review = registerPlugin<ReviewNativePlugin>("Review");

export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=app.remote.universal";

/* ------------------------------------------------------------------ */
/* Eligibility rules                                                   */
/* ------------------------------------------------------------------ */

/** Commands the user must have sent in this session. */
const MIN_COMMANDS = 3;
/** App sessions before the sheet may be requested at all. */
const MIN_SESSIONS = 2;
/** Wait after a successful request before ever asking again. */
const COOLDOWN_DAYS = 90;
/** Never ask within this many ms of an ad being shown. */
const AD_QUIET_MS = 20_000;

const SESSIONS_KEY = "review.sessions";
const REQUESTED_KEY = "review.requestedAt";
const COMPLETED_KEY = "review.completed";

export interface ReviewSnapshot {
  sessions: number;
  commands: number;
  connected: boolean;
  remoteActive: boolean;
  foreground: boolean;
  adQuiet: boolean;
  completed: boolean;
  cooldownOver: boolean;
  eligible: boolean;
  blockedBy: string;
  lastAction: string;
  lastNativeReason: string;
}

const state = {
  commands: 0,
  connected: false,
  lastCommandAt: 0,
  lastAdAt: 0,
  lastAction: "idle",
  lastNativeReason: "",
  requesting: false,
};

const LOG: string[] = [];

function log(message: string): void {
  const line = `[REVIEW] ${new Date().toISOString().slice(11, 19)} ${message}`;
  LOG.push(line);
  if (LOG.length > 60) LOG.shift();
  // Visible in `adb logcat` through the WebView console bridge.
  console.log(line);
}

export function reviewLog(): string[] {
  return [...LOG];
}

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function readNumber(key: string, fallback = 0): number {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? Number(raw) || fallback : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

/* ------------------------------------------------------------------ */
/* Signals fed in by the app                                           */
/* ------------------------------------------------------------------ */

/** Call once when the app boots. */
export function noteSessionStart(): void {
  const sessions = readNumber(SESSIONS_KEY) + 1;
  write(SESSIONS_KEY, String(sessions));
  state.commands = 0;
  log(`session start (total ${sessions})`);
}

/** Call after every successfully delivered remote command. */
export function noteCommand(): void {
  state.commands += 1;
  state.lastCommandAt = Date.now();
}

/** Call whenever the TV connection state changes. */
export function noteConnection(connected: boolean): void {
  state.connected = connected;
  if (!connected) state.commands = 0;
}

/** Call right before/after any full-screen ad so we never collide with it. */
export function noteAdShown(): void {
  state.lastAdAt = Date.now();
}

/* ------------------------------------------------------------------ */
/* Decision                                                           */
/* ------------------------------------------------------------------ */

function foreground(): boolean {
  try {
    return document.visibilityState === "visible";
  } catch {
    return true;
  }
}

function cooldownOver(): boolean {
  const at = readNumber(REQUESTED_KEY);
  if (!at) return true;
  return Date.now() - at > COOLDOWN_DAYS * 86_400_000;
}

/** Remote session is "active" when a command landed in the last two minutes. */
function remoteActive(): boolean {
  return state.lastCommandAt > 0 && Date.now() - state.lastCommandAt < 120_000;
}

export function reviewSnapshot(): ReviewSnapshot {
  const sessions = readNumber(SESSIONS_KEY);
  const completed = readNumber(COMPLETED_KEY) === 1;
  const adQuiet = Date.now() - state.lastAdAt > AD_QUIET_MS;
  const checks: [string, boolean][] = [
    ["native runtime", isNative()],
    ["already completed", !completed],
    ["cooldown", cooldownOver()],
    [`sessions >= ${MIN_SESSIONS}`, sessions >= MIN_SESSIONS],
    ["tv connected", state.connected],
    [`commands >= ${MIN_COMMANDS}`, state.commands >= MIN_COMMANDS],
    ["remote session active", remoteActive()],
    ["app in foreground", foreground()],
    ["no recent ad", adQuiet],
  ];
  const failed = checks.find(([, ok]) => !ok);
  return {
    sessions,
    commands: state.commands,
    connected: state.connected,
    remoteActive: remoteActive(),
    foreground: foreground(),
    adQuiet,
    completed,
    cooldownOver: cooldownOver(),
    eligible: !failed,
    blockedBy: failed ? failed[0] : "",
    lastAction: state.lastAction,
    lastNativeReason: state.lastNativeReason,
  };
}

/**
 * Ask Play for the review sheet when every rule passes. Safe to call often —
 * it is a no-op (with a logged reason) whenever the app is not eligible.
 */
export async function maybeRequestReview(trigger: string): Promise<boolean> {
  if (state.requesting) return false;
  const snapshot = reviewSnapshot();
  if (!snapshot.eligible) {
    log(`skip (${trigger}) blocked by: ${snapshot.blockedBy}`);
    return false;
  }
  return requestReviewNow(trigger);
}

/**
 * Fire the official flow immediately, bypassing eligibility. Used by the
 * developer-only test button and by explicit user taps.
 */
export async function requestReviewNow(trigger = "manual"): Promise<boolean> {
  if (!isNative()) {
    log(`request (${trigger}) unavailable: not a native build`);
    state.lastAction = "unavailable (browser)";
    return false;
  }
  state.requesting = true;
  log(`requesting flow (${trigger})`);
  write(REQUESTED_KEY, String(Date.now()));
  try {
    const result = await Review.requestReview();
    state.lastNativeReason = result?.reason ?? "";
    if (result?.launched) {
      write(COMPLETED_KEY, "1");
      state.lastAction = "sheet shown";
      log(`flow completed (native reason: ${state.lastNativeReason || "ok"})`);
      return true;
    }
    state.lastAction = `not shown (${state.lastNativeReason || "play suppressed"})`;
    log(`flow not shown: ${state.lastNativeReason || "play suppressed"}`);
    return false;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.lastAction = `error: ${message}`;
    log(`flow error: ${message}`);
    return false;
  } finally {
    state.requesting = false;
  }
}

/** Explicit "Rate this app" tap: send the user to the Play listing. */
export async function openStoreListing(): Promise<boolean> {
  log("opening Play listing (explicit tap)");
  if (isNative()) {
    try {
      const result = await Review.openStore();
      if (result?.openedStore) return true;
    } catch {
      /* fall through to the web link */
    }
  }
  try {
    window.location.href = PLAY_STORE_URL;
    return true;
  } catch {
    return false;
  }
}

/** Native-side facts for the diagnostics screen. */
export async function reviewNativeStatus(): Promise<{
  debug: boolean;
  playAvailable: boolean;
  lastReason: string;
}> {
  if (!isNative()) return { debug: false, playAvailable: false, lastReason: "browser" };
  try {
    const status = await Review.status();
    return {
      debug: Boolean(status?.debug),
      playAvailable: Boolean(status?.playAvailable),
      lastReason: status?.lastReason ?? "",
    };
  } catch (error) {
    return {
      debug: false,
      playAvailable: false,
      lastReason: error instanceof Error ? error.message : "status failed",
    };
  }
}
