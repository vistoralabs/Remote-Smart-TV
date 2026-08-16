import { useState } from "react";
import { X, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { AppAnnouncementConfig } from "@/lib/remote-config";
import logo from "@/assets/logo.png";

// Secondary default fallback URL if KV imageUrl is empty
const DEFAULT_REMOTE_FALLBACK_URL = "https://img.icons8.com/color/96/cloud-download.png";

// In-memory per-launch session tracker
// Resets automatically on every fresh app launch / page reload
const sessionShownTitles = new Set<string>();

export function shouldShowAnnouncement(announcement: AppAnnouncementConfig): boolean {
  if (!announcement.enabled || !announcement.title) return false;
  if (sessionShownTitles.has(announcement.title)) return false;
  return true;
}

export function markAnnouncementDismissed(title: string): void {
  if (title) {
    sessionShownTitles.add(title);
  }
}

export function resetAnnouncementSession(): void {
  sessionShownTitles.clear();
}

interface AnnouncementModalProps {
  open: boolean;
  announcement: AppAnnouncementConfig;
  onClose: () => void;
}

export function AnnouncementModal({ open, announcement, onClose }: AnnouncementModalProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [prevUrl, setPrevUrl] = useState<string | null>(null);

  if (!open || !announcement.enabled || !announcement.title) return null;

  const handleClose = () => {
    markAnnouncementDismissed(announcement.title);
    onClose();
  };

  const handleOpen = (isOpen: boolean) => {
    if (!isOpen) {
      handleClose();
    }
  };

  const primaryButtonText = announcement.buttonText?.trim() || "Open App";
  
  // 1. Primary: Cloudflare KV appAnnouncement.imageUrl
  // 2. Secondary: DEFAULT_REMOTE_FALLBACK_URL
  const displayImageUrl = announcement.imageUrl?.trim() || DEFAULT_REMOTE_FALLBACK_URL;

  // Reset error state if remote config imageUrl updates dynamically
  if (displayImageUrl !== prevUrl) {
    setPrevUrl(displayImageUrl);
    setImgFailed(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent
        className="z-50 w-[min(92vw,24rem)] max-w-sm rounded-3xl border p-0 shadow-2xl transition-all [&>button.absolute]:hidden"
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
          {/* Top Popup Image Container with Strict Inline Dimensions */}
          <div
            style={{
              width: 64,
              height: 64,
              minWidth: 64,
              minHeight: 64,
              maxWidth: 64,
              maxHeight: 64,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              borderRadius: 16,
              backgroundColor: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
              boxSizing: "border-box",
              flexShrink: 0,
            }}
          >
            <img
              key={displayImageUrl}
              src={imgFailed ? logo : displayImageUrl}
              alt="Announcement Icon"
              style={{
                width: 48,
                height: 48,
                minWidth: 48,
                minHeight: 48,
                maxWidth: 48,
                maxHeight: 48,
                objectFit: "contain",
                display: "block",
                flexShrink: 0,
              }}
              onError={() => {
                console.error("[AnnouncementModal] Image failed to load:", displayImageUrl);
                setImgFailed(true);
              }}
            />
          </div>

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
