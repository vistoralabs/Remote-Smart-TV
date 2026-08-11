import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Key } from "@/lib/remote-types";
import { RemoteKey } from "./RemoteKey";

export function DPad({ onKey }: { onKey: (key: Key) => void }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[15rem]">
      <div className="absolute inset-0 rounded-full border border-border/70 shell-panel" />
      <div className="absolute inset-3 grid grid-cols-3 grid-rows-3 gap-2">
        <span />
        <RemoteKey ariaLabel="Up" onPress={() => onKey("up")} round className="rounded-t-full">
          <ChevronUp className="size-6" />
        </RemoteKey>
        <span />
        <RemoteKey ariaLabel="Left" onPress={() => onKey("left")} round>
          <ChevronLeft className="size-6" />
        </RemoteKey>
        <RemoteKey
          ariaLabel="OK"
          onPress={() => onKey("ok")}
          round
          tone="primary"
          className={cn("font-display text-sm font-semibold tracking-widest")}
        >
          OK
        </RemoteKey>
        <RemoteKey ariaLabel="Right" onPress={() => onKey("right")} round>
          <ChevronRight className="size-6" />
        </RemoteKey>
        <span />
        <RemoteKey ariaLabel="Down" onPress={() => onKey("down")} round>
          <ChevronDown className="size-6" />
        </RemoteKey>
        <span />
      </div>
    </div>
  );
}
