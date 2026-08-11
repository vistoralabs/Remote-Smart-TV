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
  localIp?: string | null;
  lastError?: string | null;
}

export interface AndroidTvDiagnostics {
  appVersion: string;
  time: string;
  localIp?: string | null;
  pairingStage: string;
  pairing: boolean;
  connected: boolean;
  host?: string | null;
  log: string[];
}

interface NativeAndroidTvPlugin {
  scan: () => Promise<{ devices: AndroidTvDevice[]; localIp?: string | null }>;
  startPairing: (options: { address: string }) => Promise<{ codeRequired: boolean }>;
  finishPairing: (options: { code: string }) => Promise<{ paired: boolean }>;
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
