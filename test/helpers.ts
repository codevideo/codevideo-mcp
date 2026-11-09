import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/** A fresh home directory; the MCP keeps its database and job folders under it. */
export const tempHome = (): string => fs.mkdtempSync(path.join(os.tmpdir(), "codevideo-mcp-test-"));

/** Isolate MCP state without changing the operating-system home directory. */
export const homeEnv = (home: string): Record<string, string> => ({ CODEVIDEO_HOME: path.join(home, ".codevideo") });

export const FAKE_CLI = path.resolve("test/fixtures/fake-cli.mjs");

export const parseText = (result: any): any => {
    const text = result.content[0].text;
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`Expected JSON tool response, received: ${text}`, { cause: error });
    }
};

export interface McpSession {
    client: Client;
    /** Calls a tool and parses its JSON reply. */
    call: (name: string, args?: Record<string, unknown>) => Promise<any>;
    /** Calls a tool and returns the raw MCP result. */
    callRaw: (name: string, args?: Record<string, unknown>) => Promise<any>;
    close: () => Promise<void>;
}

/** Starts the MCP server from source over stdio with extra environment variables. */
export const startMcp = async (env: Record<string, string>): Promise<McpSession> => {
    const client = new Client({ name: "codevideo-mcp-test", version: "1.0.0" });
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: ["--import", "tsx", "src/index.ts"],
        cwd: process.cwd(),
        env: { ...(process.env as Record<string, string>), ...env },
        stderr: "pipe",
    });
    await client.connect(transport);
    const callRaw = (name: string, args: Record<string, unknown> = {}) => client.callTool({ name, arguments: args });
    return {
        client,
        callRaw,
        call: async (name, args) => parseText(await callRaw(name, args)),
        close: () => client.close(),
    };
};

/** Polls until check returns a value, or fails after timeoutMs. */
export const waitFor = async <T>(check: () => Promise<T | undefined | null | false>, timeoutMs = 30_000, what = "condition"): Promise<T> => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const value = await check();
        if (value) return value;
        if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
};

export const isAlive = (pid: number): boolean => {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return (error as NodeJS.ErrnoException).code === "EPERM";
    }
};
