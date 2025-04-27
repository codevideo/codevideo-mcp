import typescript from 'rollup-plugin-typescript2';
import dts from 'rollup-plugin-dts';
import json from '@rollup/plugin-json';

// externals
const external = [
  "child_process",
  "@modelcontextprotocol/sdk/server/stdio",
  "@modelcontextprotocol/sdk/server/mcp",
  "zod",
  "@fullstackcraftllc/codevideo-types",
  "@fullstackcraftllc/codevideo-exporters",
  "fs"
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
  // type declarations
  {
    input: "src/index.ts",
    output: [
      {
        file: "dist/index.d.ts",
        format: "es",
      },
    ],
    plugins: [
      dts(),
    ],
    external,
  },
];

