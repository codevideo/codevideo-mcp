import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "codevideo-mcp-pack-"));
const cliPackDir = process.env.CODEVIDEO_CLI_PACK_DIR
  ? path.resolve(process.env.CODEVIDEO_CLI_PACK_DIR)
  : path.resolve("../codevideo-cli/npm/dist/npm");
const platform = `${process.platform}-${process.arch}`;
const cliVersion = manifest.dependencies["@fullstackcraftllc/codevideo-cli"];

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}${result.stderr}`);
  return result.stdout;
}

try {
  const packJson = JSON.parse(run("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", temp], process.cwd()));
  const mcpTarball = path.join(temp, packJson[0].filename);
  const wrapperTarball = path.join(cliPackDir, `fullstackcraftllc-codevideo-cli-${cliVersion}.tgz`);
  const platformTarball = path.join(cliPackDir, `fullstackcraftllc-codevideo-cli-${platform}-${cliVersion}.tgz`);
  const installSpecs = fs.existsSync(wrapperTarball) && fs.existsSync(platformTarball)
    ? [wrapperTarball, platformTarball, mcpTarball]
    : [`@fullstackcraftllc/codevideo-cli@${cliVersion}`, mcpTarball];

  run("npm", ["init", "-y"], temp);
  run("npm", ["install", "--ignore-scripts", "--package-lock=false", ...installSpecs], temp);

  const installedScope = path.join(temp, "node_modules", "@fullstackcraftllc");
  const platformPackages = fs.readdirSync(installedScope).filter((name) => /^codevideo-cli-(darwin|linux|win32)-/.test(name));
  assert.deepEqual(platformPackages, [`codevideo-cli-${platform}`]);

  const cliBinary = path.join(
    installedScope,
    `codevideo-cli-${platform}`,
    "bin",
    process.platform === "win32" ? "codevideo-cli.exe" : "codevideo-cli",
  );
  assert.match(run(cliBinary, ["--version"], temp), /CodeVideo CLI v0\.0\.7/);

  const home = path.join(temp, "home");
  fs.mkdirSync(home);
  const client = new Client({ name: "packed-package-smoke", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(installedScope, "codevideo-mcp", "dist", "index.js")],
    cwd: temp,
    env: { ...process.env, HOME: home },
    stderr: "pipe",
  });
  let serverStderr = "";
  transport.stderr?.on("data", (chunk) => {
    serverStderr += chunk.toString();
  });
  try {
    try {
      await client.connect(transport);
    } catch (error) {
      throw new Error(`Packed MCP server failed to start: ${serverStderr}`, { cause: error });
    }
    const tools = await client.listTools();
    assert.ok(tools.tools.length >= 40);
    console.log(`Packed install exposed ${tools.tools.length} MCP tools with ${platformPackages[0]}.`);
  } finally {
    await client.close();
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
