import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  packages: "external",
  platform: "node",
  target: "node20",
  format: "esm",
  sourcemap: true,
  banner: { js: "#!/usr/bin/env node" }
});

fs.copyFileSync("types/index.d.ts", "dist/index.d.ts");
fs.chmodSync(path.resolve("dist/index.js"), 0o755);
