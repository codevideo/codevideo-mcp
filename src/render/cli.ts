import path from "node:path";
import { IDE_PROP_KEYS, RenderOptions } from "./options";

/**
 * How the worker talks to codevideo-cli 0.0.13: arguments in, and three kinds
 * of output lines back. stdout carries only the saved-file lines; stderr has a
 * plain progress line per stage and per 25% (stderr isn't a terminal here),
 * plus "error: ..." lines when something fails.
 */

/**
 * The largest project JSON the CLI can take as one -p argument. Linux caps a
 * single argument at 128 KiB; Windows caps the whole command line at 32,767
 * characters. A project file flag in a later CLI removes this limit.
 */
export const maxProjectArgumentBytes = (platform: NodeJS.Platform = process.platform): number =>
    platform === "win32" ? 30_000 : 120 * 1024;

/**
 * The CLI's -c file: IDE props from the options, with the two the CLI requires
 * filled in. withCaptions is filled in too: CLI 0.0.13 reads a missing one as
 * false, while a render without a config file keeps the page's default, on.
 */
export const ideConfigFor = (options: RenderOptions, defaultLanguage: string): Record<string, unknown> | null => {
    const props: Record<string, unknown> = {};
    for (const key of IDE_PROP_KEYS) {
        if (options[key] !== undefined) props[key] = options[key];
    }
    if (Object.keys(props).length === 0) return null;
    return { theme: "dark", defaultLanguage, withCaptions: true, ...props };
};

export const cliArgs = (input: {
    projectJson: string;
    outputPath: string;
    configPath?: string;
    options: RenderOptions;
    open: boolean;
}): string[] => {
    const args = ["-p", input.projectJson, "-o", input.outputPath];
    if (input.configPath) args.push("-c", input.configPath);
    if (input.options.orientation === "portrait") args.push("-n", "portrait");
    if (input.options.renderMode) args.push("--render-mode", input.options.renderMode);
    if (input.options.renderSeed) args.push("--render-seed", input.options.renderSeed);
    if (input.options.renderWorkers) args.push("--render-workers", String(input.options.renderWorkers));
    if (input.open) args.push("--open");
    return args;
};

/**
 * The CLI's environment: the npm runtime's, plus a voice or TTS provider from
 * the options. The Node running the MCP goes first on PATH, because the CLI
 * starts its Puppeteer runner as plain `node`, and a desktop client may start
 * the MCP with a PATH that has none (nvm, fnm, Volta).
 */
export const cliEnv = (base: NodeJS.ProcessEnv, options: RenderOptions, nodePath = process.execPath): NodeJS.ProcessEnv => {
    const env = { ...base };
    const pathKey = Object.keys(env).find((key) => key.toUpperCase() === "PATH") ?? "PATH";
    env[pathKey] = [path.dirname(nodePath), env[pathKey]].filter(Boolean).join(path.delimiter);
    if (options.voiceId) env.ELEVEN_LABS_VOICE_ID = options.voiceId;
    if (options.ttsProvider) env.CODEVIDEO_TTS_PROVIDER = options.ttsProvider;
    return env;
};

export type CliLine =
    | { kind: "progress"; text: string }
    | { kind: "error"; text: string }
    | { kind: "saved"; path: string }
    | { kind: "other" };

const PROGRESS = /^\[\s*\d+%\] /;
const ERROR = /^error: (.+)$/;
const SAVED = /^✅ CodeVideo successfully generated and saved to (.+)$/;

export const parseCliLine = (line: string): CliLine => {
    const text = line.trimEnd();
    if (PROGRESS.test(text)) return { kind: "progress", text };
    const error = ERROR.exec(text);
    if (error) return { kind: "error", text: error[1] };
    const saved = SAVED.exec(text);
    if (saved) return { kind: "saved", path: saved[1] };
    return { kind: "other" };
};
