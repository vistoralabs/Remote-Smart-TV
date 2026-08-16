import { useCallback, useEffect, useRef, useState } from "react";
import {
  androidTvState,
  restoreAndroidTvConnection,
  hasNativeAndroidTv,
  reconnectAndroidTv,
} from "@/lib/native-android-tv";
import type { Device } from "@/lib/remote-types";

export interface ConnectionState {
  /** True only when the 6466 remote session is authenticated and ready. */
  connected: boolean;
  /** True if a paired TV exists in native SharedPreferences. */
  paired: boolean;
  /** True while an automatic reconnection attempt is in progress. */
  reconnecting: boolean;
  host: string | null;
  lastError: string | null;
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
  const [paired, setPaired] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [host, setHost] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Track active reconnection to avoid overlapping attempts
  const reconnectingRef = useRef(false);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!device) {
      setConnected(false);
      setPaired(false);
      setReconnecting(false);
      setHost(null);
      setLastError(null);
      reconnectingRef.current = false;
      return;
    }
    if (!managed) {
      setConnected(true);
      setPaired(true);
      setReconnecting(false);
      setHost(device.address);
      setLastError(null);
      reconnectingRef.current = false;
      return;
    }

    let alive = true;

    const attemptReconnect = async (address: string) => {
      if (reconnectingRef.current) return;
      reconnectingRef.current = true;
      if (alive) {
        setReconnecting(true);
        setLastError(null);
      }

      let backoff = INITIAL_BACKOFF_MS;

      for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
        if (!alive) break;

        await new Promise((resolve) => setTimeout(resolve, backoff));
        if (!alive) break;

        try {
          const success = await reconnectAndroidTv(address);
          if (!alive) break;

          if (success) {
            setConnected(true);
            setReconnecting(false);
            setLastError(null);
            reconnectingRef.current = false;
            return;
          }
        } catch {
          // reconnectAndroidTv already catches internally, but guard
          // against unexpected native bridge errors to prevent crashes.
          if (!alive) break;
        }

        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      }

      if (alive) {
        setReconnecting(false);
        setLastError("TV unreachable — tap to retry");
      }
      reconnectingRef.current = false;
    };

    const poll = async () => {
      try {
        const state = await androidTvState();
        if (!alive) return;
        const isConnected = Boolean(state.connected);
        const isPaired = Boolean(state.paired);
        setConnected(isConnected);
        setPaired(isPaired);
        setHost(state.address ?? device.address);
        setLastError(state.lastError ?? null);

        if (isPaired && !isConnected && !reconnectingRef.current) {
          attemptReconnect(state.address ?? device.address).catch(() => {});
        }
      } catch {
        if (alive) {
          setConnected(false);
          if (!reconnectingRef.current) {
            attemptReconnect(device.address).catch(() => {});
          }
        }
      }
    };

    const handleFocus = () => {
      if (alive) poll().catch(() => {});
    };

    // On initial mount, trigger native restore — fully guarded against crashes
    restoreAndroidTvConnection()
      .then((st) => {
        if (!alive) return;
        if (st.paired) setPaired(true);
        if (st.connected) setConnected(true);
        poll().catch(() => {});
      })
      .catch(() => {
        // Native bridge unavailable or TCP timeout — not fatal.
        // Poll will pick up state on the next interval tick.
        if (alive) poll().catch(() => {});
      });

    const timer = window.setInterval(() => {
      poll().catch(() => {});
    }, 2500);
    window.addEventListener("visibilitychange", handleFocus);
    window.addEventListener("focus", handleFocus);

    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("focus", handleFocus);
    };
  }, [device, managed, tick]);

  return { connected, paired, reconnecting, host, lastError, refresh };
}

