import { useCallback, useState } from "react";
import { Loader2, Mic } from "lucide-react";
import { toast } from "sonner";
import { RemoteKey } from "@/components/remote/RemoteKey";
import { nativeSpeech, speechAvailable } from "@/lib/native-speech";
import { sendKey, sendText } from "@/lib/transports";
import type { Device } from "@/lib/remote-types";

/**
 * Voice search that uses the PHONE's microphone: Android speech recognition
 * turns speech into text, then the text is injected on the TV over the already
 * authenticated remote session. Falls back to the TV's own voice key when the
 * phone has no recognizer (e.g. running in a browser).
 */
export function VoiceKey({
  device,
  connected,
  label,
  className,
}: {
  device: Device | null;
  connected: boolean;
  label: string;
  className?: string;
}) {
  const [listening, setListening] = useState(false);

  const run = useCallback(async () => {
    if (!connected) {
      toast.error("Not connected — select and connect your TV first");
      return;
    }
    if (!speechAvailable()) {
      const result = await sendKey(device, "voice");
      if (!result.ok) toast.error(result.message);
      else toast.info("Voice search opened on the TV — phone mic needs the installed app");
      return;
    }
    setListening(true);
    toast.info("Listening… speak now");
    try {
      const { text } = await nativeSpeech.listen({});
      const spoken = text?.trim() ?? "";
      if (!spoken) {
        toast.info("Nothing was heard — try again");
        return;
      }
      const sent = await sendText(device, spoken);
      if (sent.ok) toast.success(`Searching “${spoken}”`);
      else toast.error(sent.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Voice input failed");
    } finally {
      setListening(false);
    }
  }, [connected, device]);

  return (
    <RemoteKey
      ariaLabel={label}
      onPress={() => void run()}
      disabled={!connected || listening}
      tone={listening ? "primary" : "default"}
      className={className ?? ""}
    >
      {listening ? <Loader2 className="size-5 animate-spin" /> : <Mic className="size-5" />}
    </RemoteKey>
  );
}
