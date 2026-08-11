import { encode } from "./ir-protocols";
import type { CodeSet, IrKey } from "./ir-catalog";
import { Ir, isNativeRuntime, type IrCarrierRange } from "./ir-bridge";

export type { IrCarrierRange };

/** Gap between repeated frames, in microseconds. */
const FRAME_GAP = 40000;

/** Minimum spacing between transmits so rapid taps never flood the emitter. */
const MIN_GAP_MS = 120;

export interface LastIrSignal {
  frequency: number;
  items: number;
  frames: number;
  command?: string;
  brand?: string;
  codeSet?: string;
  kind?: string;
  ok?: boolean;
  error?: string;
}

let lastSignal: LastIrSignal | null = null;
let queue: Promise<unknown> = Promise.resolve();
let lastSentAt = 0;

export function lastIrSignal(): LastIrSignal | null {
  return lastSignal;
}

export async function irEmitterAvailable(): Promise<{ available: boolean; device: string }> {
  if (!isNativeRuntime()) return { available: false, device: "browser" };
  try {
    const result = await Ir.isAvailable();
    console.log(`[IR] emitter available: ${result.available}`);
    console.log(`[IR] device: ${result.device}`);
    return result;
  } catch {
    return { available: false, device: "unknown" };
  }
}

/** Carrier a code set will transmit on. */
export function carrierOf(set: CodeSet): number {
  const first = Object.values(set.codes)[0];
  if (first !== undefined && typeof first !== "number") return first.f;
  const sample = Object.values(set.codes).find((value) => typeof value === "number");
  if (typeof sample === "number") {
    return encode(set.protocol, set.device, set.subdevice, sample).frequency;
  }
  return 38000;
}

/**
 * Developer-only emitter check: sends one NEC-shaped burst at 38 kHz so the
 * hardware path can be verified without picking a brand first.
 */
