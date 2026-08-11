import type { Key } from "./remote-types";
import { Ir, isNativeRuntime } from "./ir-bridge";

export { isNativeRuntime };

export async function irAvailable(): Promise<{ available: boolean; device: string }> {
  if (!isNativeRuntime()) return { available: false, device: "browser" };
  try {
    return await Ir.isAvailable();
  } catch {
    return { available: false, device: "unknown" };
  }
}

/** NEC protocol timings in microseconds. */
const NEC = {
  frequency: 38000,
  headerMark: 9000,
  headerSpace: 4500,
  bitMark: 560,
  oneSpace: 1690,
  zeroSpace: 560,
};

/** Builds a NEC burst pattern from a 32-bit code (address + command). */
export function necPattern(code: number): number[] {
  const pattern: number[] = [NEC.headerMark, NEC.headerSpace];
  for (let i = 31; i >= 0; i--) {
    const bit = (code >>> i) & 1;
    pattern.push(NEC.bitMark, bit ? NEC.oneSpace : NEC.zeroSpace);
  }
  pattern.push(NEC.bitMark);
  return pattern;
}

/**
 * NEC codes for the most common TV brands. Address byte + inverted address +
 * command + inverted command, packed into 32 bits.
 */
const IR_CODES: Record<string, Partial<Record<Key, number>>> = {
  samsung: {
    power: 0xe0e040bf,
    volup: 0xe0e0e01f,
    voldown: 0xe0e0d02f,
    mute: 0xe0e0f00f,
    chup: 0xe0e048b7,
    chdown: 0xe0e008f7,
    up: 0xe0e006f9,
    down: 0xe0e08679,
    left: 0xe0e0a659,
    right: 0xe0e046b9,
    ok: 0xe0e016e9,
    back: 0xe0e01ae5,
    home: 0xe0e09e61,
    menu: 0xe0e058a7,
    input: 0xe0e0807f,
    info: 0xe0e0f807,
  },
  lg: {
    power: 0x20df10ef,
    volup: 0x20df40bf,
    voldown: 0x20dfc03f,
    mute: 0x20df906f,
    chup: 0x20df00ff,
    chdown: 0x20df807f,
    up: 0x20df02fd,
    down: 0x20df827d,
    left: 0x20dfe01f,
    right: 0x20df609f,
    ok: 0x20df22dd,
    back: 0x20df14eb,
    home: 0x20df3ec1,
    menu: 0x20dfc23d,
    input: 0x20dfd02f,
    info: 0x20df55aa,
  },
  sony: {
    power: 0xa90,
    volup: 0x490,
    voldown: 0xc90,
    mute: 0x290,
    chup: 0x090,
    chdown: 0x890,
    up: 0x2f0,
    down: 0xaf0,
    left: 0x2d0,
    right: 0xcd0,
    ok: 0xa70,
    back: 0x62e9,
    home: 0x70,
    menu: 0x070,
    input: 0xa50,
    info: 0x5d0,
  },
  hisense: {
    power: 0x0dfe,
    volup: 0x0d1e,
    voldown: 0x0d9e,
    mute: 0x0dee,
    chup: 0x0d3e,
    chdown: 0x0dbe,
    up: 0x0d0e,
    down: 0x0d8e,
    left: 0x0d4e,
    right: 0x0dce,
    ok: 0x0d2e,
    back: 0x0d6e,
    home: 0x0d5e,
    menu: 0x0dae,
    input: 0x0d7e,
    info: 0x0dde,
  },
};

const HISENSE = IR_CODES["hisense"]!;
const SONY = IR_CODES["sony"]!;
const SAMSUNG = IR_CODES["samsung"]!;
IR_CODES["tcl"] = HISENSE;
IR_CODES["roku"] = HISENSE;
IR_CODES["androidtv"] = SONY;
IR_CODES["generic"] = SAMSUNG;

export async function sendIr(brand: string, key: Key): Promise<{ ok: boolean; message: string }> {
  if (!isNativeRuntime()) {
    return { ok: false, message: "IR only works in the installed Android app" };
  }
  const code = IR_CODES[brand]?.[key] ?? IR_CODES["generic"]?.[key];
  if (code === undefined) return { ok: false, message: `No IR code for ${key} on ${brand}` };

  try {
    await Ir.transmit({ frequency: NEC.frequency, pattern: necPattern(code) });
    return { ok: true, message: "IR sent" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "IR transmit failed" };
  }
}
