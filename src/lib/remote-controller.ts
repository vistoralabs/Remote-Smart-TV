/**
 * RemoteController — one façade, two transports.
 *
 * Wi-Fi keeps using the existing Android TV / Xstream pairing stack untouched;
 * IR goes through the phone's blaster. UI code talks to a transport, never to
 * the wire protocol directly.
 */
import type { Device, Key } from "./remote-types";
import { sendKey } from "./transports";
import { sendIrKey } from "./ir-remote";
import { codeSetFor, type SavedIrRemote } from "./ir-devices";
import type { IrKey } from "./ir-catalog";

export type RemoteResult = { ok: boolean; message: string };

export interface RemoteTransport {
  kind: "wifi" | "ir";
  /** "Connected" for Wi-Fi, "IR Ready" for the blaster. */
  statusKind: "connected" | "ready";
  send: (command: string) => Promise<RemoteResult>;
  supports: (command: string) => boolean;
}

export function wifiRemoteTransport(device: Device | null): RemoteTransport {
  return {
    kind: "wifi",
    statusKind: "connected",
    supports: () => true,
    send: (command) => sendKey(device, command as Key),
  };
}

export function irRemoteTransport(remote: SavedIrRemote): RemoteTransport {
  const set = codeSetFor(remote);
  return {
    kind: "ir",
    statusKind: "ready",
    supports: (command) => !!set && set.codes[command as IrKey] !== undefined,
    send: async (command) => {
      if (!set) return { ok: false, message: "This saved remote is no longer available" };
      if (set.codes[command as IrKey] === undefined) {
        return { ok: false, message: "This code set does not support that button" };
      }
      return sendIrKey(set, command as IrKey, { brand: remote.brand, kind: remote.kind });
    },
  };
}
