import { useCallback, useEffect, useState } from "react";
import { Bug, Clipboard, Loader2, RefreshCw, Star, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  androidTvDiagnostics,
  clearAndroidTvDiagnostics,
  hasNativeAndroidTv,
} from "@/lib/native-android-tv";
import { adsStatus } from "@/lib/native-ads";
import {
  irCarrierRanges,
  irEmitterAvailable,
  irSelfTest,
  lastIrSignal,
} from "@/lib/ir-remote";
import {
  requestReviewNow,
  reviewLog,
  reviewNativeStatus,
  reviewSnapshot,
} from "@/lib/native-review";
import { APP_NAME, APP_VERSION } from "@/lib/app-info";

/** Hostnames/IPs are stripped before the report can leave the device. */
function redact(text: string): string {
  return text
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "x.x.x.x")
    .replace(/([0-9a-f]{2}:){5}[0-9a-f]{2}/gi, "xx:xx:xx:xx:xx:xx");
}

function section(title: string, lines: (string | null | undefined)[]): string {
  return [`--- ${title} ---`, ...lines.filter(Boolean)].join("\n");
}

export function DebugSheet() {
  const [loading, setLoading] = useState(false);
  const [debugBuild, setDebugBuild] = useState(false);
  const [report, setReport] = useState("Tap Run check to collect diagnostics.");

  useEffect(() => {
    void reviewNativeStatus().then((status) => setDebugBuild(status.debug));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [emitter, ranges, review] = await Promise.all([
        irEmitterAvailable(),
        irCarrierRanges(),
        reviewNativeStatus(),
      ]);
      const ir = lastIrSignal();
      const snapshot = reviewSnapshot();
      const connection = hasNativeAndroidTv()
        ? await androidTvDiagnostics().catch(() => null)
        : null;

      const blocks = [
        section("CONNECTION", [
          `Native bridge: ${hasNativeAndroidTv() ? "available" : "unavailable (browser build)"}`,
          connection ? `Phone Wi-Fi: ${connection.localIp ?? "not detected"}` : null,
          connection ? `Pairing stage: ${connection.pairingStage}` : null,
          connection ? `Pairing socket: ${connection.pairing ? "open" : "closed"}` : null,
          connection
            ? `Remote: ${connection.connected ? `connected to ${connection.host}` : "not connected"}`
            : null,
          connection ? "Native log:" : null,
          ...(connection ? (connection.log.length ? connection.log : ["No events yet."]) : []),
        ]),
        section("IR", [
          `Emitter: ${emitter.available ? "available" : "not available"} (${emitter.device})`,
          `Carrier ranges: ${
            ranges.length ? ranges.map((r) => `${r.min}-${r.max} Hz`).join(", ") : "none reported"
          }`,
          `Selected carrier: ${ir ? `${ir.frequency} Hz` : "none yet"}`,
          `Last command: ${ir?.command ?? "none yet"}`,
          `Last profile: ${[ir?.kind, ir?.brand, ir?.codeSet].filter(Boolean).join(" · ") || "none yet"}`,
          `Last signal: ${
            ir ? `${ir.frequency} Hz · ${ir.items} pulses · x${ir.frames}` : "none sent yet"
          }`,
          `Last result: ${ir ? (ir.ok ? "SUCCESS" : `FAILED${ir.error ? ` — ${ir.error}` : ""}`) : "n/a"}`,
        ]),
        section("ADS", [await adsStatus()]),
        section("REVIEW", [
          `Play services: ${review.playAvailable ? "available" : "unavailable"}`,
          `Debug build: ${review.debug ? "yes" : "no"}`,
          `Sessions: ${snapshot.sessions} · commands this session: ${snapshot.commands}`,
          `TV connected: ${snapshot.connected ? "yes" : "no"} · remote active: ${snapshot.remoteActive ? "yes" : "no"}`,
          `Foreground: ${snapshot.foreground ? "yes" : "no"} · ad quiet: ${snapshot.adQuiet ? "yes" : "no"}`,
          `Cooldown over: ${snapshot.cooldownOver ? "yes" : "no"} · completed: ${snapshot.completed ? "yes" : "no"}`,
          `Eligible now: ${snapshot.eligible ? "yes" : `no (${snapshot.blockedBy})`}`,
          `Last action: ${snapshot.lastAction}`,
          review.lastReason ? `Native reason: ${review.lastReason}` : null,
          "Review log:",
          ...(reviewLog().length ? reviewLog() : ["No review events yet."]),
        ]),
        section("APP", [
          `${APP_NAME} v${APP_VERSION}`,
          `Time: ${new Date().toISOString()}`,
          `Screen: ${window.innerWidth}x${window.innerHeight} @ ${window.devicePixelRatio}x`,
          `Language: ${navigator.language}`,
        ]),
      ];
      setReport(redact(blocks.join("\n\n")));
    } catch (error) {
      setReport(`Diagnostics failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(redact(report));
      toast.success("Diagnostics copied");
    } catch {
      toast.error("Could not copy diagnostics");
    }
  }

  async function clearReport() {
    if (hasNativeAndroidTv()) await clearAndroidTvDiagnostics();
    setReport("Log cleared. Reproduce the issue, then tap Run check.");
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="icon"
          variant="secondary"
          aria-label="Open diagnostics"
          title="Diagnostics"
          className="size-9 rounded-full"
        >
          <Bug className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto border-border bg-card">
        <SheetHeader className="text-left">
          <SheetTitle>Diagnostics</SheetTitle>
          <SheetDescription>
            Connection, IR, ads and review status. Copy is redacted before sharing.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 p-4">
          <Button onClick={() => void refresh()} disabled={loading} className="h-12 w-full">
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Run check
          </Button>
          <pre className="max-h-[45vh] overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-secondary p-3 font-mono text-xs leading-5 text-secondary-foreground">
            {report}
          </pre>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12" onClick={copyReport}>
              <Clipboard /> Copy diagnostics
            </Button>
            <Button variant="outline" className="h-12" onClick={clearReport}>
              <Trash2 /> Clear log
            </Button>
          </div>
          {debugBuild ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                className="h-12"
                onClick={() =>
                  void requestReviewNow("debug button").then((ok) => {
                    toast[ok ? "success" : "info"](
                      ok ? "Review flow completed" : "Play did not show the sheet",
                    );
                    void refresh();
                  })
                }
              >
                <Star /> Test In-App Review
              </Button>
              <Button
                variant="secondary"
                className="h-12"
                onClick={() =>
                  void irSelfTest().then((result) => {
                    toast[result.ok ? "success" : "error"](result.message);
                    void refresh();
                  })
                }
              >
                <Zap /> Test IR
              </Button>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
