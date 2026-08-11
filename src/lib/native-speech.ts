import { registerPlugin, Capacitor } from "@capacitor/core";

interface NativeSpeechPlugin {
  available(): Promise<{ available: boolean; granted: boolean }>;
  listen(options?: { lang?: string }): Promise<{ text: string }>;
  cancel(): Promise<void>;
  addListener(
    event: "voiceState",
    handler: (payload: { state: "listening" | "processing" | "done" | "failed" }) => void,
  ): Promise<{ remove: () => void }>;
}

const plugin = registerPlugin<NativeSpeechPlugin>("NativeSpeech");

export const speechAvailable = () =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("NativeSpeech");

export const nativeSpeech = plugin;
