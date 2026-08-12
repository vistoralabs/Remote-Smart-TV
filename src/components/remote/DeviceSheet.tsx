import { useState } from "react";
import { Loader2, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { type Device } from "@/lib/remote-types";
import { type Capability } from "@/lib/transports";
import {
  finishAndroidTvPairing,
  hasNativeAndroidTv,
  scanAndroidTvs,
  startAndroidTvPairing,
  type AndroidTvDevice,
} from "@/lib/native-android-tv";
import { toast } from "sonner";
import { showInterstitialAtBreak } from "@/lib/native-ads";

export function DeviceSheet({
  capabilities: _capabilities,
  onAdd,
  trigger,
}: {
  capabilities: Capability[];
  onAdd: (device: Device) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [wifiDevices, setWifiDevices] = useState<AndroidTvDevice[]>([]);
  const [localIp, setLocalIp] = useState<string | null>(null);
  const [pairingAddress, setPairingAddress] = useState<string | null>(null);
  const [pairingName, setPairingName] = useState("");
  const [pairingCode, setPairingCode] = useState("");

  function commit(finalAddress: string, finalName: string) {
    onAdd({
      id: `wifi-${finalAddress}`,
      name: finalName || "My TV",
      brand: "androidtv",
      transport: "wifi",
      address: finalAddress,
    });
    setOpen(false);
  }

  async function scanWifi() {
    setScanning(true);
    setWifiDevices([]);
    try {
      const found = await scanAndroidTvs();
      setWifiDevices(found.devices);
      setLocalIp(found.localIp ?? null);
      if (!found.devices.length)
        toast.error("No TV answered. Keep the phone on the same Wi-Fi as your TV.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Wi-Fi scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function beginWifiPairing(device: AndroidTvDevice) {
    setScanning(true);
    try {
      const chosenName = device.name === device.address ? "My TV" : device.name;
      await startAndroidTvPairing(device.address, chosenName);
      setPairingAddress(device.address);
      setPairingName(chosenName);
      toast.info("Enter the 6-character code shown on the TV");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pairing failed");
    } finally {
      setScanning(false);
    }
  }

  async function confirmWifiPairing() {
    if (!pairingAddress) return;
    setScanning(true);
    try {
      await finishAndroidTvPairing(pairingCode, pairingName || "My TV");
      commit(pairingAddress, pairingName || "My TV");
      toast.success("TV paired — remote is ready");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Incorrect pairing code");
    } finally {
      setScanning(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Closing the discovery sheet is a natural, non-critical transition.
        if (!next) void showInterstitialAtBreak();
      }}
    >
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto rounded-t-3xl border-border bg-card"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-display">Search your TV</SheetTitle>
          <SheetDescription>Keep your phone and your TV on the same Wi-Fi.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-4">
          {hasNativeAndroidTv() ? (
            <div className="space-y-2">
              <Button onClick={scanWifi} className="w-full" disabled={scanning}>
                {scanning ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Wifi className="size-4" />
                )}
                {scanning ? "Searching your TV…" : "Search your TV"}
              </Button>
              {localIp ? (
                <p className="text-[11px] text-muted-foreground">Phone network: {localIp}</p>
              ) : null}
              {wifiDevices.map((device) => (
                <Button
                  key={device.address}
                  type="button"
                  onClick={() => beginWifiPairing(device)}
                  className="h-auto w-full justify-between py-3"
                  variant="outline"
                  disabled={scanning}
                >
                  <span className="text-left">
                    <span className="block">
                      {device.name === device.address ? "My TV" : device.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">{device.address}</span>
                  </span>
                  <span className="text-xs">Connect</span>
                </Button>
              ))}
              {pairingAddress ? (
                <div className="space-y-2 rounded-md border border-border p-3">
                  <Label htmlFor="pair-code">Enter the code shown on TV</Label>
                  <Input
                    id="pair-code"
                    value={pairingCode}
                    onChange={(event) =>
                      setPairingCode(
                        event.target.value
                          .toUpperCase()
                          .replace(/[^0-9A-F]/g, "")
                          .slice(0, 6),
                      )
                    }
                    placeholder="A1B2C3"
                    autoCapitalize="characters"
                    autoComplete="one-time-code"
                    className="bg-secondary font-mono text-lg"
                  />
                  <Button
                    onClick={confirmWifiPairing}
                    disabled={pairingCode.length !== 6 || scanning}
                    className="w-full"
                  >
                    {scanning ? <Loader2 className="size-4 animate-spin" /> : null} Connect remote
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Install the Android app to search and connect your TV.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
