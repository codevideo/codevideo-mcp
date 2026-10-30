import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
for (const entry of [manifest.main, manifest.types, manifest.bin["codevideo-mcp"]]) {
  assert.ok(fs.statSync(entry, { throwIfNoEntry: false })?.isFile(), `Missing package entrypoint: ${entry}`);
}
assert.equal(fs.readFileSync(manifest.bin["codevideo-mcp"], "utf8").split("\n")[0], "#!/usr/bin/env node");

const pack = spawnSync("npm", ["pack", "--dry-run", "--ignore-scripts", "--json"], { encoding: "utf8" });
if (pack.status !== 0) throw new Error(pack.stderr || pack.stdout);
const packed = JSON.parse(pack.stdout)[0];
const paths = packed.files.map((file) => file.path);
assert.ok(paths.includes("dist/index.js"));
assert.ok(paths.includes("dist/index.d.ts"));
assert.ok(!paths.some((file) => file.startsWith("bin/")));
assert.ok(packed.unpackedSize < 1024 * 1024, `Package is too large: ${packed.unpackedSize} bytes`);

const home = fs.mkdtempSync(path.join(os.tmpdir(), "codevideo-mcp-built-"));
const client = new Client({ name: "built-package-smoke", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.resolve("dist/index.js")],
  cwd: process.cwd(),
  env: { ...process.env, HOME: home },
  stderr: "pipe"
});
try {
  await client.connect(transport);
  const tools = await client.listTools();
  assert.ok(tools.tools.length >= 40);
} finally {
  await client.close();
  fs.rmSync(home, { recursive: true, force: true });
}

console.log(`Verified ${manifest.name}@${manifest.version}: ${packed.files.length} files, ${packed.unpackedSize} bytes unpacked.`);
