#!/usr/bin/env node
import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync("src/lib/ir-data.json", "utf8"));
const minimums = { ac: 80, tv: 100, stb: 30, audio: 50, dvd: 15, projector: 40, fan: 50 };
for (const [kind, minimum] of Object.entries(minimums)) {
  const brands = data[kind] ?? [];
  if (brands.length < minimum) throw new Error(`${kind}: expected at least ${minimum} brands, found ${brands.length}`);
  for (const brand of brands) {
    if (!brand.r?.length) throw new Error(`${kind}/${brand.n}: no remotes`);
    for (const remote of brand.r) {
      for (const [key, signal] of Object.entries(remote.k ?? {})) {
        if (typeof signal === "number") continue;
        if (!Number.isInteger(signal.f) || signal.f < 20000 || signal.f > 60000) throw new Error(`${brand.n}/${key}: bad carrier`);
        if (!Array.isArray(signal.t) || !signal.t.length || signal.t.some((pulse) => !Number.isInteger(pulse) || pulse <= 0 || pulse > 100000)) {
          throw new Error(`${brand.n}/${key}: bad pulse pattern`);
        }
      }
    }
  }
}
console.log(Object.entries(data).map(([kind, brands]) => `${kind}:${brands.length} brands`).join(" "));