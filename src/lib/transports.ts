import { ROKU_KEYMAP, type Device, type Key, type Transport } from "./remote-types";
import { isNativeRuntime, sendIr } from "./native-ir";
import {
  hasNativeBluetooth,
  pairNativeBluetooth,
  scanNativeBluetooth,
  sendNativeBluetoothKey,
  type NativeBluetoothDevice,
} from "./native-bluetooth";
import { hasNativeAndroidTv, sendAndroidTvKey, sendAndroidTvText } from "./native-android-tv";

/** Minimal Web Bluetooth surface we rely on (not in the default TS DOM lib). */
interface BleGatt {
  connected: boolean;
  connect: () => Promise<unknown>;
}
interface BleDevice {
  id: string;
  name?: string;
  gatt?: BleGatt;
}
interface BleApi {
  requestDevice: (opts: {
    acceptAllDevices?: boolean;
    optionalServices?: string[];
  }) => Promise<BleDevice>;
}

function getBle(): BleApi | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { bluetooth?: BleApi }).bluetooth ?? null;
}

export interface Capability {
  transport: Transport;
  available: boolean;
  reason: string;
}

/** Runtime capability probe. Must only be called on the client. */
export function probeCapabilities(): Capability[] {
  return [
    {
      transport: "wifi",
      available: true,
      reason: hasNativeAndroidTv()
        ? "Android TV, Google TV and set-top boxes are discovered and paired over the same Wi-Fi. Roku also works directly."
        : "Roku works in the browser. Android TV / Google TV discovery and secure pairing work in the installed app.",
    },
  ];
}

export interface SendResult {
  ok: boolean;
  message: string;
}

async function sendRoku(address: string, key: Key): Promise<SendResult> {
  const ecp = ROKU_KEYMAP[key];
  if (!ecp) return { ok: false, message: `Key "${key}" is not mapped for Roku` };
  const base = address.startsWith("http") ? address : `http://${address}:8060`;
  try {
    await fetch(`${base}/keypress/${ecp}`, { method: "POST", mode: "no-cors" });
    return { ok: true, message: ecp };
  } catch {
    return { ok: false, message: "TV did not answer on the network" };
  }
}

let bleDevice: BleDevice | null = null;

export async function scanBluetoothDevices(): Promise<NativeBluetoothDevice[]> {
  if (hasNativeBluetooth()) return scanNativeBluetooth();
  const paired = await pairBluetooth();
  return [{ ...paired, bonded: true }];
}

export async function pairBluetoothDevice(address: string): Promise<void> {
  if (hasNativeBluetooth()) await pairNativeBluetooth(address);
}

export async function pairBluetooth(): Promise<{ id: string; name: string }> {
  const ble = getBle();
  if (!ble) {
    throw new Error("Bluetooth is not available in this browser");
  }
  const device = await ble.requestDevice({
    acceptAllDevices: true,
    optionalServices: ["human_interface_device"],
  });
  bleDevice = device;
  return { id: device.id, name: device.name ?? "Bluetooth device" };
}

async function sendBluetooth(address: string, key: Key): Promise<SendResult> {
  if (hasNativeBluetooth()) {
    try {
      await sendNativeBluetoothKey(address, key);
      return { ok: true, message: "Bluetooth key sent" };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Bluetooth key failed",
      };
    }
  }
  if (!bleDevice) return { ok: false, message: "Pair a Bluetooth device first" };
  try {
    if (!bleDevice.gatt?.connected) await bleDevice.gatt?.connect();
    // Consumer-control HID reports are blocked for web pages; the native build
    // sends the real report here.
    return {
      ok: false,
      message: "Paired, but Android blocks HID keys from a web page — needs the native build",
    };
  } catch {
    return { ok: false, message: "Bluetooth link dropped" };
  }
}

export async function sendKey(device: Device | null, key: Key): Promise<SendResult> {
  if (!device) return { ok: false, message: "No device selected" };

  if (device.transport === "wifi") {
    if (device.brand === "roku" || device.brand === "tcl") return sendRoku(device.address, key);
    if (device.brand === "androidtv" && hasNativeAndroidTv()) {
      try {
        await sendAndroidTvKey(device.address, key);
        return { ok: true, message: "Android TV key sent" };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : "Android TV did not answer",
        };
      }
    }
    return {
      ok: false,
      message: `${device.brand} Wi-Fi control is not available for this device — try IR instead`,
    };
  }
  if (device.transport === "bluetooth") return sendBluetooth(device.address, key);
  return sendIr(device.brand, key);
}

// ---------------------------------------------------------------------------
// App launching and media casting
// ---------------------------------------------------------------------------

function isRokuLike(device: Device): boolean {
  return device.transport === "wifi" && (device.brand === "roku" || device.brand === "tcl");
}

function rokuBase(address: string): string {
  return address.startsWith("http") ? address : `http://${address}:8060`;
}

export async function launchApp(
  device: Device | null,
  app: { name: string; roku?: string; pkg?: string },
): Promise<SendResult> {
  if (!device) return { ok: false, message: "No device selected" };
  if (isRokuLike(device) && app.roku) {
    try {
      await fetch(`${rokuBase(device.address)}/launch/${app.roku}`, {
        method: "POST",
        mode: "no-cors",
      });
      return { ok: true, message: `${app.name} opening on TV` };
    } catch {
      return { ok: false, message: "TV did not answer on the network" };
    }
  }
  if (device.transport === "wifi") {
    return {
      ok: false,
      message: `${app.name} launching needs the paired session for this brand`,
    };
  }
  return {
    ok: false,
    message: "App launching works over Wi-Fi — Bluetooth and IR only send remote keys",
  };
}

export type MediaKind = "video" | "audio" | "photo";

const ROKU_MEDIA_TYPE: Record<MediaKind, string> = { video: "v", audio: "a", photo: "p" };

export async function castMedia(
  device: Device | null,
  url: string,
  kind: MediaKind,
): Promise<SendResult> {
  if (!device) return { ok: false, message: "No device selected" };
  if (!isRokuLike(device)) {
    return {
      ok: false,
      message: "Direct casting works on Roku and TCL Roku TVs — other brands open apps instead",
    };
  }
  const base = rokuBase(device.address);
  if (url === "youtube") {
    return launchApp(device, { name: "YouTube", roku: "837" });
  }
  try {
    const target = `${base}/launch/15985?t=${ROKU_MEDIA_TYPE[kind]}&u=${encodeURIComponent(url)}`;
    await fetch(target, { method: "POST", mode: "no-cors" });
    return { ok: true, message: "Playing on TV" };
  } catch {
    return { ok: false, message: "TV did not answer on the network" };
  }
}

/** Types text on the device. Only the Android TV protocol supports it. */
export async function sendText(device: Device | null, text: string): Promise<SendResult> {
  if (!device) return { ok: false, message: "No device selected" };
  if (device.transport === "wifi" && device.brand === "androidtv" && hasNativeAndroidTv()) {
    try {
      await sendAndroidTvText(device.address, text);
      return { ok: true, message: "Text sent" };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "The box did not accept the text",
      };
    }
  }
  return {
    ok: false,
    message: "Typing works on Android TV devices paired over Wi-Fi",
  };
}
