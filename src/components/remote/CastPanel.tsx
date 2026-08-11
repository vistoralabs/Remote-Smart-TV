import { useState } from "react";
import { Cast, Link2, Music4, Image as ImageIcon, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Device } from "@/lib/remote-types";
import { castMedia, type MediaKind } from "@/lib/transports";
import { toast } from "sonner";
import type { StringKey } from "@/lib/i18n";

const KINDS: { kind: MediaKind; label: string; icon: typeof Cast }[] = [
  { kind: "video", label: "Video", icon: Cast },
  { kind: "audio", label: "Music", icon: Music4 },
  { kind: "photo", label: "Photo", icon: ImageIcon },
];

export function CastPanel({ device, t }: { device: Device | null; t: (key: StringKey) => string }) {
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<MediaKind>("video");
  const [busy, setBusy] = useState(false);

  async function play() {
    if (!url.trim()) {
      toast.error("Paste a media link first");
      return;
    }
    setBusy(true);
    const result = await castMedia(device, url.trim(), kind);
    setBusy(false);
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  }

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="font-display text-lg font-semibold">{t("castTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("castHint")}</p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        {KINDS.map(({ kind: k, label, icon: Icon }) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`shell-panel flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-medium transition-colors ${
              kind === k
                ? "border-primary/60 text-primary"
                : "border-border/60 text-muted-foreground"
            }`}
          >
            <Icon className="size-5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="relative">
          <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://…/video.mp4"
            inputMode="url"
            className="pl-9"
          />
        </div>
        <Button onClick={play} disabled={busy} className="w-full">
          <Cast className="size-4" />
          {busy ? "Sending…" : "Play on TV"}
        </Button>
      </div>

      <button
        type="button"
        onClick={async () => {
          const result = await castMedia(device, "youtube", "video");
          if (result.ok) toast.success(result.message);
          else toast.error(result.message);
        }}
        className="shell-panel flex items-center gap-3 rounded-2xl border border-border/60 px-4 py-3 text-left"
      >
        <Youtube className="size-5 text-primary" />
        <span className="text-sm font-medium">Open YouTube on TV</span>
      </button>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Casting uses the TV&apos;s own media player. Roku and TCL Roku TVs accept direct links
        today; Fire TV, Android TV and Vizio play through their app launcher.
      </p>
    </section>
  );
}
