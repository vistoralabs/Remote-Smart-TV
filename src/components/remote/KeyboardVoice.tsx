import { useCallback, useState } from "react";
import { CornerDownLeft, Delete, Keyboard, Loader2, Mic, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nativeSpeech, speechAvailable } from "@/lib/native-speech";
import { sendKey, sendText } from "@/lib/transports";
import type { Device } from "@/lib/remote-types";

/**
 * Real Android TV Remote v2 text input. Everything typed here is injected on the
 * box through the already-authenticated 6466 remote session — no local-only
 * field, and no need to open a keyboard on the TV first.
 */
export function KeyboardVoice({
  device,
  connected,
  haptics,
}: {
  device: Device | null;
  connected: boolean;
  haptics: boolean;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);

  const buzz = useCallback(() => {
    if (haptics && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(12);
  }, [haptics]);

  const submit = useCallback(
    async (text: string) => {
      if (!text.trim() || !connected) return;
      console.log("[INPUT] sending text:", text);
      buzz();
      setBusy(true);
      const result = await sendText(device, text);
      setBusy(false);
      if (result.ok) {
        console.log("[INPUT] text sent successfully:", text);
        toast.success(`Typed on ${device?.name ?? "device"}`);
        setValue("");
      } else {
        console.log("[INPUT] input error:", result.message);
        toast.error(result.message);
      }
    },
    [buzz, connected, device],
  );

  const edit = useCallback(
    async (key: "backspace" | "enter") => {
      if (!connected) return;
      console.log("[INPUT] text message encoded:", key);
      buzz();
      const result = await sendKey(device, key);
      if (result.ok) console.log("[INPUT] text sent successfully:", key);
      else {
        console.log("[INPUT] input error:", result.message);
        toast.error(result.message);
      }
      if (key === "backspace") setValue((current) => current.slice(0, -1));
      if (key === "enter") setValue("");
    },
    [buzz, connected, device],
  );

  const listen = useCallback(async () => {
    if (!speechAvailable()) {
      toast.error("Voice search needs the installed Android app");
      return;
    }
    setListening(true);
    try {
      const { text } = await nativeSpeech.listen({});
      setValue(text);
      if (text) await submit(text);
      else toast.info("Nothing was heard — try again");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Voice input failed";
      console.log("[INPUT] input error:", message);
      toast.error(message);
    } finally {
      setListening(false);
    }
  }, [submit]);

  return (
    <div className="glass-panel flex flex-col gap-2 rounded-2xl p-3">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Keyboard className="size-4" /> Keyboard &amp; voice
      </p>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(event) => {
            console.log("[INPUT] text changed:", event.target.value);
            setValue(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit(value);
          }}
          disabled={!connected}
          placeholder={connected ? "Type to search on the TV" : "Not connected"}
          className="bg-input text-foreground placeholder:text-muted-foreground"
          aria-label="Text to send to the device"
        />
        <Button
          size="icon"
          aria-label="Send text"
          onClick={() => void submit(value)}
          disabled={busy || !value.trim() || !connected}
          className="transition-transform active:scale-95"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
        <Button
          size="icon"
          variant={listening ? "destructive" : "secondary"}
          aria-label="Voice search"
          onClick={listen}
          disabled={listening || !connected}
          className="transition-transform active:scale-95"
        >
          {listening ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
        </Button>
      </div>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="h-9 flex-1 gap-2 text-xs"
          aria-label="Backspace on TV"
          disabled={!connected}
          onClick={() => void edit("backspace")}
        >
          <Delete className="size-4" /> Backspace
        </Button>
        <Button
          variant="secondary"
          className="h-9 flex-1 gap-2 text-xs"
          aria-label="Enter on TV"
          disabled={!connected}
          onClick={() => void edit("enter")}
        >
          <CornerDownLeft className="size-4" /> Enter
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {listening
          ? "Listening… speak now"
          : connected
            ? "Typing goes straight to the TV's focused field."
            : "Connect your TV to type or speak."}
      </p>
    </div>
  );
}
