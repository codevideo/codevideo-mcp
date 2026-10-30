import { ILesson, IFileEntry } from '@fullstackcraftllc/codevideo-types';
import { VirtualIDE } from '@fullstackcraftllc/codevideo-virtual-ide';
import { compileFiles, ICompileCheckResult } from './compileCheck';

/**
 * Compile-check the final code state of a single lesson: replay its actions in the
 * VirtualIDE (starting from its initial snapshot, if any), materialize the files, and run
 * the compile adapter.
 *
 * Compilation itself is routed through compileCheck.ts, which is the single integration
 * point for codevideo-dynamic-ast@1.0.5 (`compileProject`). Until that's published and
 * wired, this returns a `pending` result rather than failing.
 *
 * (The whole-course flow uses codevideo_validate_course instead; this stays as a
 * lesson-level helper.)
 */
export const validateFinalCodeOfLesson = async (lesson: ILesson): Promise<ICompileCheckResult> => {
    const virtualIDE = new VirtualIDE();
    if (lesson.initialSnapshot) {
        virtualIDE.applyCourseSnapshot(lesson.initialSnapshot);
    }
    virtualIDE.applyActions(lesson.actions);
    const files: IFileEntry[] = virtualIDE.getFullFilePathsAndContents();
    return compileFiles(files);
};
