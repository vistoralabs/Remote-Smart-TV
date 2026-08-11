import { useCallback, useEffect, useState } from "react";
import { Bluetooth, BluetoothConnected, BluetoothSearching, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  connectHid,
  disconnectHid,
  getHidStatus,
  hasNativeBluetooth,
  prepareHidRemote,
  watchHidState,
  type HidStatus,
} from "@/lib/native-bluetooth";
import type { Device } from "@/lib/remote-types";

/**
 * Live Bluetooth HID link state for the selected device. Keys only reach a TV
 * once this card reports "linked", so the state is surfaced instead of failing
 * silently behind a button press.
 */
export function BluetoothLink({ device }: { device: Device }) {
  const [status, setStatus] = useState<HidStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void getHidStatus().then(setStatus);
  }, []);

  useEffect(() => {
    refresh();
    const stop = watchHidState(refresh);
    const timer = window.setInterval(refresh, 4000);
    return () => {
      stop();
      window.clearInterval(timer);
    };
  }, [refresh]);

  const linked = !!status?.connected && status.address === device.address;

  const connect = useCallback(async () => {
    setBusy(true);
    try {
      await connectHid(device.address);
      toast.success(`${device.name} linked`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bluetooth link failed");
    } finally {
      setBusy(false);
      refresh();
    }
  }, [device.address, device.name, refresh]);

  const prepare = useCallback(async () => {
    setBusy(true);
    try {
      await prepareHidRemote();
      toast.info("On the TV, scan for accessories and select this phone");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start pairing mode");
    } finally {
      setBusy(false);
      refresh();
    }
  }, [refresh]);

  const drop = useCallback(async () => {
    await disconnectHid();
    refresh();
  }, [refresh]);

  if (!hasNativeBluetooth()) {
    return (
      <div className="shell-panel rounded-2xl border border-border/60 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Bluetooth className="size-4 text-muted-foreground" />
          Bluetooth keys need the installed app
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          A web page cannot emit remote reports. Install the Android build to use this device.
        </p>
      </div>
    );
  }

  const Icon = linked ? BluetoothConnected : BluetoothSearching;

  return (
    <div className="shell-panel flex flex-col gap-2 rounded-2xl border border-border/60 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Icon className={linked ? "size-4 text-accent" : "size-4 text-muted-foreground"} />
          {linked
            ? "Remote linked"
            : status?.registered
              ? "Not linked yet"
              : "Starting remote mode"}
        </p>
        {linked ? (
          <Button size="sm" variant="secondary" onClick={drop} className="rounded-full">
            Disconnect
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={prepare}
              disabled={busy}
              className="rounded-full"
            >
              Pair from TV
            </Button>
            <Button
              size="sm"
              onClick={connect}
              disabled={busy || !status?.registered}
              className="rounded-full"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Connect"}
            </Button>
          </div>
        )}
      </div>
      {!linked ? (
        <p className="text-xs text-muted-foreground">
          Tap Pair from TV, then open the TV/box Add accessory screen and select this phone. Return
          here and tap Connect after Android shows it as paired.
        </p>
      ) : null}
      {!linked && status?.error ? <p className="text-xs text-destructive">{status.error}</p> : null}
    </div>
  );
}
