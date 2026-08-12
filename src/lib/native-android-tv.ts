import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Key } from "./remote-types";

export interface AndroidTvDevice {
  address: string;
  name: string;
}

export interface AndroidTvState {
  connected: boolean;
  paired: boolean;
  address?: string | null;
  name?: string | null;
  localIp?: string | null;
  reconnecting?: boolean;
  reconnectAttempts?: number;
  lastError?: string | null;
}

export interface AndroidTvDiagnostics {
  appVersion: string;
  time: string;
  localIp?: string | null;
  pairingStage: string;
  pairing: boolean;
  paired?: boolean;
  connected: boolean;
  savedHost?: string | null;
  currentHost?: string | null;
  reconnectAttempt?: number;
  lastError?: string | null;
  identity?: string;
  log: string[];
}

interface NativeAndroidTvPlugin {
  scan: () => Promise<{ devices: AndroidTvDevice[]; localIp?: string | null }>;
  startPairing: (options: { address: string }) => Promise<{ codeRequired: boolean }>;
  finishPairing: (options: { code: string }) => Promise<{ paired: boolean }>;
  restore: () => Promise<AndroidTvState>;
  clearPairing: () => Promise<void>;
  connect: (options: { address: string }) => Promise<{ connected: boolean }>;
  sendKey: (options: { address: string; key: Key }) => Promise<{ sent: boolean }>;
  sendText: (options: { address: string; text: string }) => Promise<{ sent: boolean }>;
  launchApp: (options: { address: string; link: string }) => Promise<{ sent: boolean }>;
  state: () => Promise<AndroidTvState>;
  diagnostics: () => Promise<AndroidTvDiagnostics>;
  clearDiagnostics: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const NativeAndroidTv = registerPlugin<NativeAndroidTvPlugin>("NativeAndroidTv");

export function hasNativeAndroidTv(): boolean {
  return Capacitor.isNativePlatform();
}

export async function scanAndroidTvs(): Promise<{
  devices: AndroidTvDevice[];
  localIp?: string | null;
}> {
  return NativeAndroidTv.scan();
}

export async function startAndroidTvPairing(address: string): Promise<void> {
  await NativeAndroidTv.startPairing({ address });
}

export async function finishAndroidTvPairing(code: string): Promise<void> {
  await NativeAndroidTv.finishPairing({ code });
}

export async function restoreAndroidTvConnection(): Promise<AndroidTvState> {
  return NativeAndroidTv.restore();
}

export async function clearAndroidTvPairing(): Promise<void> {
  await NativeAndroidTv.clearPairing();
}

export async function sendAndroidTvKey(address: string, key: Key): Promise<void> {
  await NativeAndroidTv.sendKey({ address, key });
}

export async function sendAndroidTvText(address: string, text: string): Promise<void> {
  await NativeAndroidTv.sendText({ address, text });
}

export async function launchAndroidTvApp(address: string, link: string): Promise<void> {
  await NativeAndroidTv.launchApp({ address, link });
}

export async function androidTvState(): Promise<AndroidTvState> {
  return NativeAndroidTv.state();
}

export async function androidTvDiagnostics(): Promise<AndroidTvDiagnostics> {
  return NativeAndroidTv.diagnostics();
}

export async function clearAndroidTvDiagnostics(): Promise<void> {
  await NativeAndroidTv.clearDiagnostics();
}

export async function disconnectAndroidTv(): Promise<void> {
  await NativeAndroidTv.disconnect();
}

/**
 * Attempt to reconnect to a previously-paired Android TV device.
 * Returns `true` if the reconnection succeeds, `false` otherwise.
 */
export async function reconnectAndroidTv(address: string): Promise<boolean> {
  try {
    const result = await NativeAndroidTv.connect({ address });
    return Boolean(result.connected);
  } catch {
    return false;
  }
}
