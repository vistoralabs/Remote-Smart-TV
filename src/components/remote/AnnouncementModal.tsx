import { useState, useEffect, useRef } from "react";
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
  onboarded?: boolean;
}

const DISMISSED_TITLE_KEY = "announcement.dismissedTitle";
const SHOWN_SESSION_KEY = "announcement.shownInSession";
const DELAY_MS = 2500; // 2.5 second delay after main UI loads

export function AnnouncementModal({ announcement, onboarded = true }: AnnouncementModalProps) {
  const [open, setOpen] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Strictly DO NOT show or start timer if onboarding is active
    if (!onboarded) return;

    // Don't show if not enabled or no title
    if (!announcement.enabled || !announcement.title) return;

    // Check if dismissed in localStorage
    try {
      const dismissed = window.localStorage.getItem(DISMISSED_TITLE_KEY);
      if (dismissed === announcement.title) return;
    } catch {
      // ignore storage errors
    }

    // Check if already shown in this session
    try {
      const shownKey = `${SHOWN_SESSION_KEY}.${announcement.title}`;
      if (window.localStorage.getItem(shownKey) === "true") return;
    } catch {
      // ignore storage errors
    }

    // Delay opening by 2.5 seconds to let the main UI render cleanly
    const timeoutId = window.setTimeout(() => {
      if (!isMountedRef.current) return;
      setOpen(true);
    }, DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [announcement, onboarded]);

  const handleClose = () => {
    setOpen(false);
    try {
      if (announcement.title) {
        window.localStorage.setItem(DISMISSED_TITLE_KEY, announcement.title);
        const shownKey = `${SHOWN_SESSION_KEY}.${announcement.title}`;
        window.localStorage.setItem(shownKey, "true");
      }
    } catch {
      /* ignore storage errors */
    }
  };

  const handleOpen = (isOpen: boolean) => {
    if (!isOpen) {
      handleClose();
    }
  };

  if (!onboarded || !announcement.enabled || !announcement.title) return null;

  const primaryButtonText = announcement.buttonText?.trim() || "Open App";

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent
        className="relative z-50 mx-auto w-[min(92vw,24rem)] max-w-sm rounded-3xl border p-0 shadow-2xl transition-all [&>button.absolute]:hidden"
        style={{
          backgroundColor: "var(--card, #1a1d23)",
          borderColor: "var(--border, #2c3038)",
          color: "var(--foreground, #f4f5f7)",
          boxShadow: "0 20px 50px -15px rgba(0, 0, 0, 0.4)",
          maxHeight: "min(85vh, 40rem)",
          overflowY: "auto",
        }}
      >
        {/* Top-Right Close Button */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="absolute right-3.5 top-3.5 z-10 flex size-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
        >
          <X className="size-4" />
        </button>

        <div className="flex flex-col items-center gap-4 px-6 pb-6 pt-7 text-center">
          {announcement.imageUrl ? (
            <img
              src={announcement.imageUrl}
              alt="Announcement"
              className="max-h-44 w-full rounded-2xl object-cover shadow-md"
            />
          ) : (
            <div
              className="flex size-14 items-center justify-center rounded-2xl border"
              style={{
                backgroundColor: "color-mix(in srgb, var(--primary, #f0a93f) 16%, transparent)",
                borderColor: "color-mix(in srgb, var(--primary, #f0a93f) 35%, transparent)",
                color: "var(--primary, #f0a93f)",
              }}
            >
              <Sparkles className="size-7" />
            </div>
          )}

          <DialogHeader className="items-center gap-1.5">
            <DialogTitle
              className="text-center font-display text-xl font-bold tracking-tight"
              style={{ color: "var(--foreground, #f4f5f7)" }}
            >
              {announcement.title}
            </DialogTitle>
            {announcement.message && (
              <DialogDescription
                className="text-center text-xs leading-relaxed"
                style={{ color: "var(--muted-foreground, #a7adb8)" }}
              >
                {announcement.message}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="flex w-full flex-col gap-2.5 pt-2">
            {announcement.buttonUrl ? (
              <a
                href={announcement.buttonUrl}
                target={announcement.buttonUrl.startsWith("http") ? "_blank" : "_self"}
                rel="noopener noreferrer"
                onClick={handleClose}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold shadow-md transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: "var(--primary, #f0a93f)",
                  color: "var(--primary-foreground, #111111)",
                }}
              >
                {primaryButtonText}
                <ExternalLink className="size-4" />
              </a>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold shadow-md transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: "var(--primary, #f0a93f)",
                  color: "var(--primary-foreground, #111111)",
                }}
              >
                {primaryButtonText}
              </button>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="h-10 w-full rounded-2xl text-xs font-semibold transition-all active:scale-[0.98]"
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
