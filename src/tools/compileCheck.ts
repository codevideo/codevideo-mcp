import { createRequire } from 'node:module';
import type { ICodeVideoDiagnostic, IFileSource } from '@fullstackcraftllc/codevideo-types';
import type { ICompileResult, IProjectResult } from '@fullstackcraftllc/codevideo-dynamic-ast';
import { computeDiagnostics, isDiagnosticsFile } from './diagnostics';
export type ICompileLanguageResult = IProjectResult;
export interface ICompileCheckResult extends ICompileResult {
    /** Compatibility: only genuine verification success maps to ok. */
    status: 'ok' | 'errors';
    /** Presentation-only Monaco diagnostics; never used to establish a project pass. */
    diagnostics?: ICodeVideoDiagnostic[];
    presentationIssues?: string[];
    message?: string;
}
let compiler: ((files: IFileSource[]) => Promise<ICompileResult>) | undefined;
export const compileFiles = async (files: IFileSource[]): Promise<ICompileCheckResult> => {
    let result: ICompileResult;
    try {
        compiler ??= createRequire(import.meta.url)('@fullstackcraftllc/codevideo-dynamic-ast').compileProject;
        result = await compiler!(files);
        if (!result.outcome) throw new Error('Installed dynamic-ast lacks explicit verification outcomes; install the updated package.');
    } catch (error) {
        result = { outcome: 'blocked', projects: [{ language: 'unknown', root: '.', check: 'syntax', outcome: 'blocked', errors: [], issues: [{ kind: 'runner', message: String(error) }], checkedPaths: [], supportingPaths: [], unsupportedPaths: [] }] };
    }
    const response: ICompileCheckResult = { ...result, status: result.outcome === 'passed' ? 'ok' : 'errors' };
    if (files.some(f => isDiagnosticsFile(f.path))) {
        try { response.diagnostics = computeDiagnostics(files); }
        catch (error) { response.presentationIssues = [String(error)]; }
    }
    return response;
};
