import { useState } from "react";
import { Bluetooth, Radio, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DeviceSheet } from "@/components/remote/DeviceSheet";
import { BleScanner } from "@/components/remote/BleScanner";
import { IrSetupWizard } from "@/components/remote/IrSetupWizard";
import type { SavedIrRemote } from "@/lib/ir-devices";
import type { Device } from "@/lib/remote-types";
import type { Capability } from "@/lib/transports";
import type { Translate } from "@/lib/i18n";
import { setAdCriticalFlow } from "@/lib/native-ads";

type Mode = "choose" | "ir" | "bluetooth";

/** "+" entry point: pick the transport, then run that transport's own flow. */
export function AddRemoteSheet({
  trigger,
  capabilities,
  onAddWifi,
  onAddIr,
  t,
  haptics,
  sound,
}: {
  trigger: React.ReactNode;
  capabilities: Capability[];
  onAddWifi: (device: Device) => void;
  onAddIr: (remote: SavedIrRemote) => void;
  t: Translate;
  haptics: boolean;
  sound: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("choose");

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Setup is a critical flow: no interstitials while it is on screen.
        void setAdCriticalFlow(next);
        if (!next) setMode("choose");
      }}
    >
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl border-t border-border bg-popover px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-popover-foreground"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-display">{t("addRemote")}</SheetTitle>
          <SheetDescription className="text-muted-foreground">
            {t("addRemoteHint")}
          </SheetDescription>
        </SheetHeader>

        {mode === "choose" ? (
          <div className="flex flex-col gap-2 pb-4">
            <DeviceSheet
              capabilities={capabilities}
              onAdd={(device) => {
                onAddWifi(device);
                setOpen(false);
              }}
              trigger={
                <button
                  type="button"
                  className="glass-panel flex min-h-16 items-center gap-3 rounded-2xl border border-border/60 px-4 py-3 text-left"
                >
                  <Wifi className="size-5 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{t("transportWifi")}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {t("transportWifiHint")}
                    </span>
                  </span>
                </button>
              }
            />
            <button
              type="button"
              onClick={() => setMode("bluetooth")}
              className="glass-panel flex min-h-16 items-center gap-3 rounded-2xl border border-border/60 px-4 py-3 text-left"
            >
              <Bluetooth className="size-5 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {t("transportBluetooth")}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {t("transportBluetoothHint")}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode("ir")}
              className="glass-panel flex min-h-16 items-center gap-3 rounded-2xl border border-border/60 px-4 py-3 text-left"
            >
              <Radio className="size-5 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{t("transportIr")}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {t("transportIrHint")}
                </span>
              </span>
            </button>
          </div>
        ) : null}

        {mode === "bluetooth" ? (
          <div className="flex flex-col gap-3 pb-4">
            <BleScanner
              onPick={(device) => {
                onAddWifi({
                  id: `bt-${device.address}`,
                  name: device.name || "Bluetooth remote",
                  brand: "generic",
                  transport: "bluetooth",
                  address: device.address,
                });
                setOpen(false);
              }}
            />
            <Button variant="secondary" className="h-11 rounded-xl" onClick={() => setMode("choose")}>
              {t("back")}
            </Button>
          </div>
        ) : null}

        {mode === "ir" ? (
          <div className="pb-4">
            <IrSetupWizard
              t={t}
              haptics={haptics}
              sound={sound}
              onCancel={() => setMode("choose")}
              onSaved={(remote) => {
                onAddIr(remote);
                setOpen(false);
              }}
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
