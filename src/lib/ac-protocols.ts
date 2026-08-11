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

const PROFILES: AcProfile[] = [DAIKIN_ARC];

/** Stateful AC profile for a brand, or null when only discrete codes exist. */
export function acProfileFor(brand: string): AcProfile | null {
  const name = brand.toLowerCase();
  return PROFILES.find((profile) => name.includes(profile.id.split("-")[0] ?? "")) ?? null;
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
