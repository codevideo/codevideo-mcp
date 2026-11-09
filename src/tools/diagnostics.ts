import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import type * as TS from "typescript";
import {
    DIAGNOSTICS_TYPESCRIPT_VERSION,
    ICodeVideoDiagnostic,
    IFileSource,
    createDiagnosticsShims,
    getDiagnosticsChecks,
    getDiagnosticsCompilerOptions,
    isDiagnosticsProgramFile,
    normalizeDiagnosticsPath,
    toCodeVideoDiagnostic,
    toDiagnosticsFileName,
} from "@fullstackcraftllc/codevideo-types";

/**
 * TypeScript squiggles as a render draws them.
 *
 * The renderer computes diagnostics in Monaco 0.52.2's TypeScript worker, so
 * this runs the same TypeScript release (installed as the `typescript-5.4.5`
 * alias, separate from the MCP's own build compiler) with the same compiler
 * options, import shims and file names from codevideo-types. A lesson that
 * compiles clean here shows no squiggles, and a hover position that hits a
 * diagnostic here hits one in the video.
 *
 * Loaded lazily with require, like dynamic-ast: TypeScript is large and only
 * the compile and validation tools need it.
 */
let cachedTypeScript: typeof TS | null = null;
const loadTypeScript = (): typeof TS => {
    if (!cachedTypeScript) {
        const ts = createRequire(import.meta.url)("typescript-5.4.5") as typeof TS;
        if (ts.version !== DIAGNOSTICS_TYPESCRIPT_VERSION) {
            throw new Error(`Diagnostics need TypeScript ${DIAGNOSTICS_TYPESCRIPT_VERSION} (the renderer's), found ${ts.version}`);
        }
        cachedTypeScript = ts;
    }
    return cachedTypeScript;
};

/** True for files the diagnostics engine checks (TS and JS); everything else goes to dynamic-ast. */
export const isDiagnosticsFile = (filePath: string): boolean => isDiagnosticsProgramFile(normalizeDiagnosticsPath(filePath));

/**
 * Diagnostics for `targets` (project paths; default: every TS/JS file), given
 * every project file. Sorted by path, then position.
 */
export const computeDiagnostics = (files: IFileSource[], targets?: string[]): ICodeVideoDiagnostic[] => {
    const ts = loadTypeScript();
    const project = files.map((file) => ({ path: normalizeDiagnosticsPath(file.path), content: file.content }));
    const program = [...project.filter((file) => isDiagnosticsProgramFile(file.path)), createDiagnosticsShims(project)];
    const sources = new Map(program.map((file) => [toDiagnosticsFileName(file.path), file.content]));
    const options = getDiagnosticsCompilerOptions() as TS.CompilerOptions;
    const libDirectory = path.dirname(ts.getDefaultLibFilePath(options));
    const isLib = (fileName: string) => fileName.startsWith(libDirectory) && fs.existsSync(fileName);
    const read = (fileName: string) => sources.get(fileName) ?? (isLib(fileName) ? fs.readFileSync(fileName, "utf8") : undefined);

    const host: TS.LanguageServiceHost = {
        getScriptFileNames: () => [...sources.keys()],
        getScriptVersion: () => "1",
        getScriptSnapshot: (fileName) => {
            const text = read(fileName);
            return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
        },
        getCurrentDirectory: () => "",
        getCompilationSettings: () => options,
        getDefaultLibFileName: (settings) => ts.getDefaultLibFilePath(settings),
        fileExists: (fileName) => sources.has(fileName) || isLib(fileName),
        readFile: read,
    };
    const service = ts.createLanguageService(host, ts.createDocumentRegistry());
    try {
        const contents = new Map(project.map((file) => [file.path, file.content]));
        const wanted = [...new Set((targets ?? project.map((file) => file.path)).map(normalizeDiagnosticsPath))].sort();
        const diagnostics: ICodeVideoDiagnostic[] = [];
        for (const target of wanted) {
            const checks = getDiagnosticsChecks(target), content = contents.get(target);
            if (!checks || content === undefined) continue;
            const fileName = toDiagnosticsFileName(target);
            const raw = [
                ...(checks.syntactic ? service.getSyntacticDiagnostics(fileName) : []),
                ...(checks.semantic ? service.getSemanticDiagnostics(fileName) : []),
            ];
            diagnostics.push(...raw.map((diagnostic) => toCodeVideoDiagnostic(target, content, diagnostic)));
        }
        return diagnostics;
    } finally {
        service.dispose();
    }
};
