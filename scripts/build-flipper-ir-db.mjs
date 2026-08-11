#!/usr/bin/env node
/**
 * Builds the bundled IR catalogue from Flipper-IRDB (CC0-1.0).
 * Usage: node scripts/build-flipper-ir-db.mjs /path/to/Flipper-IRDB
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const ROOT = process.argv[2];
if (!ROOT) throw new Error("usage: build-flipper-ir-db.mjs <Flipper-IRDB dir>");

const SOURCES = {
  ac: ["ACs"],
  tv: ["TVs", "Universal_TV_Remotes", "Touchscreen_Displays"],
  stb: ["Cable_Boxes", "Streaming_Devices", "DVB-T", "Converters"],
  audio: ["Audio_and_Video_Receivers", "SoundBars", "Speakers", "Multimedia", "CD_Players"],
  dvd: ["DVD_Players", "Blu-Ray", "VCR", "Laserdisc"],
  projector: ["Projectors"],
  fan: ["Fans", "Air_Purifiers", "Heaters", "Humidifiers"],
};

const KEY_ALIASES = new Map(Object.entries({
  power: "power", power_on: "power", power_toggle: "power", power_off: "poweroff", off: "poweroff",
  source: "input", input: "input", av: "input", mute: "mute",
  vol_up: "volup", volume_up: "volup", vol_down: "voldown", volume_down: "voldown",
  ch_up: "chup", channel_up: "chup", ch_down: "chdown", channel_down: "chdown",
  up: "up", down: "down", left: "left", right: "right", ok: "ok", enter: "ok", select: "ok",
  back: "back", return: "back", home: "home", menu: "menu", exit: "exit", guide: "guide", epg: "guide", info: "info",
  play: "play", pause: "pause", stop: "stop", rewind: "rew", rew: "rew", fast_forward: "ff", forward: "ff", ff: "ff",
  previous: "prev", prev: "prev", next: "next", record: "rec", rec: "rec", eject: "eject",
  sleep: "sleep", subtitle: "subtitle", audio: "audiotrack", red: "red", green: "green", yellow: "yellow", blue: "blue",
  temp_up: "tempup", temperature_up: "tempup", temp_plus: "tempup", temp_down: "tempdown", temperature_down: "tempdown", temp_minus: "tempdown",
  mode: "mode", fan: "fan", fan_speed: "fan", swing: "swing", timer: "timer", speed: "speed",
}));
for (let i = 0; i <= 9; i++) {
  KEY_ALIASES.set(String(i), `d${i}`);
  KEY_ALIASES.set(`num_${i}`, `d${i}`);
  KEY_ALIASES.set(`digit_${i}`, `d${i}`);
}

function normalizeKey(value) {
  const key = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return KEY_ALIASES.get(key) ?? null;
}

function walk(path) {
  const files = [];
  for (const entry of readdirSync(path)) {
    const full = join(path, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (entry.endsWith(".ir")) files.push(full);
  }
  return files;
}

function hexBytes(value) {
  return value.trim().split(/\s+/).map((part) => Number.parseInt(part, 16)).filter(Number.isFinite);
}

function necBurst(address, command) {
  const addressBytes = hexBytes(address);
  const commandBytes = hexBytes(command);
  if (addressBytes.length < 2 || commandBytes.length < 2) return null;
  // Flipper stores parsed values as padded little-endian 32-bit fields. NEC
  // transmits the low 16 address bits followed by the low 16 command bits.
  const bytes = [addressBytes[0], addressBytes[1], commandBytes[0], commandBytes[1]];
  const pattern = [9000, 4500];
  for (const byte of bytes) {
    for (let bit = 0; bit < 8; bit++) pattern.push(560, byte & (1 << bit) ? 1690 : 560);
  }
  pattern.push(560);
  return { f: 38000, t: pattern };
}

function parseFile(path) {
  const text = readFileSync(path, "utf8");
  const chunks = text.split(/\n(?=name:\s*)/);
  const codes = {};
  for (const chunk of chunks) {
    const name = chunk.match(/^name:\s*(.+)$/m)?.[1];
    const key = name ? normalizeKey(name) : null;
    if (!key || codes[key]) continue;
    const type = chunk.match(/^type:\s*(\w+)$/m)?.[1]?.toLowerCase();
    if (type === "raw") {
      const frequency = Number(chunk.match(/^frequency:\s*(\d+)$/m)?.[1]);
      const data = chunk.match(/^data:\s*([\s\S]*?)(?=\n#|\nname:|$)/m)?.[1]
        ?.trim().split(/\s+/).map(Number).filter((n) => Number.isInteger(n) && n > 0);
      if (frequency >= 20000 && frequency <= 60000 && data && data.length) {
        // Android caps an individual duration on some emitters. Split long
        // spaces into equivalent alternating 1 µs marks and shorter spaces.
        const safe = [];
        let valid = true;
        for (let index = 0; index < data.length; index++) {
          let pulse = data[index];
          // A huge mark is a corrupt capture, not an intentional gap.
          if (index % 2 === 0 && pulse > 100000) {
            valid = false;
            break;
          }
          const isSpace = index % 2 === 1;
          while (isSpace && pulse > 90000) {
            safe.push(1, 1, 90000);
            pulse -= 90001;
          }
          safe.push(pulse);
        }
        if (valid && safe.length <= 4096) codes[key] = { f: frequency, t: safe };
      }
    } else if (type === "parsed") {
      const protocol = chunk.match(/^protocol:\s*(.+)$/m)?.[1]?.trim().toUpperCase();
      const address = chunk.match(/^address:\s*(.+)$/m)?.[1];
      const command = chunk.match(/^command:\s*(.+)$/m)?.[1];
      if ((protocol === "NEC" || protocol === "NECEXT") && address && command) {
        const signal = necBurst(address, command);
        if (signal) codes[key] = signal;
      }
    }
  }
  return codes;
}

const output = {};
for (const [kind, folders] of Object.entries(SOURCES)) {
  const brands = new Map();
  for (const folder of folders) {
    const categoryPath = join(ROOT, folder);
    try {
      for (const brandDir of readdirSync(categoryPath)) {
        const brandPath = join(categoryPath, brandDir);
        if (!statSync(brandPath).isDirectory()) continue;
        const sets = brands.get(brandDir) ?? [];
        for (const file of walk(brandPath)) {
          const codes = parseFile(file);
          if (Object.keys(codes).length > 0) sets.push({ p: "nec1", d: 0, s: -1, k: codes, m: basename(file, ".ir") });
        }
        if (sets.length) brands.set(brandDir, sets);
      }
    } catch { /* optional folder */ }
  }
  output[kind] = [...brands.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, sets]) => ({ n: name.replaceAll("_", " "), r: sets.slice(0, 20) }));
}

writeFileSync("src/lib/ir-data.json", JSON.stringify(output));
writeFileSync("src/lib/ir-data-license.txt", "Flipper-IRDB — CC0 1.0 Universal (public domain dedication)\nhttps://github.com/Lucaslhm/Flipper-IRDB\n");
console.log(Object.entries(output).map(([kind, brands]) => `${kind}:${brands.length} brands/${brands.reduce((n, b) => n + b.r.length, 0)} remotes`).join(" "));