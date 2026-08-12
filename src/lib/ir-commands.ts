/**
 * IR command model + per-device-type remote layouts.
 *
 * UI components never hardcode buttons: they ask for the layout of a device
 * type, then render only the commands the selected code set actually supports.
 */
import type { ApplianceKind, CodeSet, IrKey } from "./ir-catalog";
import { IR_KEY_LABEL, keysFor } from "./ir-catalog";

/** Stable command identifiers used across the app. */
export const IRCommand = {
  POWER: "power",
  POWER_OFF: "poweroff",
  MUTE: "mute",
  VOLUME_UP: "volup",
  VOLUME_DOWN: "voldown",
  CHANNEL_UP: "chup",
  CHANNEL_DOWN: "chdown",
  NAV_UP: "up",
  NAV_DOWN: "down",
  NAV_LEFT: "left",
  NAV_RIGHT: "right",
  OK: "ok",
  BACK: "back",
  HOME: "home",
  MENU: "menu",
  INPUT: "input",
  INFO: "info",
  GUIDE: "guide",
  EXIT: "exit",
  PLAY: "play",
  PAUSE: "pause",
  STOP: "stop",
  REWIND: "rew",
  FORWARD: "ff",
  PREVIOUS: "prev",
  NEXT: "next",
  RECORD: "rec",
  EJECT: "eject",
  SLEEP: "sleep",
  SUBTITLE: "subtitle",
  AUDIO_TRACK: "audiotrack",
  AC_TEMP_UP: "tempup",
  AC_TEMP_DOWN: "tempdown",
  AC_MODE: "mode",
  AC_FAN: "fan",
  AC_SWING: "swing",
  AC_TIMER: "timer",
  AC_SPEED: "speed",
} as const satisfies Record<string, IrKey>;

export type IrCommandName = keyof typeof IRCommand;

/** Keys that make sense to auto-repeat while held / tapped rapidly. */
export const REPEATABLE: IrKey[] = ["volup", "voldown", "chup", "chdown", "tempup", "tempdown"];

export interface IrSection {
  /** Short heading shown above the group; empty for the primary row. */
  title: string;
  cols: number;
  keys: IrKey[];
  /** Big keys (D-pad, OK, power) get taller cells. */
  large?: boolean;
}

const NAV: IrSection = {
  title: "Navigation",
  cols: 3,
  large: true,
  keys: ["up", "left", "ok", "right", "down"],
};

const DIGITS: IrSection = {
  title: "Channels",
  cols: 3,
  keys: ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9", "d0"],
};

const MEDIA: IrSection = {
  title: "Playback",
  cols: 4,
  keys: ["play", "pause", "stop", "rew", "ff", "prev", "next", "rec", "eject"],
};

const LAYOUTS: Record<ApplianceKind, IrSection[]> = {
  tv: [
    { title: "", cols: 4, keys: ["power", "poweroff", "input", "mute"] },
    { title: "Volume & channel", cols: 4, keys: ["volup", "voldown", "chup", "chdown"] },
    NAV,
    { title: "Keys", cols: 4, keys: ["back", "home", "menu", "exit", "guide", "info", "subtitle", "audiotrack", "sleep"] },
    DIGITS,
    { title: "Colour keys", cols: 4, keys: ["red", "green", "yellow", "blue"] },
    MEDIA,
  ],
  stb: [
    { title: "", cols: 4, keys: ["power", "poweroff", "input", "mute"] },
    { title: "Volume & channel", cols: 4, keys: ["volup", "voldown", "chup", "chdown"] },
    NAV,
    { title: "Keys", cols: 4, keys: ["back", "home", "menu", "guide", "info", "exit", "subtitle", "audiotrack"] },
    DIGITS,
    MEDIA,
  ],
  ac: [
    { title: "", cols: 3, keys: ["power", "poweroff", "mode"] },
    { title: "Temperature", cols: 2, large: true, keys: ["tempup", "tempdown"] },
    { title: "Air", cols: 4, keys: ["fan", "speed", "swing", "timer", "sleep"] },
  ],
  audio: [
    { title: "", cols: 4, keys: ["power", "poweroff", "input", "mute"] },
    { title: "Volume", cols: 2, large: true, keys: ["volup", "voldown"] },
    NAV,
    { title: "Keys", cols: 4, keys: ["menu", "back", "info", "audiotrack", "sleep"] },
    MEDIA,
    DIGITS,
  ],
  dvd: [
    { title: "", cols: 4, keys: ["power", "poweroff", "input", "eject"] },
    MEDIA,
    NAV,
    { title: "Keys", cols: 4, keys: ["menu", "back", "home", "info", "subtitle", "audiotrack", "exit"] },
    DIGITS,
  ],
  projector: [
    { title: "", cols: 4, keys: ["power", "poweroff", "input", "mute"] },
    NAV,
    { title: "Keys", cols: 4, keys: ["menu", "back", "exit", "info", "volup", "voldown"] },
  ],
  fan: [
    { title: "", cols: 3, keys: ["power", "poweroff", "mode"] },
    { title: "Air", cols: 4, keys: ["speed", "fan", "swing", "timer", "sleep"] },
  ],
};

/** Sections for a device type, with unsupported commands removed. */
export function layoutFor(kind: ApplianceKind, set: CodeSet): IrSection[] {
  return LAYOUTS[kind]
    .map((section) => ({
      ...section,
      keys: section.keys.filter((key) => set.codes[key] !== undefined),
    }))
    .filter((section) => section.keys.length > 0);
}

export function commandLabel(key: IrKey): string {
  return IR_KEY_LABEL[key];
}

/** The key used for a power test on this code set. Falls back to any available functional key if power is omitted. */
export function powerKey(set: CodeSet): IrKey | null {
  if (set.codes.power !== undefined) return "power";
  if (set.codes.poweroff !== undefined) return "poweroff";
  if (set.codes.mode !== undefined) return "mode";
  if (set.codes.tempup !== undefined) return "tempup";
  if (set.codes.speed !== undefined) return "speed";
  if (set.codes.volup !== undefined) return "volup";
  if (set.codes.mute !== undefined) return "mute";
  if (set.codes.ok !== undefined) return "ok";
  if (set.codes.input !== undefined) return "input";
  if (set.codes.up !== undefined) return "up";
  const available = keysFor(set);
  return available.length > 0 ? available[0]! : null;
}
