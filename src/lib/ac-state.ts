/**
 * Last AC state sent per saved remote.
 *
 * The physical unit cannot be queried, so this is only "the last state this
 * app transmitted" — it is restored on reopen so the frame stays consistent.
 */
import type { AcProfile, AcState } from "./ac-protocols";
import { clampTemp } from "./ac-protocols";

const KEY = "remote.ir.acstate.v1";

type Store = Record<string, AcState>;

function read(): Store {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

export function loadAcState(remoteId: string, profile: AcProfile): AcState {
  const saved = read()[remoteId];
  if (!saved) return profile.defaults;
  const modes = profile.capabilities.modes;
  const fans = profile.capabilities.fans;
  return clampTemp(
    {
      ...profile.defaults,
      ...saved,
      mode: modes.includes(saved.mode) ? saved.mode : profile.defaults.mode,
      fan: fans.includes(saved.fan) ? saved.fan : profile.defaults.fan,
    },
    profile.capabilities,
  );
}

export function saveAcState(remoteId: string, state: AcState): void {
  try {
    const store = read();
    store[remoteId] = state;
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage unavailable */
  }
}
