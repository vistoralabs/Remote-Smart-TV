import { useRef } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Key } from "@/lib/remote-types";
import type { PadTheme } from "@/lib/settings";
import { RemoteKey } from "./RemoteKey";

interface PadProps {
  theme: PadTheme;
  onKey: (key: Key) => void;
  disabled?: boolean;
}

export function PadSurface({ theme, onKey, disabled = false }: PadProps) {
  if (theme === "touch") return <TouchPad onKey={onKey} disabled={disabled} />;
  if (theme === "cross") return <CrossPad onKey={onKey} disabled={disabled} />;
  if (theme === "compact") return <CompactPad onKey={onKey} disabled={disabled} />;
  return <RingPad onKey={onKey} disabled={disabled} />;
}

function Arrows({
  onKey,
  round,
  disabled,
  isRing = false,
}: {
  onKey: (key: Key) => void;
  round: boolean;
  disabled: boolean;
  isRing?: boolean;
}) {
  const btnSize = isRing ? "size-11 min-h-0 min-w-0 p-0" : "size-full max-h-14 max-w-14";
  const okSize = isRing ? "size-12 min-h-0 min-w-0 p-0 font-bold" : "size-full max-h-14 max-w-14 font-semibold";

  return (
    <>
      <span />
      <RemoteKey
        ariaLabel="Up"
        onPress={() => onKey("up")}
        round={round}
        disabled={disabled}
        className={cn("place-self-center shadow-sm", btnSize)}
      >
        <ChevronUp className="size-5 shrink-0" />
      </RemoteKey>
      <span />
      <RemoteKey
        ariaLabel="Left"
        onPress={() => onKey("left")}
        round={round}
        disabled={disabled}
        className={cn("place-self-center shadow-sm", btnSize)}
      >
        <ChevronLeft className="size-5 shrink-0" />
      </RemoteKey>
      <RemoteKey
        ariaLabel="OK"
        onPress={() => onKey("ok")}
        round={round}
        disabled={disabled}
        tone="primary"
        className={cn("place-self-center font-display text-xs tracking-wider shadow-md", okSize)}
      >
        OK
      </RemoteKey>
      <RemoteKey
        ariaLabel="Right"
        onPress={() => onKey("right")}
        round={round}
        disabled={disabled}
        className={cn("place-self-center shadow-sm", btnSize)}
      >
        <ChevronRight className="size-5 shrink-0" />
      </RemoteKey>
      <span />
      <RemoteKey
        ariaLabel="Down"
        onPress={() => onKey("down")}
        round={round}
        disabled={disabled}
        className={cn("place-self-center shadow-sm", btnSize)}
      >
        <ChevronDown className="size-5 shrink-0" />
      </RemoteKey>
      <span />
    </>
  );
}

function RingPad({ onKey, disabled }: { onKey: (key: Key) => void; disabled: boolean }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[clamp(140px,40vw,175px)]">
      {/* Background D-Pad Outer Ring */}
      <div className="absolute inset-0 rounded-full border border-border/80 shell-panel shadow-inner" />
      {/* Centered Grid with Padding so buttons stay strictly inside the circle */}
      <div className="absolute inset-3 grid grid-cols-3 grid-rows-3 place-items-center gap-1">
        <Arrows onKey={onKey} round disabled={disabled} isRing />
      </div>
    </div>
  );
}

function CrossPad({ onKey, disabled }: { onKey: (key: Key) => void; disabled: boolean }) {
  return (
    <div className="mx-auto aspect-square w-full max-w-[clamp(140px,40vw,175px)] rounded-3xl border border-border/70 shell-panel p-3">
      <div className="grid h-full grid-cols-3 grid-rows-3 place-items-center gap-1.5">
        <Arrows onKey={onKey} round={false} disabled={disabled} />
      </div>
    </div>
  );
}

function CompactPad({ onKey, disabled }: { onKey: (key: Key) => void; disabled: boolean }) {
  return (
    <div className="mx-auto aspect-square w-full max-w-[clamp(140px,40vw,175px)] p-1">
      <div className="grid h-full grid-cols-3 grid-rows-3 place-items-center gap-2 [&>button]:size-full">
        <Arrows onKey={onKey} round={false} disabled={disabled} />
      </div>
    </div>
  );
}

function TouchPad({ onKey, disabled }: { onKey: (key: Key) => void; disabled: boolean }) {
  const start = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      role="application"
      aria-label="Touch pad — swipe to navigate, tap to select"
      onPointerDown={(event) => {
        if (disabled) return;
        start.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        const from = start.current;
        start.current = null;
        if (!from) return;
        const dx = event.clientX - from.x;
        const dy = event.clientY - from.y;
        const threshold = 26;
        if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
          onKey("ok");
          return;
        }
        if (Math.abs(dx) > Math.abs(dy)) onKey(dx > 0 ? "right" : "left");
        else onKey(dy > 0 ? "down" : "up");
      }}
      className={cn(
        "shell-panel mx-auto flex aspect-square w-full max-w-[15rem] touch-none select-none",
        "items-center justify-center rounded-3xl border border-border/70 text-center",
        disabled && "opacity-45",
      )}
    >
      <span className="px-6 text-xs leading-relaxed text-muted-foreground">
        Swipe to move
        <br />
        Tap to select
      </span>
    </div>
  );
}
