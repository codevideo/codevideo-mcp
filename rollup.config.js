import typescript from 'rollup-plugin-typescript2';
import json from '@rollup/plugin-json';

// externals
const external = [
  "child_process",
  "@modelcontextprotocol/sdk/server/stdio.js",
  "@modelcontextprotocol/sdk/server/mcp.js",
  "zod",
  "@fullstackcraftllc/codevideo-types",
  "@fullstackcraftllc/codevideo-exporters",
  "fs",
  "@fullstackcraftllc/codevideo-virtual-ide",
  "@fullstackcraftllc/codevideo-adapters",
  "@google/genai",
  "dotenv",
  "os",
  "path",
  "util",
  "better-sqlite3"
];

export default [
  // standard package
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.js",
      format: "es",
    },
    plugins: [
      json(),
      typescript()
    ],
    external,
  },
];

