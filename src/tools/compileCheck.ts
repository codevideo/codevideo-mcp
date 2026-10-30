import { createRequire } from "node:module";
import { IFileSource, IProjectError } from "@fullstackcraftllc/codevideo-types";
import type { ICompileResult } from "@fullstackcraftllc/codevideo-dynamic-ast";

/**
 * Single integration point for the "does the code actually compile?" check.
 *
 * Backed by codevideo-dynamic-ast `compileProject`, which detects each project in the file
 * set and compiles it with the native toolchain (ts-morph/tsc for TypeScript, plus go /
 * python3 / dotnet / rustc for those languages when installed). TypeScript needs no external
 * toolchain; the others require their toolchain to be present on the host.
 *
 * Loading note: dynamic-ast's ESM build bundles `typescript`, which references `__filename`
 * and therefore crashes in ES module scope ("__filename is not defined"). We load its CJS
 * build (the package's `require` export -> dist/index.cjs) via createRequire, where
 * `__filename` is defined. Loaded lazily so the ~12MB TS bundle only loads on first compile.
 */

export interface ICompileLanguageResult {
    language: string;
    errors: IProjectError[];
}

export interface ICompileCheckResult {
    status: "ok" | "errors";
    projects: ICompileLanguageResult[];
    message?: string;
}

type CompileProjectFn = (files: IFileSource[]) => Promise<ICompileResult>;

let cachedCompileProject: CompileProjectFn | null = null;
const getCompileProject = (): CompileProjectFn => {
    if (!cachedCompileProject) {
        const require = createRequire(import.meta.url);
        cachedCompileProject = require("@fullstackcraftllc/codevideo-dynamic-ast").compileProject as CompileProjectFn;
    }
    return cachedCompileProject;
};

export const compileFiles = async (files: IFileSource[]): Promise<ICompileCheckResult> => {
    if (files.length === 0) {
        return { status: "ok", projects: [], message: "No files to compile." };
    }
    try {
        const compileProject = getCompileProject();
        const result = await compileProject(files);
        const projects: ICompileLanguageResult[] = result.projects.map((p) => ({
            language: p.language,
            errors: p.errors,
        }));
        const hasErrors = projects.some((p) => p.errors.length > 0);
        return { status: hasErrors ? "errors" : "ok", projects };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            status: "errors",
            projects: [{ language: "unknown", errors: [{ file: "unknown", line: 0, message: `Compile check failed to run: ${message}` }] }],
        };
    }
};
