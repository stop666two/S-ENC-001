import { build } from "esbuild";
import { fileURLToPath } from "url";
import path from "path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

await build({
  entryPoints: [path.join(root, "src", "sw.ts")],
  outfile: path.join(root, "dist", "sw.js"),
  bundle: true,
  format: "iife",
  target: "es2022",
  minify: true,
  logLevel: "info",
});
