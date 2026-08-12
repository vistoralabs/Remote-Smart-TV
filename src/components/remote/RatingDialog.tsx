import { useState } from "react";
import { Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PLAY_STORE_URL } from "@/lib/native-review";
import type { StringKey } from "@/lib/i18n";

interface RatingDialogProps {
  open: boolean;
  onClose: () => void;
  onRate: (stars: number) => void;
  t: (key: StringKey) => string;
}

export function RatingDialog({ open, onClose, onRate, t }: RatingDialogProps) {
  const [selectedStars, setSelectedStars] = useState(5);
  const [hovered, setHovered] = useState(0);

  const activeStarCount = hovered > 0 ? hovered : selectedStars;

  const handleStarClick = (stars: number) => {
    setSelectedStars(stars);
    onRate(stars);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="mx-auto w-[92vw] max-w-sm rounded-3xl border border-border/60 bg-popover/95 p-0 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col items-center gap-5 px-6 pb-6 pt-7 text-popover-foreground">
          {/* Theme-aware App Name Badge */}
          <span className="rounded-full bg-primary/10 px-4 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
            Smart TV Remote
          </span>

          <DialogHeader className="items-center gap-1.5">
            <DialogTitle className="text-center font-display text-xl font-bold tracking-tight text-foreground">
              ⭐ {t("rateTitle")}
            </DialogTitle>
            <DialogDescription className="text-center text-xs leading-relaxed text-muted-foreground">
              {t("rateBody")}
            </DialogDescription>
          </DialogHeader>

          {/* Interactive 5 Stars */}
          <div className="flex items-center gap-2 py-1">
            {[1, 2, 3, 4, 5].map((star) => {
              const filled = star <= activeStarCount;
              return (
                <button
                  key={star}
                  type="button"
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  onPointerDown={() => setHovered(star)}
                  onClick={() => handleStarClick(star)}
                  className="group rounded-full p-1.5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  style={{
                    transform: filled ? "scale(1.15)" : "scale(1)",
                    transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
                  }}
                >
                  <Star
                    className="size-8 transition-colors duration-150"
                    fill={filled ? "#FACC15" : "transparent"}
                    stroke={filled ? "#FACC15" : "currentColor"}
                    strokeWidth={1.5}
                    style={{
                      color: filled ? "#FACC15" : "hsl(var(--muted-foreground) / 0.4)",
                      filter: filled ? "drop-shadow(0 0 6px rgba(250,204,21,0.4))" : "none",
                    }}
                  />
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex w-full flex-col gap-2 pt-1">
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                onRate(activeStarCount);
                onClose();
              }}
              className="glass-panel flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-center text-sm font-semibold text-primary-foreground shadow-md transition-all hover:opacity-95 active:scale-[0.98]"
            >
              <Star className="size-4 fill-current" />
              Rate on Google Play
            </a>

            <button
              type="button"
              onClick={onClose}
              className="h-10 w-full rounded-xl text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-[0.98]"
            >
              {t("maybeLater")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
