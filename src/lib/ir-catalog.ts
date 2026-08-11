import irData from "./ir-data.json";
import type { CapturedIrBurst, IrProtocol } from "./ir-protocols";

/**
 * Universal IR code catalogue.
 *
 * The data file is generated from the public-domain irdb collection
 * (see scripts/build-ir-db.mjs), so every code set here is a real remote that
 * has been captured from hardware — no invented addresses. A brand can expose
 * several numbered sets ("Remote 1, 2, 3 …") exactly like a shop-bought
 * universal remote: try them until the appliance reacts.
 */
export type IrKey =
  | "power"
  | "poweroff"
  | "input"
  | "mute"
  | "volup"
  | "voldown"
  | "chup"
  | "chdown"
  | "up"
  | "down"
  | "left"
  | "right"
  | "ok"
  | "back"
  | "home"
  | "menu"
  | "exit"
  | "guide"
  | "info"
  | "play"
  | "pause"
  | "stop"
  | "rew"
  | "ff"
  | "prev"
  | "next"
  | "rec"
  | "eject"
  | "sleep"
  | "subtitle"
  | "audiotrack"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "tempup"
  | "tempdown"
  | "mode"
  | "fan"
  | "swing"
  | "timer"
  | "speed"
  | "d1"
  | "d2"
  | "d3"
  | "d4"
  | "d5"
  | "d6"
  | "d7"
  | "d8"
  | "d9"
  | "d0";

export type ApplianceKind = "tv" | "stb" | "ac" | "audio" | "dvd" | "projector" | "fan";

export type IrSignal = number | CapturedIrBurst;

export interface CodeSet {
  /** "Remote 1", "Remote 2" … shown to the user. */
  label: string;
  model?: string;
  protocol: IrProtocol;
  device: number;
  subdevice: number;
  codes: Partial<Record<IrKey, IrSignal>>;
}

export interface IrBrand {
  name: string;
  sets: CodeSet[];
}

export interface Appliance {
  kind: ApplianceKind;
  label: string;
  brands: IrBrand[];
}

interface RawSet {
  p: string;
  d: number;
  s: number;
  k: Record<string, IrSignal>;
  m?: string;
}

const KIND_LABEL: Record<ApplianceKind, string> = {
  tv: "TV",
  stb: "Set-top box",
  ac: "Air conditioner",
  audio: "Home theatre / Audio",
  dvd: "DVD / Blu-ray",
  projector: "Projector",
  fan: "Fan / Air cooler",
};

const KIND_ORDER: ApplianceKind[] = ["tv", "stb", "audio", "dvd", "projector", "fan", "ac"];

/** Order buttons follow on screen; unknown keys are dropped. */
export const KEY_ORDER: IrKey[] = [
  "power",
  "poweroff",
  "input",
  "mute",
  "volup",
  "voldown",
  "chup",
  "chdown",
  "up",
  "down",
  "left",
  "right",
  "ok",
  "back",
  "home",
  "menu",
  "exit",
  "guide",
  "info",
  "play",
  "pause",
  "stop",
  "rew",
  "ff",
  "prev",
  "next",
  "rec",
  "eject",
  "sleep",
  "subtitle",
  "audiotrack",
  "red",
  "green",
  "yellow",
  "blue",
  "tempup",
  "tempdown",
  "mode",
  "fan",
  "swing",
  "timer",
  "speed",
  "d1",
  "d2",
  "d3",
  "d4",
  "d5",
  "d6",
  "d7",
  "d8",
  "d9",
  "d0",
];

const KEY_SET = new Set<string>(KEY_ORDER);

function buildAppliances(): Appliance[] {
  const raw = irData as unknown as Record<string, { n: string; r: RawSet[] }[]>;
  const out: Appliance[] = [];
  for (const kind of KIND_ORDER) {
    const brands = raw[kind];
    if (!brands?.length) continue;
    out.push({
      kind,
      label: KIND_LABEL[kind],
      brands: brands.map((brand) => ({
        name: brand.n,
        sets: brand.r.map((set, index) => {
          const codes: Partial<Record<IrKey, IrSignal>> = {};
          for (const [key, value] of Object.entries(set.k)) {
            if (KEY_SET.has(key)) codes[key as IrKey] = value;
          }
          return {
            label: `Remote ${index + 1}`,
            ...(set.m ? { model: set.m } : {}),
            protocol: set.p as IrProtocol,
            device: set.d,
            subdevice: set.s,
            codes,
          };
        }),
      })),
    });
  }
  return out;
}

export const APPLIANCES: Appliance[] = buildAppliances();

/** Buttons the given code set can actually send, in display order. */
export function keysFor(set: CodeSet): IrKey[] {
  return KEY_ORDER.filter((key) => set.codes[key] !== undefined);
}

export const IR_KEY_LABEL: Record<IrKey, string> = {
  power: "Power",
  poweroff: "Off",
  input: "Input",
  mute: "Mute",
  volup: "Vol +",
  voldown: "Vol −",
  chup: "CH +",
  chdown: "CH −",
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
  ok: "OK",
  back: "Back",
  home: "Home",
  menu: "Menu",
  exit: "Exit",
  guide: "Guide",
  info: "Info",
  play: "Play",
  pause: "Pause",
  stop: "Stop",
  rew: "Rew",
  ff: "Fwd",
  prev: "Prev",
  next: "Next",
  rec: "Rec",
  eject: "Eject",
  sleep: "Sleep",
  subtitle: "Sub",
  audiotrack: "Audio",
  red: "Red",
  green: "Green",
  yellow: "Yellow",
  blue: "Blue",
  tempup: "Temp +",
  tempdown: "Temp −",
  mode: "Mode",
  fan: "Fan",
  swing: "Swing",
  timer: "Timer",
  speed: "Speed",
  d1: "1",
  d2: "2",
  d3: "3",
  d4: "4",
  d5: "5",
  d6: "6",
  d7: "7",
  d8: "8",
  d9: "9",
  d0: "0",
};
