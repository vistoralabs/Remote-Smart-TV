import { useState, useEffect } from "react";
import { X, Sparkles, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { AppAnnouncementConfig } from "@/lib/remote-config";

interface AnnouncementModalProps {
  announcement: AppAnnouncementConfig;
}

const DISMISSED_TITLE_KEY = "announcement.dismissedTitle";

export function AnnouncementModal({ announcement }: AnnouncementModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!announcement.enabled || !announcement.title) return;
    try {
      const dismissed = window.localStorage.getItem(DISMISSED_TITLE_KEY);
      if (dismissed === announcement.title) return;
      setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [announcement]);

  const handleClose = () => {
    setOpen(false);
    try {
      if (announcement.title) {
        window.localStorage.setItem(DISMISSED_TITLE_KEY, announcement.title);
      }
    } catch {
      /* ignore storage errors */
    }
  };

  if (!announcement.enabled || !announcement.title) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="mx-auto w-[92vw] max-w-sm rounded-3xl p-0 shadow-2xl transition-all border"
        style={{
          backgroundColor: "var(--card, #1a1d23)",
          borderColor: "var(--border, #2c3038)",
          color: "var(--foreground, #f4f5f7)",
          boxShadow: "0 24px 60px -15px var(--shadow-color, rgba(0, 0, 0, 0.5))",
        }}
      >
        <div className="flex flex-col items-center gap-4 px-6 pb-6 pt-7 text-center">
          {announcement.imageUrl ? (
            <img
              src={announcement.imageUrl}
              alt="Announcement"
              className="max-h-40 w-full rounded-2xl object-cover shadow-md"
            />
          ) : (
            <div
              className="flex size-12 items-center justify-center rounded-2xl border"
              style={{
                backgroundColor: "color-mix(in srgb, var(--primary, #f0a93f) 16%, transparent)",
                borderColor: "color-mix(in srgb, var(--primary, #f0a93f) 35%, transparent)",
                color: "var(--primary, #f0a93f)",
              }}
            >
              <Sparkles className="size-6" />
            </div>
          )}

          <DialogHeader className="items-center gap-1.5">
            <DialogTitle
              className="text-center font-display text-xl font-bold tracking-tight"
              style={{ color: "var(--foreground, #f4f5f7)" }}
            >
              {announcement.title}
            </DialogTitle>
            <DialogDescription
              className="text-center text-xs leading-relaxed"
              style={{ color: "var(--muted-foreground, #a7adb8)" }}
            >
              {announcement.message}
            </DialogDescription>
          </DialogHeader>

          <div className="flex w-full flex-col gap-2.5 pt-2">
            {announcement.buttonText && announcement.buttonUrl ? (
              <a
                href={announcement.buttonUrl}
                target={announcement.buttonUrl.startsWith("http") ? "_blank" : "_self"}
                rel="noopener noreferrer"
                onClick={handleClose}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold shadow-lg transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: "var(--primary, #f0a93f)",
                  color: "var(--primary-foreground, #111111)",
                }}
              >
                {announcement.buttonText}
                <ExternalLink className="size-4" />
              </a>
            ) : null}

            <button
              type="button"
              onClick={handleClose}
              className="h-11 w-full rounded-2xl text-xs font-bold transition-all active:scale-[0.98]"
              style={{
                backgroundColor: "color-mix(in srgb, var(--muted, #1e2128) 60%, transparent)",
                color: "var(--muted-foreground, #a7adb8)",
                border: "1px solid color-mix(in srgb, var(--border, #2c3038) 60%, transparent)",
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
