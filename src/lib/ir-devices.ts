/**
 * Saved IR remotes.
 *
 * A saved remote stores everything needed to rebuild the exact IR profile
 * (device type, brand, code set, protocol, carrier and supported commands) so
 * the user never repeats the setup wizard for the same appliance.
 */
import { APPLIANCES, keysFor, type ApplianceKind, type CodeSet, type IrKey } from "./ir-catalog";
import { carrierOf } from "./ir-remote";

export interface SavedIrRemote {
  id: string;
  name: string;
  kind: ApplianceKind;
  brand: string;
  setIndex: number;
  setLabel: string;
  model?: string;
  protocol: string;
  frequency: number;
  commands: IrKey[];
  createdAt: number;
}

const KEY = "remote.ir.saved.v1";

export function loadIrRemotes(): SavedIrRemote[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedIrRemote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(list: SavedIrRemote[]): SavedIrRemote[] {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
  return list;
}

export function saveIrRemote(remote: SavedIrRemote): SavedIrRemote[] {
  const list = loadIrRemotes().filter((item) => item.id !== remote.id);
  return persist([...list, remote]);
}

export function removeIrRemote(id: string): SavedIrRemote[] {
  return persist(loadIrRemotes().filter((item) => item.id !== id));
}

export function renameIrRemote(id: string, name: string): SavedIrRemote[] {
  return persist(loadIrRemotes().map((item) => (item.id === id ? { ...item, name } : item)));
}

/** Rebuilds the live code set for a saved remote (null when data changed). */
export function codeSetFor(remote: {
  kind: ApplianceKind;
  brand: string;
  setIndex: number;
}): CodeSet | null {
  const appliance = APPLIANCES.find((item) => item.kind === remote.kind);
  const brand = appliance?.brands.find((item) => item.name === remote.brand);
  return brand?.sets[remote.setIndex] ?? null;
}

export function buildIrRemote(
  name: string,
  kind: ApplianceKind,
  brand: string,
  setIndex: number,
  set: CodeSet,
): SavedIrRemote {
  return {
    id: `ir-${kind}-${brand}-${setIndex}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
    name,
    kind,
    brand,
    setIndex,
    setLabel: set.label,
    ...(set.model ? { model: set.model } : {}),
    protocol: set.protocol,
    frequency: carrierOf(set),
    commands: keysFor(set),
    createdAt: Date.now(),
  };
}
