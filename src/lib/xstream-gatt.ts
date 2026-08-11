import { registerPlugin, Capacitor } from "@capacitor/core";

export type GattVia = "ble" | "classic" | "bonded";

export interface GattDevice {
  id: string;
  address: string;
  name: string;
  via: GattVia;
  rssi?: number;
  bonded?: boolean;
  type?: "classic" | "ble" | "dual" | "unknown";
  services?: string[];
}

export interface GattCharacteristic {
  uuid: string;
  properties: string[];
}

export interface GattService {
  uuid: string;
  characteristics: GattCharacteristic[];
}

export interface GattStateEvent {
  state: "connecting" | "connected" | "disconnected";
  address?: string | null;
  services?: GattService[];
}

export interface GattValueEvent {
  kind: "read" | "notify";
  uuid: string;
  hex: string;
}

interface XstreamGattPlugin {
  permissions(): Promise<{
    scan: boolean;
    connect: boolean;
    bluetoothOn: boolean;
    supported: boolean;
  }>;
  requestPermissions(): Promise<{
    scan: boolean;
    connect: boolean;
    bluetoothOn: boolean;
    supported: boolean;
  }>;
  startScan(): Promise<{ scanning: boolean }>;
  stopScan(): Promise<void>;
  devices(): Promise<{ devices: GattDevice[]; scanning: boolean }>;
  bond(options: { address: string }): Promise<{ bonded: boolean; started?: boolean }>;
  connect(options: { address: string }): Promise<{ connecting: boolean }>;
  disconnect(): Promise<void>;
  discoverServices(): Promise<void>;
  readCharacteristic(options: { uuid: string }): Promise<void>;
  writeCharacteristic(options: { uuid: string; hex: string }): Promise<{ sent: boolean }>;
  enableNotify(options: { uuid: string }): Promise<void>;
  diagnostics(): Promise<{
    state: string;
    address?: string | null;
    scanning: boolean;
    bluetoothOn: boolean;
    adapterName?: string | null;
    log: string[];
  }>;
  addListener(
    event: "scanResult",
    handler: (device: GattDevice) => void,
  ): Promise<{ remove: () => void }>;
  addListener(
    event: "gattState",
    handler: (state: GattStateEvent) => void,
  ): Promise<{ remove: () => void }>;
  addListener(
    event: "gattValue",
    handler: (value: GattValueEvent) => void,
  ): Promise<{ remove: () => void }>;
}

const plugin = registerPlugin<XstreamGattPlugin>("XstreamGatt");

export const gattAvailable = () =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("XstreamGatt");

export const xstreamGatt = plugin;
