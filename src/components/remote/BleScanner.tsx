import { useCallback, useEffect, useRef, useState } from "react";
import { Bluetooth, Loader2, RefreshCw, ShieldCheck, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { gattAvailable, xstreamGatt, type GattDevice, type GattService } from "@/lib/xstream-gatt";
import { cn } from "@/lib/utils";

const SCAN_MS = 20000;

/**
 * Live Bluetooth discovery for set-top boxes. Results stream in from BLE and
 * Classic scans at the same time, unfiltered, so LE-only boxes such as the
 * Jio Hybrid STB appear even when Android Settings hides them.
 */
export function BleScanner({ onPick }: { onPick: (device: GattDevice) => void }) {
  const [devices, setDevices] = useState<GattDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [services, setServices] = useState<GattService[] | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);
  const removers = useRef<Array<() => void>>([]);
  const timer = useRef<number | null>(null);

  const merge = useCallback((incoming: GattDevice) => {
    setDevices((current) => {
      const index = current.findIndex((d) => d.address === incoming.address);
      const previous = index === -1 ? undefined : current[index];
      if (!previous) return [...current, incoming];
      const next = [...current];
      next[index] = {
        ...previous,
        ...incoming,
        name: incoming.name === "Unnamed device" ? previous.name : incoming.name,
        via: previous.via === "ble" || incoming.via === "ble" ? "ble" : incoming.via,
      };
      return next;
    });
  }, []);

  useEffect(() => {
    if (!gattAvailable()) return;
    let cancelled = false;
    void (async () => {
      const scanHandle = await xstreamGatt.addListener("scanResult", merge);
      const stateHandle = await xstreamGatt.addListener("gattState", (event) => {
        if (event.services) setServices(event.services);
        if (event.state) setLog((current) => [...current.slice(-80), `GATT ${event.state}`]);
      });
      const valueHandle = await xstreamGatt.addListener("gattValue", (event) => {
        setLog((current) => [...current.slice(-80), `${event.kind} ${event.uuid} = ${event.hex}`]);
      });
      if (cancelled) {
        scanHandle.remove();
        stateHandle.remove();
        valueHandle.remove();
        return;
      }
      removers.current = [scanHandle.remove, stateHandle.remove, valueHandle.remove];
    })();
    return () => {
      cancelled = true;
      removers.current.forEach((remove) => {
        try {
          remove();
        } catch {
          /* listener already gone */
        }
      });
      removers.current = [];
      if (timer.current) window.clearTimeout(timer.current);
      void xstreamGatt.stopScan().catch(() => undefined);
    };
  }, [merge]);

  const stop = useCallback(async () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setScanning(false);
    await xstreamGatt.stopScan().catch(() => undefined);
  }, []);

  const start = useCallback(async () => {
    setDevices([]);
    try {
      const state = await xstreamGatt.requestPermissions();
      if (!state.supported) throw new Error("This phone has no Bluetooth adapter");
      if (!state.bluetoothOn) throw new Error("Turn on Bluetooth, then scan again");
      if (!state.scan) throw new Error("Allow the Nearby devices permission to find your box");
      await xstreamGatt.startScan();
      setScanning(true);
      timer.current = window.setTimeout(() => void stop(), SCAN_MS);
    } catch (error) {
      setScanning(false);
      toast.error(error instanceof Error ? error.message : "Bluetooth scan failed");
    }
  }, [stop]);

  const bond = useCallback(async (device: GattDevice) => {
    setBusy(device.address);
    try {
      const result = await xstreamGatt.bond({ address: device.address });
      toast.info(
        result.bonded
          ? `${device.name} is already paired`
          : "Android is pairing — confirm the PIN or passkey if it asks",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pairing failed");
    } finally {
      setBusy(null);
    }
  }, []);

  const inspect = useCallback(
    async (device: GattDevice) => {
      setBusy(device.address);
      setServices(null);
      try {
        await stop();
        await xstreamGatt.connect({ address: device.address });
        setShowLog(true);
        toast.info("Reading services from the box…");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "GATT connect failed");
      } finally {
        setBusy(null);
      }
    },
    [stop],
  );

  if (!gattAvailable()) {
    return (
      <p className="text-xs text-muted-foreground">
        Bluetooth discovery and pairing need the installed Android app — a browser cannot scan for
        set-top boxes.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button onClick={scanning ? stop : start} className="flex-1" variant="secondary">
          {scanning ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Bluetooth className="size-4" />
          )}
          {scanning ? "Scanning… tap to stop" : "Scan for boxes and TVs"}
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label="Bluetooth diagnostics"
          onClick={async () => {
            const info = await xstreamGatt.diagnostics();
            setLog(info.log);
            setShowLog((current) => !current);
          }}
        >
          <Stethoscope className="size-4" />
        </Button>
      </div>

      {scanning ? (
        <p className="text-xs text-muted-foreground">
          Keep the box powered on and nearby. BLE and Classic are scanned together, unpaired devices
          included.
        </p>
      ) : null}

      {devices.map((device) => (
        <div
          key={device.address}
          className="rounded-xl border border-border/70 bg-secondary/40 px-3 py-2.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{device.name}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{device.address}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {device.via === "ble" ? "BLE" : device.via === "classic" ? "Classic" : "Saved"}
                {device.type ? ` · ${device.type}` : ""}
                {typeof device.rssi === "number" ? ` · ${device.rssi} dBm` : ""}
                {device.bonded ? " · paired" : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5">
              <Button
                size="sm"
                className="h-7 rounded-full px-3 text-xs"
                onClick={() => onPick(device)}
              >
                Use
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 rounded-full px-3 text-xs"
                disabled={busy === device.address}
                onClick={() => bond(device)}
              >
                {device.bonded ? <ShieldCheck className="size-3.5" /> : "Pair"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 rounded-full px-3 text-[11px]"
                disabled={busy === device.address}
                onClick={() => inspect(device)}
              >
                Inspect
              </Button>
            </div>
          </div>
        </div>
      ))}

      {!scanning && devices.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing found yet. Start a scan with the TV awake — most boxes only advertise while their
          remote-pairing screen is open.
        </p>
      ) : null}

      {showLog ? (
        <div className="space-y-2 rounded-xl border border-border/70 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Diagnostics
            </p>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Refresh diagnostics"
              onClick={async () => setLog((await xstreamGatt.diagnostics()).log)}
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
          {services?.map((service) => (
            <div key={service.uuid} className="text-[11px]">
              <p className="font-mono text-foreground">{service.uuid}</p>
              {service.characteristics.map((characteristic) => (
                <p key={characteristic.uuid} className="pl-3 font-mono text-muted-foreground">
                  {characteristic.uuid} · {characteristic.properties.join("/") || "none"}
                </p>
              ))}
            </div>
          ))}
          <pre
            className={cn(
              "max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-secondary/60 p-2",
              "font-mono text-[10px] leading-relaxed text-muted-foreground",
            )}
          >
            {log.join("\n") || "No events yet"}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
