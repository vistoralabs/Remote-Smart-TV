import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const finalDir = path.join(root, "mobile-dist");
const temporaryParent = await mkdtemp(path.join(tmpdir(), "smart-tv-remote-"));
const temporaryDir = path.join(temporaryParent, "mobile-dist");

try {
  await build({
    configFile: path.join(root, "vite.mobile.config.ts"),
    build: { outDir: temporaryDir, emptyOutDir: true },
  });

  const html = await readFile(path.join(temporaryDir, "index.html"), "utf8");
  const references = [...html.matchAll(/(?:src|href)="\.\/(assets\/[^\"]+)"/g)].map(
    (match) => match[1],
  );
  if (references.length < 2) {
    throw new Error("Mobile build did not produce its JavaScript and CSS references");
  }
  await Promise.all(references.map((file) => access(path.join(temporaryDir, file))));

  await rm(finalDir, { recursive: true, force: true });
  await cp(temporaryDir, finalDir, { recursive: true });
  console.log(`Verified mobile bundle: ${references.join(", ")}`);
} finally {
  await rm(temporaryParent, { recursive: true, force: true });
}