import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Web-side bridge for the native Google Mobile Ads plugin.
 *
 * App Open ads on genuine launches / foreground returns and interstitials at
 * natural break points. Banner ads are intentionally disabled to preserve the
 * approved full-screen v3.0 remote layout.
 */
interface AdsPlugin {
  initialize(): Promise<{ ready: boolean; testAds?: boolean }>;
  showBanner(): Promise<{ height: number }>;
  hideBanner(): Promise<void>;
  preload(): Promise<void>;
  showInterstitial(options?: { force?: boolean }): Promise<{ shown: boolean }>;
  maybeShowAppOpen(): Promise<void>;
  setCriticalFlow(options: { active: boolean }): Promise<void>;
  status(): Promise<{
    sdkInitialized: boolean;
    testAds: boolean;
    interstitialReady: boolean;
    appOpenReady: boolean;
    criticalFlow: boolean;
    log: string;
  }>;
  addListener(
    event: "bannerHeight",
    handler: (data: { height: number }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

const Ads = registerPlugin<AdsPlugin>("Ads");

export function hasNativeAds(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Ads");
}

let started = false;

/** Boot the SDK and load banner + full-screen ads. */
export async function startAds(): Promise<void> {
  if (!hasNativeAds()) return;
  if (started) return;
  started = true;
  try {
    await Ads.initialize();
    void Ads.showBanner().then((res) => {
      if (res?.height) {
        document.documentElement.style.setProperty("--ad-banner-height", `${res.height}px`);
      }
    });
    void Ads.preload();
    // Genuine launch: App Open ad when one is available.
    void Ads.maybeShowAppOpen();
  } catch {
    /* ads unavailable — app keeps working */
  }
}

/**
 * Ask for an interstitial at a natural break in the flow. Native side enforces
 * the cooldown and the "never two in a row" rule, and returns immediately when
 * nothing is loaded.
 */
export async function showInterstitialAtBreak(force = false): Promise<boolean> {
  if (!hasNativeAds()) return false;
  try {
    const { shown } = await Ads.showInterstitial({ force });
    return shown;
  } catch {
    return false;
  }
}

/**
 * Full-screen ad for a key transition such as a TV that just connected. The
 * cool-down is skipped and, when nothing is cached yet, the request is retried
 * a couple of times while the ad finishes loading.
 */
export async function showInterstitialOnTransition(): Promise<boolean> {
  if (!hasNativeAds()) return false;
  for (const delay of [400, 1800, 3500]) {
    await new Promise((resolve) => window.setTimeout(resolve, delay));
    if (await showInterstitialAtBreak(true)) return true;
  }
  return false;
}

/** Suppress full-screen ads while discovery, pairing or permissions are running. */
export async function setAdCriticalFlow(active: boolean): Promise<void> {
  if (!hasNativeAds()) return;
  try {
    await Ads.setCriticalFlow({ active });
  } catch {
    /* ignore */
  }
}

/** Native ad diagnostics for the debug sheet (why an ad did or did not show). */
export async function adsStatus(): Promise<string> {
  if (!hasNativeAds()) return "Native ads bridge: unavailable (web preview)";
  try {
    const info = await Ads.status();
    return [
      `SDK initialized: ${info.sdkInitialized}`,
      `Test ads: ${info.testAds}`,
      `Interstitial cached: ${info.interstitialReady}`,
      `App open cached: ${info.appOpenReady}`,
      `Critical flow (ads suppressed): ${info.criticalFlow}`,
      "",
      "Ad log:",
      info.log?.trim() || "no ad events yet",
    ].join("\n");
  } catch (error) {
    return `Ads status failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}
