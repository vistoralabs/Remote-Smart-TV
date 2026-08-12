/**
 * Stateful air-conditioner IR protocols.
 *
 * Unlike a TV, an AC does not send one pulse per button: every press
 * re-transmits a complete frame that carries the whole state (power, mode,
 * temperature, fan, swing…). A profile therefore exposes:
 *  - the capabilities it can really encode, and
 *  - a builder that turns an `AcState` into a carrier + pulse pattern.
 *
 * Only profiles implemented here get the full AC remote. Brands without a
 * frame builder keep the discrete-code remote so no button is ever fake.
 */

export type AcMode = "auto" | "cool" | "dry" | "fan" | "heat";
export type AcFan = "auto" | "quiet" | "1" | "2" | "3" | "4" | "5";

export interface AcState {
  power: boolean;
  temperature: number;
  mode: AcMode;
  fan: AcFan;
  swing: boolean;
  turbo: boolean;
  eco: boolean;
}

export interface AcCapabilities {
  minTemp: number;
  maxTemp: number;
  modes: AcMode[];
  fans: AcFan[];
  swing: boolean;
  turbo: boolean;
  eco: boolean;
}

export interface AcProfile {
  id: string;
  label: string;
  /** Human readable protocol name, shown in diagnostics. */
  protocol: string;
  frequency: number;
  capabilities: AcCapabilities;
  /** Complete frame for the given state, in microseconds. */
  build: (state: AcState) => number[];
  defaults: AcState;
}

/* ------------------------------------------------------------------ */
/* Daikin ARC (classic 35-byte, three-section frame)                  */
/* ------------------------------------------------------------------ */

const DAIKIN = {
  frequency: 38000,
  headerMark: 3650,
  headerSpace: 1623,
  bitMark: 428,
  oneSpace: 1280,
  zeroSpace: 428,
  gap: 29000,
};

const DAIKIN_MODE: Record<AcMode, number> = { auto: 0, dry: 2, cool: 3, heat: 4, fan: 6 };
const DAIKIN_FAN: Record<AcFan, number> = {
  auto: 0xa,
  quiet: 0xb,
  "1": 0x3,
  "2": 0x4,
  "3": 0x5,
  "4": 0x6,
  "5": 0x7,
};

function checksum(bytes: number[]): number {
  return bytes.reduce((sum, byte) => (sum + byte) & 0xff, 0);
}

function pushByteLsb(pattern: number[], byte: number): void {
  for (let i = 0; i < 8; i++) {
    pattern.push(DAIKIN.bitMark, (byte >>> i) & 1 ? DAIKIN.oneSpace : DAIKIN.zeroSpace);
  }
}

function daikinSection(bytes: number[]): number[] {
  const withChecksum = [...bytes, checksum(bytes)];
  const pattern: number[] = [DAIKIN.headerMark, DAIKIN.headerSpace];
  for (const byte of withChecksum) pushByteLsb(pattern, byte);
  pattern.push(DAIKIN.bitMark, DAIKIN.gap);
  return pattern;
}

function buildDaikin(state: AcState): number[] {
  const temp = Math.min(32, Math.max(10, Math.round(state.temperature)));

  const s1 = [0x11, 0xda, 0x27, 0x00, 0xc5, 0x00, 0x00];
  const s2 = [0x11, 0xda, 0x27, 0x00, 0x42, 0x00, 0x00];

  const s3 = [
    0x11, 0xda, 0x27, 0x00, 0x00,
    (DAIKIN_MODE[state.mode] << 4) | (state.power ? 0x01 : 0x00),
    temp << 1,
    0x00,
    (DAIKIN_FAN[state.fan] << 4) | (state.swing ? 0x0f : 0x00),
    0x00, 0x00, 0x06, 0x60, 0x00, 0x00, 0xc0, 0x00, 0x00,
  ];
  // Powerful (turbo) and econo live in the tail bytes of section three.
  if (state.turbo) s3[13] = (s3[13] ?? 0) | 0x01;
  if (state.eco) s3[16] = (s3[16] ?? 0) | 0x04;

  const pattern = [...daikinSection(s1), ...daikinSection(s2), ...daikinSection(s3)];
  // ConsumerIrManager needs the burst to end on a mark.
  if (pattern.length % 2 === 0) pattern.pop();
  return pattern;
}

const DAIKIN_ARC: AcProfile = {
  id: "daikin-arc",
  label: "Daikin ARC",
  protocol: "daikin-arc (35 byte / 3 frame)",
  frequency: DAIKIN.frequency,
  capabilities: {
    minTemp: 18,
    maxTemp: 32,
    modes: ["auto", "cool", "dry", "fan", "heat"],
    fans: ["auto", "quiet", "1", "2", "3", "4", "5"],
    swing: true,
    turbo: true,
    eco: true,
  },
  build: buildDaikin,
  defaults: {
    power: true,
    temperature: 24,
    mode: "cool",
    fan: "auto",
    swing: false,
    turbo: false,
    eco: false,
  },
};

