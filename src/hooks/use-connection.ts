import { useCallback, useEffect, useRef, useState } from "react";
import { androidTvState, hasNativeAndroidTv, reconnectAndroidTv } from "@/lib/native-android-tv";
import type { Device } from "@/lib/remote-types";

export interface ConnectionState {
  /** True only when the 6466 remote session is authenticated and ready. */
  connected: boolean;
  /** True while an automatic reconnection attempt is in progress. */
  reconnecting: boolean;
  host: string | null;
  refresh: () => void;
}

/** Backoff config */
const INITIAL_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 15000;
const MAX_RETRY_ATTEMPTS = 10;

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
  const [reconnecting, setReconnecting] = useState(false);
  const [host, setHost] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Track previous connected value to detect drops
  const wasConnectedRef = useRef(false);
  // Track active reconnection to avoid overlapping attempts
  const reconnectingRef = useRef(false);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!device) {
      setConnected(false);
      setReconnecting(false);
      setHost(null);
      wasConnectedRef.current = false;
      reconnectingRef.current = false;
      return;
    }
    if (!managed) {
      setConnected(true);
      setReconnecting(false);
      setHost(device.address);
      wasConnectedRef.current = false;
      reconnectingRef.current = false;
      return;
    }

    let alive = true;

    const attemptReconnect = async (address: string) => {
      if (reconnectingRef.current) return;
      reconnectingRef.current = true;
      setReconnecting(true);

      let backoff = INITIAL_BACKOFF_MS;

      for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
        if (!alive) break;

        await new Promise((resolve) => setTimeout(resolve, backoff));
        if (!alive) break;

        const success = await reconnectAndroidTv(address);
        if (!alive) break;

        if (success) {
          setConnected(true);
          setReconnecting(false);
          wasConnectedRef.current = true;
          reconnectingRef.current = false;
          return;
        }

        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      }

      // Exhausted all retries — give up
      if (alive) {
        setReconnecting(false);
      }
      reconnectingRef.current = false;
    };

    const poll = async () => {
      try {
        const state = await androidTvState();
        if (!alive) return;
        const isConnected = Boolean(state.connected);
        setConnected(isConnected);
        setHost(state.address ?? device.address);

        // Whenever not connected, automatically attempt reconnection using saved address
        if (!isConnected && !reconnectingRef.current) {
          void attemptReconnect(state.address ?? device.address);
        }

        wasConnectedRef.current = isConnected;
      } catch {
        if (alive) {
          setConnected(false);
          if (!reconnectingRef.current) {
            void attemptReconnect(device.address);
          }
          wasConnectedRef.current = false;
        }
      }
    };

    const handleFocus = () => {
      if (alive) void poll();
    };

    void poll();
    const timer = window.setInterval(poll, 2500);
    window.addEventListener("visibilitychange", handleFocus);
    window.addEventListener("focus", handleFocus);

    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("focus", handleFocus);
    };
  }, [device, managed, tick]);

  return { connected, reconnecting, host, refresh };
}
