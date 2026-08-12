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
      <DialogContent
        className="mx-auto w-[92vw] max-w-sm rounded-3xl p-0 shadow-2xl transition-all border"
        style={{
          backgroundColor: "var(--card, #1a1d23)",
          borderColor: "color-mix(in srgb, var(--border, #2c3038) 80%, transparent)",
          color: "var(--card-foreground, #f4f5f7)",
          boxShadow: "0 20px 60px -15px rgba(0, 0, 0, 0.7)",
        }}
      >
        <div className="flex flex-col items-center gap-5 px-6 pb-6 pt-7">
          {/* Theme-aware App Name Badge */}
          <span
            className="rounded-full px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.2em] border"
            style={{
              backgroundColor: "color-mix(in srgb, var(--primary, #f0a93f) 16%, transparent)",
              color: "var(--primary, #f0a93f)",
              borderColor: "color-mix(in srgb, var(--primary, #f0a93f) 35%, transparent)",
            }}
          >
            Smart TV Remote
          </span>

          <DialogHeader className="items-center gap-1.5">
            <DialogTitle
              className="text-center font-display text-xl font-bold tracking-tight"
              style={{ color: "var(--foreground, #f4f5f7)" }}
            >
              ⭐ {t("rateTitle")}
            </DialogTitle>
            <DialogDescription
              className="text-center text-xs leading-relaxed"
              style={{ color: "var(--muted-foreground, #a7adb8)" }}
            >
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
                  className="group rounded-full p-1.5 transition-transform duration-200 focus:outline-none"
                  style={{
                    transform: filled ? "scale(1.18)" : "scale(1)",
                  }}
                >
                  <Star
                    className="size-9 transition-colors duration-150"
                    fill={filled ? "var(--primary, #f0a93f)" : "transparent"}
                    stroke={filled ? "var(--primary, #f0a93f)" : "var(--muted-foreground, #a7adb8)"}
                    strokeWidth={filled ? 1 : 1.5}
                    style={{
                      color: filled ? "var(--primary, #f0a93f)" : "var(--muted-foreground, #a7adb8)",
                      filter: filled ? "drop-shadow(0 0 8px var(--primary, #f0a93f))" : "none",
                      opacity: filled ? 1 : 0.45,
                    }}
                  />
                </button>
              );
            })}
          </div>

          {/* High-Contrast Action Buttons */}
          <div className="flex w-full flex-col gap-3 pt-2">
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                onRate(activeStarCount);
                onClose();
              }}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-center text-sm font-extrabold shadow-lg transition-all duration-200 hover:opacity-95 active:scale-[0.98]"
              style={{
                backgroundColor: "var(--primary, #f0a93f)",
                color: "var(--primary-foreground, #111111)",
                boxShadow: "0 6px 20px -4px color-mix(in srgb, var(--primary, #f0a93f) 50%, transparent)",
              }}
            >
              <Star className="size-5 fill-current" />
              Rate on Google Play
            </a>

            <button
              type="button"
              onClick={onClose}
              className="h-11 w-full rounded-2xl text-xs font-bold transition-all duration-150 active:scale-[0.98]"
              style={{
                backgroundColor: "color-mix(in srgb, var(--muted, #1e2128) 60%, transparent)",
                color: "var(--muted-foreground, #a7adb8)",
                border: "1px solid color-mix(in srgb, var(--border, #2c3038) 60%, transparent)",
              }}
            >
              {t("maybeLater")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