export async function irSelfTest(): Promise<{ ok: boolean; message: string }> {
  if (!isNativeRuntime()) return { ok: false, message: "IR only works in the Android app" };
  const emitter = await irEmitterAvailable();
  if (!emitter.available) return { ok: false, message: `No IR emitter on ${emitter.device}` };
  const pattern = [9000, 4500];
  for (let i = 0; i < 16; i++) pattern.push(560, i % 2 === 0 ? 1690 : 560);
  pattern.push(560);
  lastSignal = { frequency: 38000, items: pattern.length, frames: 1, command: "SELF TEST" };
  try {
    console.log("[IR] transmit started (self test)");
    await Ir.transmit({ frequency: 38000, pattern });
    console.log("[IR] transmit completed");
    lastSignal = { ...lastSignal, ok: true };
    return { ok: true, message: "Test burst sent at 38 kHz" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "IR transmit failed";
    lastSignal = { frequency: 38000, items: pattern.length, frames: 1, ok: false, error: message };
    console.log(`[IR] transmit failed: ${message}`);
    return { ok: false, message };
  }
}

export async function irCarrierRanges(): Promise<IrCarrierRange[]> {
  if (!isNativeRuntime()) return [];
  try {
    const result = await Ir.getCarrierFrequencies();
    const ranges = result?.ranges ?? [];
    console.log(
      `[IR] supported carrier ranges: ${ranges.map((r) => `${r.min}-${r.max}`).join(", ") || "none"}`,
    );
    return ranges;
  } catch {
    return [];
  }
}

/**
 * Most appliances only act on a code they see more than once, so a burst is
 * repeated with a silent gap between frames. Raw AC captures already contain
 * their own full frame, so those are sent exactly once.
 */
function withRepeats(pattern: number[], frames: number): number[] {
  if (frames <= 1) return pattern;
  const out: number[] = [];
  for (let i = 0; i < frames; i++) {
    if (i > 0) out.push(FRAME_GAP);
    out.push(...pattern);
  }
  // ConsumerIrManager expects the pattern to start and end on a mark.
  if (out.length % 2 === 0) out.pop();
  return out;
}

/** Sends one key from a code set through the phone's IR blaster. */
export async function sendIrKey(
  codeSet: CodeSet,
  key: IrKey,
  options: { frames?: number; brand?: string; kind?: string } = {},
): Promise<{ ok: boolean; message: string }> {
  if (!isNativeRuntime()) {
    return { ok: false, message: "IR only works in the installed Android app" };
  }
  const signal = codeSet.codes[key];
  if (signal === undefined) {
    return { ok: false, message: "This remote has no code for that button" };
  }
  const raw = typeof signal === "number";
  const burst = raw
    ? encode(codeSet.protocol, codeSet.device, codeSet.subdevice, signal as number)
    : { frequency: (signal as { f: number }).f, pattern: (signal as { t: number[] }).t };
  // Short captures are single frames (TV, STB, audio) and need repeating; long
  // captures are stateful AC frames that must be sent exactly once.
  const frames = options.frames ?? (raw || burst.pattern.length <= 200 ? 3 : 1);
  const pattern = withRepeats(
    burst.pattern
      .filter((pulse) => Number.isFinite(pulse) && pulse > 0)
      .map((pulse) => Math.round(pulse)),
    frames,
  );
  if (!pattern.length) {
    return { ok: false, message: "This IR code is empty" };
  }
  const meta = {
    frequency: burst.frequency,
    items: pattern.length,
    frames,
    command: key.toUpperCase(),
    ...(options.brand ? { brand: options.brand } : {}),
    ...(options.kind ? { kind: options.kind } : {}),
    codeSet: codeSet.label,
  };

  // Serialise transmits: a rapid tap never overlaps the previous burst.
  const run = queue.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastSentAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastSignal = meta;
    try {
      if (options.kind) console.log(`[IR] device type: ${options.kind}`);
      if (options.brand) console.log(`[IR] brand: ${options.brand}`);
      console.log(`[IR] code set: ${codeSet.label} (${codeSet.protocol})`);
      console.log(`[IR] command: ${key}`);
      console.log(`[IR] selected carrier: ${burst.frequency}`);
      console.log(`[IR] pattern length: ${pattern.length}`);
      console.log("[IR] transmit started");
      await Ir.transmit({ frequency: burst.frequency, pattern });
      console.log("[IR] transmit completed");
      lastSentAt = Date.now();
      lastSignal = { ...meta, ok: true };
      return { ok: true, message: "IR sent" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "IR transmit failed";
      lastSentAt = Date.now();
      lastSignal = { ...meta, ok: false, error: message };
      console.log(`[IR] transmit failed: ${message}`);
      return { ok: false, message };
    }
  });
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Transmits a fully built pattern (stateful AC frames, self tests) while
 * reusing the same queue, spacing and diagnostics as keyed commands.
 */
export async function sendIrPattern(
  frequency: number,
  pattern: number[],
  meta: { command: string; brand?: string; kind?: string; codeSet?: string } = { command: "raw" },
): Promise<{ ok: boolean; message: string }> {
  if (!isNativeRuntime()) {
    return { ok: false, message: "IR only works in the installed Android app" };
  }
  const clean = pattern
    .filter((pulse) => Number.isFinite(pulse) && pulse > 0)
    .map((pulse) => Math.round(pulse));
  if (!clean.length) return { ok: false, message: "This IR frame is empty" };
  const info: LastIrSignal = { frequency, items: clean.length, frames: 1, ...meta };
  const run = queue.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastSentAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastSignal = info;
    try {
      console.log(`[IR] command: ${meta.command}`);
      console.log(`[IR] selected carrier: ${frequency}`);
      console.log(`[IR] pattern length: ${clean.length}`);
      console.log("[IR] transmit started");
      await Ir.transmit({ frequency, pattern: clean });
      console.log("[IR] transmit completed");
      lastSentAt = Date.now();
      lastSignal = { ...info, ok: true };
      return { ok: true, message: "IR sent" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "IR transmit failed";
      lastSentAt = Date.now();
      lastSignal = { ...info, ok: false, error: message };
      console.log(`[IR] transmit failed: ${message}`);
      return { ok: false, message };
    }
  });
  queue = run.catch(() => undefined);
  return run;
}
