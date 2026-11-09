import { isDeepStrictEqual } from 'node:util';
import { VirtualIDE } from '@fullstackcraftllc/codevideo-virtual-ide';
import type { IAction, ICourseSnapshot } from '@fullstackcraftllc/codevideo-types';
import type { VerificationOutcome } from '@fullstackcraftllc/codevideo-dynamic-ast';
import { compileFiles, ICompileCheckResult } from './compileCheck';
export interface LessonVerificationIssue {
    kind: 'replay' | 'snapshot' | 'unsaved';
    message: string;
    actionIndex?: number;
    path?: string;
}
export interface LessonVerification extends ICompileCheckResult {
    fileCount: number;
    lessonIssues: LessonVerificationIssue[];
    warnings: Array<{ message: string; actionIndex?: number }>;
}
export interface VerifiableLesson {
    actions: IAction[];
    initialSnapshot?: ICourseSnapshot | null;
    finalSnapshot?: ICourseSnapshot | null;
}
export const verifyLesson = async (lesson: VerifiableLesson): Promise<LessonVerification> => {
    const issues: LessonVerificationIssue[] = [];
    const warnings: LessonVerification['warnings'] = [];
    const ide = new VirtualIDE();
    let index = -1;
    let snapshot: ICourseSnapshot;
    try {
        if (lesson.initialSnapshot) ide.applyCourseSnapshot(structuredClone(lesson.initialSnapshot));
        let seen = 0;
        for (index = 0; index < lesson.actions.length; index++) {
            ide.applyAction(lesson.actions[index]);
            const logs = ide.getLogs();
            for (const log of logs.slice(seen)) {
                if (log.type === 'error') issues.push({ kind: 'replay', actionIndex: index, message: log.message });
                if (log.type === 'warning') warnings.push({ actionIndex: index, message: log.message });
            }
            seen = logs.length;
        }
        snapshot = ide.getCourseSnapshot();
    } catch (error) {
        issues.push({ kind: 'replay', actionIndex: index < 0 ? undefined : Math.min(index, lesson.actions.length - 1), message: String(error) });
        return { status: 'errors', outcome: 'failed', projects: [], fileCount: 0, lessonIssues: issues, warnings };
    }
    if (lesson.finalSnapshot && !isDeepStrictEqual(snapshot, lesson.finalSnapshot)) issues.push({ kind: 'snapshot', message: 'Stored final snapshot disagrees with initial snapshot plus actions. Reapply the lesson actions to recompute the snapshot chain.' });
    for (const editor of snapshot.editorSnapshot.editors) {
        if (!editor.isSaved) issues.push({ kind: 'unsaved', path: editor.filename, message: `Unsaved buffer ${editor.filename}: add an editor-save action before the lesson ends.` });
    }
    const files = ide.getFullFilePathsAndContents();
    const compiled = await compileFiles(files);
    const outcome: VerificationOutcome = issues.length ? 'failed' : compiled.outcome;
    return { ...compiled, status: outcome === 'passed' ? 'ok' : 'errors', outcome, fileCount: files.length, lessonIssues: issues, warnings };
};
