import { useState, useEffect } from "react";
import { Download, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { APP_VERSION } from "@/lib/app-info";
import type { VersionConfig } from "@/lib/remote-config";

interface UpdateModalProps {
  versionConfig: VersionConfig;
}

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map((p) => parseInt(p, 10) || 0);
  const parts2 = v2.split(".").map((p) => parseInt(p, 10) || 0);
  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

export function UpdateModal({ versionConfig }: UpdateModalProps) {
  const [open, setOpen] = useState(false);
  const [mandatory, setMandatory] = useState(false);

  useEffect(() => {
    if (!versionConfig.minimumSupported) return;
    const current = APP_VERSION;
    if (compareVersions(current, versionConfig.minimumSupported) < 0) {
      setMandatory(true);
      setOpen(true);
      return;
    }
    if (versionConfig.recommended && compareVersions(current, versionConfig.recommended) < 0) {
      try {
        const skipped = window.localStorage.getItem(`update.skipped.${versionConfig.recommended}`);
        if (!skipped) {
          setMandatory(false);
          setOpen(true);
        }
      } catch {
        setOpen(true);
      }
    }
  }, [versionConfig]);

  const handleSkip = () => {
    if (mandatory) return;
    setOpen(false);
    try {
      window.localStorage.setItem(`update.skipped.${versionConfig.recommended}`, "1");
    } catch {
      /* ignore storage errors */
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !mandatory) handleSkip(); }}>
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
          <div
            className="flex size-12 items-center justify-center rounded-2xl border"
            style={{
              backgroundColor: mandatory
                ? "color-mix(in srgb, var(--destructive, #ff5567) 16%, transparent)"
                : "color-mix(in srgb, var(--primary, #f0a93f) 16%, transparent)",
              borderColor: mandatory
                ? "color-mix(in srgb, var(--destructive, #ff5567) 35%, transparent)"
                : "color-mix(in srgb, var(--primary, #f0a93f) 35%, transparent)",
              color: mandatory ? "var(--destructive, #ff5567)" : "var(--primary, #f0a93f)",
            }}
          >
            {mandatory ? <AlertTriangle className="size-6" /> : <Download className="size-6" />}
          </div>

          <DialogHeader className="items-center gap-1.5">
            <DialogTitle
              className="text-center font-display text-xl font-bold tracking-tight"
              style={{ color: "var(--foreground, #f4f5f7)" }}
            >
              {mandatory ? "Update Required" : "Update Available"}
            </DialogTitle>
            <DialogDescription
              className="text-center text-xs leading-relaxed"
              style={{ color: "var(--muted-foreground, #a7adb8)" }}
            >
              {versionConfig.message ||
                "A new version of Smart TV Remote is available with performance improvements and new device profiles."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex w-full flex-col gap-2.5 pt-2">
            <a
              href={versionConfig.updateUrl || "https://play.google.com/store/apps/details?id=app.remote.universal"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold shadow-lg transition-all active:scale-[0.98]"
              style={{
                backgroundColor: "var(--primary, #f0a93f)",
                color: "var(--primary-foreground, #111111)",
              }}
            >
              <Download className="size-4" />
              Update Now
            </a>

            {!mandatory ? (
              <button
                type="button"
                onClick={handleSkip}
                className="h-11 w-full rounded-2xl text-xs font-bold transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--muted, #1e2128) 60%, transparent)",
                  color: "var(--muted-foreground, #a7adb8)",
                  border: "1px solid color-mix(in srgb, var(--border, #2c3038) 60%, transparent)",
                }}
              >
                Remind Me Later
              </button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
