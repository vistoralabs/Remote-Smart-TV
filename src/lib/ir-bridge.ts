import { registerPlugin, Capacitor } from "@capacitor/core";

/**
 * Single Capacitor bridge for the phone's IR emitter.
 *
 * Registering the same plugin name from two modules makes Capacitor warn
 * ("plugin already registered") and can hand back a stale proxy, so every
 * caller must import `Ir` from here.
 */
export interface IrCarrierRange {
  min: number;
  max: number;
}

export interface IrNativePlugin {
  isAvailable: () => Promise<{ available: boolean; device: string }>;
  getCarrierFrequencies: () => Promise<{ ranges: IrCarrierRange[] }>;
  transmit: (options: { frequency: number; pattern: number[] }) => Promise<{ sent?: boolean }>;
}

export const Ir = registerPlugin<IrNativePlugin>("Ir");

export function isNativeRuntime(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
