import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Key feedback (vibration + click sound).
 *
 * Native plugin first — inside a Capacitor WebView `navigator.vibrate` is often
 * ignored and there is no system key click at all. Browser fallbacks keep the
 * preview honest.
 */
interface FeedbackPlugin {
  vibrate(options: { ms: number }): Promise<{ ok: boolean }>;
  click(): Promise<{ ok: boolean }>;
}

const Feedback = registerPlugin<FeedbackPlugin>("Feedback");

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

let audioCtx: AudioContext | null = null;

function webClick(): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioCtx ??= new Ctor();
    void audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.value = 1650;
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.05);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.06);
  } catch {
    /* audio unavailable */
  }
}

function webVibrate(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* vibration unavailable */
  }
}

/** Fires haptics and/or the key click for one press. Never throws. */
export function keyFeedback(opts: { haptics: boolean; sound: boolean; ms?: number }): void {
  const ms = opts.ms ?? 18;
  if (opts.haptics) {
    if (isNative()) {
      void Feedback.vibrate({ ms }).catch(() => webVibrate(ms));
    } else {
      webVibrate(ms);
    }
  }
  if (opts.sound) {
    if (isNative()) {
      void Feedback.click().catch(() => webClick());
    } else {
      webClick();
    }
  }
}

/** Preview of the setting the moment the user flips its switch. */
export function previewHaptics(): void {
  keyFeedback({ haptics: true, sound: false, ms: 24 });
}

export function previewSound(): void {
  keyFeedback({ haptics: false, sound: true });
}
