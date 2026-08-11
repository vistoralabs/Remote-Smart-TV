import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Key } from "./remote-types";

export interface NativeBluetoothDevice {
  id: string;
  name: string;
  bonded: boolean;
  via?: "ble" | "classic" | "bonded";
  rssi?: number;
}

export interface HidStatus {
  supported: boolean;
  enabled: boolean;
  registered: boolean;
  connected: boolean;
  address: string | null;
  name: string | null;
  error: string | null;
}

interface HidStateEvent {
  registered: boolean;
  connected: boolean;
  address: string | null;
  error: string | null;
}

interface NativeBluetoothPlugin {
  isAvailable: () => Promise<{ available: boolean; enabled: boolean }>;
  status: () => Promise<HidStatus>;
  scan: () => Promise<{ devices: NativeBluetoothDevice[] }>;
  pair: (options: { address: string }) => Promise<{ paired: boolean }>;
  prepareRemote: () => Promise<{ discoverable: boolean }>;
  connect: (options: { address: string }) => Promise<{ connected: boolean }>;
  disconnect: () => Promise<void>;
  sendKey: (options: { address: string; key: Key }) => Promise<{ sent: boolean }>;
  addListener: (
    event: "hidState",
    handler: (state: HidStateEvent) => void,
  ) => Promise<{ remove: () => Promise<void> }>;
}

const NativeBluetooth = registerPlugin<NativeBluetoothPlugin>("NativeBluetooth");

export function hasNativeBluetooth(): boolean {
  return Capacitor.isNativePlatform();
}

export async function scanNativeBluetooth(): Promise<NativeBluetoothDevice[]> {
  const result = await NativeBluetooth.scan();
  return result.devices;
}

export async function pairNativeBluetooth(address: string): Promise<void> {
  await NativeBluetooth.pair({ address });
}

export async function sendNativeBluetoothKey(address: string, key: Key): Promise<void> {
  await NativeBluetooth.sendKey({ address, key });
}

export async function getHidStatus(): Promise<HidStatus | null> {
  if (!hasNativeBluetooth()) return null;
  try {
    return await NativeBluetooth.status();
  } catch {
    return null;
  }
}

export async function connectHid(address: string): Promise<void> {
  await NativeBluetooth.connect({ address });
}

export async function prepareHidRemote(): Promise<void> {
  await NativeBluetooth.prepareRemote();
}

export async function disconnectHid(): Promise<void> {
  await NativeBluetooth.disconnect();
}

export function watchHidState(handler: () => void): () => void {
  if (!hasNativeBluetooth()) return () => {};
  let remove: (() => Promise<void>) | null = null;
  void NativeBluetooth.addListener("hidState", handler).then((handle) => {
    remove = handle.remove;
  });
  return () => {
    void remove?.();
  };
}
