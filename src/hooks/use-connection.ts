import { useCallback, useEffect, useState } from "react";
import { androidTvState, hasNativeAndroidTv } from "@/lib/native-android-tv";
import type { Device } from "@/lib/remote-types";

export interface ConnectionState {
  /** True only when the 6466 remote session is authenticated and ready. */
  connected: boolean;
  host: string | null;
  refresh: () => void;
}

/**
 * Live remote-session state. For Android TV / Xstream boxes this reflects the
 * real 6466 session (never just "pairing succeeded"). Other transports are
 * treated as ready once a device is selected.
 */
export function useConnection(device: Device | null): ConnectionState {
  const managed = Boolean(
    device && device.transport === "wifi" && device.brand === "androidtv" && hasNativeAndroidTv(),
  );
  const [connected, setConnected] = useState(false);
  const [host, setHost] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!device) {
      setConnected(false);
      setHost(null);
      return;
    }
    if (!managed) {
      setConnected(true);
      setHost(device.address);
      return;
    }
    let alive = true;
    const poll = async () => {
      try {
        const state = await androidTvState();
        if (!alive) return;
        setConnected(Boolean(state.connected));
        setHost(state.address ?? device.address);
      } catch {
        if (alive) setConnected(false);
      }
    };
    void poll();
    const timer = window.setInterval(poll, 2500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [device, managed, tick]);

  return { connected, host, refresh };
}
