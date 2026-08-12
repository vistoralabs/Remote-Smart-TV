import { useState } from "react";
import { Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { StringKey } from "@/lib/i18n";

interface RatingDialogProps {
  open: boolean;
  onClose: () => void;
  onRate: (stars: number) => void;
  t: (key: StringKey) => string;
}

export function RatingDialog({ open, onClose, onRate, t }: RatingDialogProps) {
  const [hovered, setHovered] = useState(0);

  const handleRate = (stars: number) => {
    onRate(stars);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="mx-auto w-[92vw] max-w-sm rounded-3xl border-white/10 p-0 sm:rounded-3xl"
        style={{
          background:
            "linear-gradient(145deg, var(--t-surface, hsl(var(--card))) 0%, hsl(var(--background) / 0.92) 100%)",
          backdropFilter: "blur(24px) saturate(1.4)",
          WebkitBackdropFilter: "blur(24px) saturate(1.4)",
          boxShadow:
            "0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex flex-col items-center gap-5 px-6 pb-6 pt-8">
          {/* App name pill */}
          <span
            className="rounded-full px-4 py-1 text-[11px] font-bold uppercase tracking-[0.18em]"
            style={{
              background: "var(--t-primary, hsl(var(--primary) / 0.12))",
              color: "var(--t-text, hsl(var(--primary)))",
            }}
          >
            Smart TV Remote
          </span>

          <DialogHeader className="items-center gap-1.5">
            <DialogTitle
              className="text-center text-xl font-bold tracking-tight"
              style={{ color: "var(--t-text, hsl(var(--foreground)))" }}
            >
              {t("rateTitle")}
            </DialogTitle>
            <DialogDescription
              className="text-center text-sm leading-relaxed"
              style={{
                color: "var(--t-text, hsl(var(--muted-foreground)))",
                opacity: 0.7,
              }}
            >
              {t("rateBody")}
            </DialogDescription>
          </DialogHeader>

          {/* Stars */}
          <div className="flex items-center gap-2 py-2">
            {[1, 2, 3, 4, 5].map((star) => {
              const filled = star <= hovered;
              return (
                <button
                  key={star}
                  type="button"
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  onPointerDown={() => setHovered(star)}
                  onClick={() => handleRate(star)}
                  className="group rounded-full p-1.5 transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  style={{
                    transform: filled ? "scale(1.18)" : "scale(1)",
                    transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
                  }}
                >
                  <Star
                    className="size-9 transition-colors duration-150"
                    fill={filled ? "#FACC15" : "transparent"}
                    stroke={filled ? "#FACC15" : "hsl(var(--muted-foreground) / 0.4)"}
                    strokeWidth={1.6}
                    style={{
                      filter: filled
                        ? "drop-shadow(0 0 8px rgba(250,204,21,0.45))"
                        : "none",
                    }}
                  />
                </button>
              );
            })}
          </div>

          {/* Maybe Later */}
          <button
            type="button"
            onClick={onClose}
            className="mt-1 rounded-full px-6 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-white/8 active:scale-[0.97]"
            style={{
              color: "var(--t-text, hsl(var(--muted-foreground)))",
              opacity: 0.65,
            }}
          >
            {t("maybeLater")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