/* ------------------------------------------------------------------ */
/* LG AC (28-bit frame protocol)                                      */
/* ------------------------------------------------------------------ */
function buildLgAc(state: AcState): number[] {
  const pattern: number[] = [3200, 3200];
  const temp = Math.min(30, Math.max(18, Math.round(state.temperature)));
  const modeVal = state.mode === "cool" ? 0 : state.mode === "dry" ? 1 : state.mode === "fan" ? 2 : state.mode === "heat" ? 4 : 0;
  const fanVal = state.fan === "auto" ? 5 : state.fan === "1" ? 0 : state.fan === "2" ? 2 : 4;
  const pwrVal = state.power ? 0 : 1;

  // 28-bit payload: [0x88] [pwr/mode] [temp-15] [fan]
  const b1 = 0x88;
  const b2 = (pwrVal << 3) | (modeVal & 0x07);
  const b3 = ((temp - 15) & 0x0f) << 4 | (fanVal & 0x0f);
  const crc = (b1 + b2 + b3) & 0x0f;

  const payload = (b1 << 20) | (b2 << 16) | (b3 << 8) | crc;

  for (let i = 27; i >= 0; i--) {
    const bit = (payload >>> i) & 1;
    pattern.push(500, bit ? 1600 : 550);
  }
  pattern.push(500, 10000);
  return pattern;
}

const LG_AC: AcProfile = {
  id: "lg-ac",
  label: "LG AC",
  protocol: "lg-ac (28 bit frame)",
  frequency: 38000,
  capabilities: {
    minTemp: 18,
    maxTemp: 30,
    modes: ["auto", "cool", "dry", "fan", "heat"],
    fans: ["auto", "1", "2", "3", "4"],
    swing: true,
    turbo: true,
    eco: false,
  },
  build: buildLgAc,
  defaults: {
    power: true,
    temperature: 24,
    mode: "cool",
    fan: "auto",
    swing: false,
    turbo: false,
    eco: false,
  },
};

/* ------------------------------------------------------------------ */
/* Samsung AC (14-byte frame protocol)                                */
/* ------------------------------------------------------------------ */
function buildSamsungAc(state: AcState): number[] {
  const pattern: number[] = [3000, 8900];
  const temp = Math.min(30, Math.max(16, Math.round(state.temperature)));
  const modeVal = state.mode === "cool" ? 1 : state.mode === "dry" ? 2 : state.mode === "fan" ? 3 : state.mode === "heat" ? 4 : 0;
  const fanVal = state.fan === "auto" ? 0 : state.fan === "1" ? 2 : state.fan === "2" ? 4 : 5;

  const bytes = [
    0x02, 0x92, 0x0f, 0x00, 0x00, 0x00, 0x00,
    0x01, 0x02, (modeVal << 4) | (state.power ? 0x01 : 0x00),
    ((temp - 16) & 0x0f) << 4 | (fanVal & 0x0f),
    0x00, 0x00, 0x00
  ];

  for (const b of bytes) {
    for (let i = 0; i < 8; i++) {
      const bit = (b >>> i) & 1;
      pattern.push(560, bit ? 1600 : 560);
    }
  }
  pattern.push(560, 15000);
  return pattern;
}

const SAMSUNG_AC: AcProfile = {
  id: "samsung-ac",
  label: "Samsung AC",
  protocol: "samsung-ac (14 byte frame)",
  frequency: 38000,
  capabilities: {
    minTemp: 16,
    maxTemp: 30,
    modes: ["auto", "cool", "dry", "fan", "heat"],
    fans: ["auto", "1", "2", "3"],
    swing: true,
    turbo: true,
    eco: true,
  },
  build: buildSamsungAc,
  defaults: {
    power: true,
    temperature: 24,
    mode: "cool",
    fan: "auto",
    swing: false,
    turbo: false,
    eco: false,
  },
};

const PROFILES: AcProfile[] = [DAIKIN_ARC, LG_AC, SAMSUNG_AC];

/** Stateful AC profile for a brand, or null when only discrete codes exist. */
export function acProfileFor(brand: string): AcProfile | null {
  const name = brand.toLowerCase().trim();
  if (name.includes("daikin")) return DAIKIN_ARC;
  if (name.includes("lg")) return LG_AC;
  if (name.includes("samsung")) return SAMSUNG_AC;
  return PROFILES.find((p) => name.includes(p.id.split("-")[0] ?? "")) ?? null;
}

export const AC_MODE_LABEL: Record<AcMode, string> = {
  auto: "Auto",
  cool: "Cool",
  dry: "Dry",
  fan: "Fan",
  heat: "Heat",
};

export const AC_FAN_LABEL: Record<AcFan, string> = {
  auto: "Auto",
  quiet: "Quiet",
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
};

export function clampTemp(state: AcState, capabilities: AcCapabilities): AcState {
  return {
    ...state,
    temperature: Math.min(capabilities.maxTemp, Math.max(capabilities.minTemp, state.temperature)),
  };
}
