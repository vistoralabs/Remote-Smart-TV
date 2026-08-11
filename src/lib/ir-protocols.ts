/**
 * IR pattern encoders for the code database.
 *
 * Every function returns a Consumer-IR burst pattern in microseconds
 * (mark, space, mark, space, …) plus the carrier frequency. The parameter
 * naming follows the irdb convention: protocol + device + subdevice + function.
 */
export interface IrBurst {
  frequency: number;
  pattern: number[];
}

export interface CapturedIrBurst {
  f: number;
  t: number[];
}

/** Protocols the phone's emitter can reproduce from raw timings. */
export type IrProtocol =
  "nec1" | "necx" | "rc5" | "sony12" | "sony15" | "sony20" | "panasonic" | "jvc";

function lsbBits(
  value: number,
  count: number,
  pattern: number[],
  mark: number,
  one: number,
  zero: number,
): void {
  for (let i = 0; i < count; i++) {
    pattern.push(mark, (value >>> i) & 1 ? one : zero);
  }
}

const NEC = { frequency: 38000, mark: 564, one: 1692, zero: 564 };

/** NEC / NEC1 / NEC2 — 9 ms header, then device, subdevice, function, ~function. */
export function encodeNec1(device: number, subdevice: number, fn: number): IrBurst {
  const sub = subdevice < 0 ? ~device & 0xff : subdevice & 0xff;
  const pattern = [9000, 4500];
  lsbBits(device & 0xff, 8, pattern, NEC.mark, NEC.one, NEC.zero);
  lsbBits(sub, 8, pattern, NEC.mark, NEC.one, NEC.zero);
  lsbBits(fn & 0xff, 8, pattern, NEC.mark, NEC.one, NEC.zero);
  lsbBits(~fn & 0xff, 8, pattern, NEC.mark, NEC.one, NEC.zero);
  pattern.push(NEC.mark);
  return { frequency: NEC.frequency, pattern };
}

/** NECx / extended NEC — 9 ms header and a full 16-bit address. */
export function encodeNecx(device: number, subdevice: number, fn: number): IrBurst {
  const sub = subdevice < 0 ? device & 0xff : subdevice & 0xff;
  const pattern = [9000, 4500];
  lsbBits(device & 0xff, 8, pattern, NEC.mark, NEC.one, NEC.zero);
  lsbBits(sub, 8, pattern, NEC.mark, NEC.one, NEC.zero);
  lsbBits(fn & 0xff, 8, pattern, NEC.mark, NEC.one, NEC.zero);
  lsbBits(~fn & 0xff, 8, pattern, NEC.mark, NEC.one, NEC.zero);
  pattern.push(NEC.mark);
  return { frequency: NEC.frequency, pattern };
}

const SONY = { frequency: 40000, header: 2400, space: 600, one: 1200, zero: 600 };

/** Sony SIRC 12/15/20 bit — 7 function bits, then device (and subdevice on 20). */
export function encodeSony(
  bits: 12 | 15 | 20,
  device: number,
  subdevice: number,
  fn: number,
): IrBurst {
  const pattern = [SONY.header, SONY.space];
  const push = (value: number, count: number) => {
    for (let i = 0; i < count; i++) {
      pattern.push((value >>> i) & 1 ? SONY.one : SONY.zero, SONY.space);
    }
  };
  push(fn & 0x7f, 7);
  if (bits === 12) push(device & 0x1f, 5);
  else if (bits === 15) push(device & 0xff, 8);
  else {
    push(device & 0x1f, 5);
    push(subdevice < 0 ? 0 : subdevice & 0xff, 8);
  }
  pattern.pop(); // drop the trailing space
  return { frequency: SONY.frequency, pattern };
}

const RC5_HALF = 889;

/** Philips RC5 — 14 bits, Manchester coded at 36 kHz. */
export function encodeRc5(device: number, fn: number, toggle = 0): IrBurst {
  const bits: number[] = [1, fn > 63 ? 0 : 1, toggle & 1];
  for (let i = 4; i >= 0; i--) bits.push((device >>> i) & 1);
  for (let i = 5; i >= 0; i--) bits.push((fn >>> i) & 1);

  const levels: number[] = [];
  for (const bit of bits) {
    if (bit) levels.push(0, 1);
    else levels.push(1, 0);
  }
  // The first half-bit of the start bit is always a mark, so drop the leading
  // space that the Manchester expansion produces and start on the mark.
  levels.shift();
  const pattern: number[] = [];
  let current = 1;
  let run = 0;
  for (const level of levels) {
    if (level === current) run += RC5_HALF;
    else {
      pattern.push(run);
      current = level;
      run = RC5_HALF;
    }
  }
  pattern.push(run);
  return { frequency: 36000, pattern };
}

const PANA = { frequency: 37000, mark: 432, one: 1296, zero: 432 };

/** Panasonic / Kaseikyo — 48 bits with a trailing XOR checksum. */
export function encodePanasonic(device: number, subdevice: number, fn: number): IrBurst {
  const d = device & 0xff;
  const s = subdevice < 0 ? 0 : subdevice & 0xff;
  const f = fn & 0xff;
  const bytes = [0x02, 0x20, d, s, f, d ^ s ^ f];
  const pattern = [3456, 1728];
  for (const byte of bytes) lsbBits(byte, 8, pattern, PANA.mark, PANA.one, PANA.zero);
  pattern.push(PANA.mark);
  return { frequency: PANA.frequency, pattern };
}

const JVC = { frequency: 38000, mark: 526, one: 1574, zero: 526 };

/** JVC — 8 device bits + 8 function bits after a single 8.4 ms header. */
export function encodeJvc(device: number, fn: number): IrBurst {
  const pattern = [8400, 4200];
  lsbBits(device & 0xff, 8, pattern, JVC.mark, JVC.one, JVC.zero);
  lsbBits(fn & 0xff, 8, pattern, JVC.mark, JVC.one, JVC.zero);
  pattern.push(JVC.mark);
  return { frequency: JVC.frequency, pattern };
}

export function encode(
  protocol: IrProtocol,
  device: number,
  subdevice: number,
  fn: number,
): IrBurst {
  switch (protocol) {
    case "necx":
      return encodeNecx(device, subdevice, fn);
    case "rc5":
      return encodeRc5(device, fn);
    case "sony12":
      return encodeSony(12, device, subdevice, fn);
    case "sony15":
      return encodeSony(15, device, subdevice, fn);
    case "sony20":
      return encodeSony(20, device, subdevice, fn);
    case "panasonic":
      return encodePanasonic(device, subdevice, fn);
    case "jvc":
      return encodeJvc(device, fn);
    case "nec1":
    default:
      return encodeNec1(device, subdevice, fn);
  }
}
