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
}: {
  onKey: (key: Key) => void;
  round: boolean;
  disabled: boolean;
}) {
  return (
    <>
      <span />
      <RemoteKey
        ariaLabel="Up"
        onPress={() => onKey("up")}
        round={round}
        disabled={disabled}
        className="size-full max-h-14 max-w-14 place-self-center"
      >
        <ChevronUp className="size-6 shrink-0" />
      </RemoteKey>
      <span />
      <RemoteKey
        ariaLabel="Left"
        onPress={() => onKey("left")}
        round={round}
        disabled={disabled}
        className="size-full max-h-14 max-w-14 place-self-center"
      >
        <ChevronLeft className="size-6 shrink-0" />
      </RemoteKey>
      <RemoteKey
        ariaLabel="OK"
        onPress={() => onKey("ok")}
        round={round}
        disabled={disabled}
        tone="primary"
        className="size-full max-h-14 max-w-14 place-self-center font-display text-sm font-semibold tracking-widest"
      >
        OK
      </RemoteKey>
      <RemoteKey
        ariaLabel="Right"
        onPress={() => onKey("right")}
        round={round}
        disabled={disabled}
        className="size-full max-h-14 max-w-14 place-self-center"
      >
        <ChevronRight className="size-6 shrink-0" />
      </RemoteKey>
      <span />
      <RemoteKey
        ariaLabel="Down"
        onPress={() => onKey("down")}
        round={round}
        disabled={disabled}
        className="size-full max-h-14 max-w-14 place-self-center"
      >
        <ChevronDown className="size-6 shrink-0" />
      </RemoteKey>
      <span />
    </>
  );
}

function RingPad({ onKey, disabled }: { onKey: (key: Key) => void; disabled: boolean }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[15rem]">
      <div className="absolute inset-0 rounded-full border border-border/70 shell-panel" />
      <div className="absolute inset-2 grid h-[calc(100%-1rem)] w-[calc(100%-1rem)] grid-cols-3 grid-rows-3 place-items-center gap-1">
        <Arrows onKey={onKey} round disabled={disabled} />
      </div>
    </div>
  );
}

function CrossPad({ onKey, disabled }: { onKey: (key: Key) => void; disabled: boolean }) {
  return (
    <div className="mx-auto aspect-square w-full max-w-[15rem] rounded-3xl border border-border/70 shell-panel p-3">
      <div className="grid h-full grid-cols-3 grid-rows-3 place-items-center gap-1.5">
        <Arrows onKey={onKey} round={false} disabled={disabled} />
      </div>
    </div>
  );
}

function CompactPad({ onKey, disabled }: { onKey: (key: Key) => void; disabled: boolean }) {
  return (
    <div className="mx-auto aspect-square w-full max-w-[15rem] p-1">
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
