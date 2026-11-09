import fs from "node:fs";
import path from "node:path";
import { IAction, ICourseSnapshot, isValidAction } from "@fullstackcraftllc/codevideo-types";
import {
    ActionEdit,
    addLesson,
    createCourse,
    editLessonActions,
    exportCourse,
    fileEntriesFromSnapshot,
    getCourse,
    getLesson,
    getLessonActions,
    getLessonFile,
    getLessonFileTree,
    listLessons,
    setLessonActions,
} from "../store/courseStore";
import { codevideoHome } from "../store/db";
import { estimatedSeconds } from "../render/queue";
import { ICompileCheckResult } from "./compileCheck";
import { verifyLesson, LessonVerification } from "./verifyLesson";
import { describeRejected, RejectedAction, rejectedActionsIn, valueHint } from "../validation/rejectedActions";
import { checkDiagnosticHovers, DiagnosticHoverProblem } from "../validation/diagnosticHovers";
import { checkClipboardKeys, ClipboardKeyProblem, describeClipboardKeyProblems } from "../validation/clipboardKeys";

// All tool functions return a JSON string for the MCP `text` content block.
const ok = (data: unknown): string => JSON.stringify(data, null, 2);

// ---------- course / lesson lifecycle ----------

export const createCourseTool = (input: { name: string; description?: string; primaryLanguage?: string; id?: string }): string => {
    const courseId = createCourse(input);
    return ok({ courseId, message: `Created course "${input.name}". Add lessons with codevideo_add_lesson(courseId).` });
};

/** Files a lesson created or changed, by path, and whether each is open at its end. */
const filesChangedBy = (lesson: ReturnType<typeof listLessons>[number]) => {
    const before = new Map(fileEntriesFromSnapshot(lesson.initialSnapshot).map((f) => [f.path, f.content]));
    const open = new Set((lesson.finalSnapshot.editorSnapshot?.editors ?? []).map((e) => e.filename));
    return fileEntriesFromSnapshot(lesson.finalSnapshot)
        .filter((f) => before.get(f.path) !== f.content)
        .slice(0, 10)
        .map((f) => {
            const path = f.path.replace(/^\/+/, "");
            return { path, change: before.has(f.path) ? "changed" : "created", open: open.has(path) };
        });
};

export const addLessonTool = (
    courseId: string,
    input: { name: string; description?: string; mustCompile?: boolean; continuesFromPrevious?: boolean }
): string => {
    const lessonId = addLesson(courseId, input);
    const lessons = listLessons(courseId);
    const index = lessons.findIndex((l) => l.id === lessonId);
    const lesson = lessons[index];
    const previous = index > 0 ? lessons[index - 1] : undefined;
    return ok({
        lessonId,
        continuesFromPrevious: lesson.continuesFromPrevious,
        mustCompile: lesson.mustCompile,
        // What the opening recap is written from, without loading that lesson.
        ...(previous ? { previousLesson: { name: previous.name, description: previous.description, files: filesChangedBy(previous) } } : {}),
        message:
            `Added lesson "${input.name}". ` +
            (lesson.continuesFromPrevious
                ? "Its initial state is the previous lesson's final state (chained server-side)."
                : "Its initial state is empty (from scratch).") +
            " Author its actions, then call codevideo_set_lesson_actions(courseId, lessonId, actions).",
    });
};

/**
 * Flags actions lessons can't use, and copy, cut or paste presses that would
 * do nothing, as soon as they're stored, so the model can change just those
 * with codevideo_edit_lesson_actions instead of finding out at validation and
 * resending the lesson.
 */
const problemsWith = (lesson: { initialSnapshot: ICourseSnapshot; actions: IAction[] }): { problems?: string } => {
    const rejected = rejectedActionsIn(lesson.actions);
    const presses = checkClipboardKeys(lesson.initialSnapshot, lesson.actions);
    if (rejected.length === 0 && presses.length === 0) return {};
    const details = [
        ...(rejected.length ? [describeRejected(rejected)] : []),
        ...(presses.length ? [describeClipboardKeyProblems(presses)] : []),
    ];
    return { problems: `Stored, but codevideo_validate_course rejects this lesson until these are fixed: ${details.join("; ")}. codevideo_edit_lesson_actions can change just those actions.` };
};

export const setLessonActionsTool = (courseId: string, lessonId: string, actions: IAction[]): string => {
    const { actionCount } = setLessonActions(courseId, lessonId, actions);
    return ok({
        ok: true,
        actionCount,
        message: `Stored ${actionCount} actions. Final snapshot recomputed server-side. Use codevideo_compile_lesson to check it builds.`,
        ...problemsWith(getLesson(courseId, lessonId)),
    });
};

export const editLessonActionsTool = (courseId: string, lessonId: string, edits: ActionEdit[]): string => {
    const { actionCount } = editLessonActions(courseId, lessonId, edits);
    return ok({
        ok: true,
        actionCount,
        message: `Applied ${edits.length} edit(s); the lesson now has ${actionCount} actions. Snapshots recomputed server-side.`,
        ...problemsWith(getLesson(courseId, lessonId)),
    });
};

// ---------- context-lean reads (never dump the whole snapshot) ----------

export const getLessonActionsTool = (courseId: string, lessonId: string, start?: number, limit?: number): string =>
    ok({ courseId, lessonId, ...getLessonActions(courseId, lessonId, start, limit) });

export const getLessonFileTreeTool = (courseId: string, lessonId: string): string =>
    ok({ courseId, lessonId, files: getLessonFileTree(courseId, lessonId) });

export const getLessonFileTool = (courseId: string, lessonId: string, filePath: string): string => {
    const content = getLessonFile(courseId, lessonId, filePath);
    if (content === null) {
        return ok({ courseId, lessonId, path: filePath, found: false, message: "No such file at the end of this lesson." });
    }
    return ok({ courseId, lessonId, path: filePath, found: true, content });
};

// ---------- compile + validate ----------

export const compileLessonTool = async (courseId: string, lessonId: string): Promise<string> => {
    const result = await verifyLesson(getLesson(courseId, lessonId));
    return ok({ courseId, lessonId, ...result });
};

interface LessonValidation {
    lessonId: string;
    name: string;
    index: number;
    actionsValid: boolean;
    hasActions: boolean;
    invalidActionIndexes: number[];
    rejectedActions: RejectedAction[];
    opensWithSpeech: boolean;
    snapshotContinuous: boolean;
    mustCompile: boolean;
    compileStatus: ICompileCheckResult["status"] | "skipped";
    compileErrors: ICompileCheckResult["projects"];
    verification?: LessonVerification;
    /** mouse-move-editor-diagnostic actions that wouldn't land on a squiggle. */
    diagnosticHoverProblems: DiagnosticHoverProblem[];
    /** Copy, cut and paste presses that would do nothing on screen. */
    clipboardKeyProblems: ClipboardKeyProblem[];
}

export interface CourseValidation {
    courseId: string;
    done: boolean;
    lessonCount: number;
    lessons: LessonValidation[];
    reasons: string[];
}

export const validateCourse = async (courseId: string): Promise<CourseValidation> => {
    const lessons = listLessons(courseId);
    const results: LessonValidation[] = [];

    for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i];

        const invalidActionIndexes: number[] = [];
        lesson.actions.forEach((a, idx) => {
            if (!isValidAction(a)) invalidActionIndexes.push(idx);
        });
        const rejectedActions = rejectedActionsIn(lesson.actions);
        // An empty lesson already fails for having no actions.
        const opensWithSpeech = lesson.actions.length === 0 || lesson.actions[0].name === "author-speak-before";

        // continuity: a continuing lesson's initial state must equal the previous lesson's final state.
        // (The store sets these equal by construction; the check still catches externally-imported lessons.)
        let snapshotContinuous = true;
        if (i > 0 && lesson.continuesFromPrevious) {
            snapshotContinuous = JSON.stringify(lesson.initialSnapshot) === JSON.stringify(lessons[i - 1].finalSnapshot);
        }

        let compileStatus: LessonValidation["compileStatus"] = "skipped";
        let compileErrors: ICompileCheckResult["projects"] = [];
        let verification: LessonVerification | undefined;
        if (lesson.mustCompile) {
            const c = verification = await verifyLesson(lesson);
            compileStatus = c.status;
            compileErrors = c.projects.filter((p) => p.outcome !== "passed");
        }

        const diagnosticHoverProblems = checkDiagnosticHovers(lesson.initialSnapshot, lesson.actions);
        const clipboardKeyProblems = checkClipboardKeys(lesson.initialSnapshot, lesson.actions);

        results.push({
            lessonId: lesson.id,
            name: lesson.name,
            index: i,
            actionsValid: invalidActionIndexes.length === 0,
            hasActions: lesson.actions.length > 0,
            invalidActionIndexes,
            rejectedActions,
            opensWithSpeech,
            snapshotContinuous,
            mustCompile: lesson.mustCompile,
            compileStatus,
            compileErrors,
            verification,
            diagnosticHoverProblems,
            clipboardKeyProblems,
        });
    }

    const allActionsValid = results.every((r) => r.actionsValid);
    const allAllowed = results.every((r) => r.rejectedActions.length === 0);
    const allOpenWithSpeech = results.every((r) => r.opensWithSpeech);
    const allHaveActions = results.every((r) => r.hasActions);
    const allContinuous = results.every((r) => r.snapshotContinuous);
    const compileEnforced = results.filter((r) => r.mustCompile);
    const allMustCompileClean = compileEnforced.every((r) => r.compileStatus === "ok");
    const finalLesson = results[results.length - 1];
    const finalCompilesClean = !!finalLesson && finalLesson.mustCompile && finalLesson.compileStatus === "ok";

    const allHoversLand = results.every((r) => r.diagnosticHoverProblems.length === 0);
    const allClipboardKeysWork = results.every((r) => r.clipboardKeyProblems.length === 0);

    const done = lessons.length > 0 && allHaveActions && allActionsValid && allAllowed && allOpenWithSpeech && allContinuous && allMustCompileClean && finalCompilesClean && allHoversLand && allClipboardKeysWork;

    const reasons: string[] = [];
    if (lessons.length === 0) reasons.push("Course has no lessons.");
    for (const lesson of results.filter((result) => !result.hasActions)) {
        reasons.push(`Lesson "${lesson.name}" (${lesson.lessonId}) has no actions.`);
    }
    results.forEach((result, i) => {
        if (result.invalidActionIndexes.length === 0) return;
        const details = result.invalidActionIndexes.map((index) => {
            const action = lessons[i].actions[index];
            const hint = valueHint(action.name);
            return hint
                ? `action ${index} is ${action.name} ${JSON.stringify(action.value)}, but its value should be: ${hint}`
                : `action ${index} has an unknown name, ${JSON.stringify(action.name)}`;
        });
        reasons.push(`Lesson "${result.name}" (${result.lessonId}) has invalid actions: ${details.join("; ")}.`);
    });
    for (const result of results.filter((r) => !r.opensWithSpeech)) {
        reasons.push(`Lesson "${result.name}" (${result.lessonId}) must open with author-speak-before: frame the lesson, and after the first lesson start by recapping the previous one.`);
    }
    for (const result of results.filter((r) => r.rejectedActions.length > 0)) {
        reasons.push(`Lesson "${result.name}" (${result.lessonId}) uses actions lessons can't use; ${describeRejected(result.rejectedActions)}.`);
    }
    for (const result of results.filter((r) => r.diagnosticHoverProblems.length > 0)) {
        const details = result.diagnosticHoverProblems.map((p) => `action ${p.index} (${p.value}): ${p.reason}`);
        reasons.push(`Lesson "${result.name}" (${result.lessonId}) has mouse-move-editor-diagnostic actions that miss: ${details.join("; ")}.`);
    }
    for (const result of results.filter((r) => r.clipboardKeyProblems.length > 0)) {
        reasons.push(`Lesson "${result.name}" (${result.lessonId}) has copy, cut or paste presses that do nothing: ${describeClipboardKeyProblems(result.clipboardKeyProblems)}.`);
    }
    if (!allContinuous) reasons.push("Some lessons do not follow cleanly from the previous lesson (snapshot discontinuity).");
    for (const result of results.filter(r => r.mustCompile && r.verification?.outcome !== 'passed')) {
        const verification = result.verification!;
        const detail = [...verification.lessonIssues.map(i => i.message), ...verification.projects.flatMap(p => p.issues.map(i => i.message))].join('; ');
        reasons.push(`Lesson "${result.name}" verification ${verification.outcome}: ${detail}`);
    }
    if (finalLesson && !finalLesson.mustCompile) reasons.push("The final lesson must be marked mustCompile (all code should work by the end).");
    else if (!finalCompilesClean) reasons.push("The final lesson does not compile cleanly.");

    return { courseId, done, lessonCount: lessons.length, lessons: results, reasons };
};

export const validateCourseTool = async (courseId: string): Promise<string> => ok(await validateCourse(courseId));

// ---------- status + export ----------

export const getCourseStatusTool = (courseId: string): string => {
    const course = getCourse(courseId);
    return ok({
        courseId: course.id,
        name: course.name,
        primaryLanguage: course.primaryLanguage,
        lessonCount: course.lessons.length,
        lessons: course.lessons.map((l, i) => ({
            index: i,
            lessonId: l.id,
            name: l.name,
            actionCount: l.actions.length,
            // At the render page's default pauses, with narration estimated from word counts.
            estimatedSeconds: estimatedSeconds(l.actions),
            mustCompile: l.mustCompile,
            continuesFromPrevious: l.continuesFromPrevious,
            hasActions: l.actions.length > 0,
        })),
    });
};

/** Writes the whole course (snapshots included) to a file and replies with only its path. */
export const exportCourseTool = (courseId: string): string => {
    const course = exportCourse(courseId);
    const dir = path.join(codevideoHome(), "exports");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${courseId.replace(/[^a-z0-9-_]+/gi, "_")}.json`);
    const json = JSON.stringify(course, null, 2);
    fs.writeFileSync(file, json);
    return ok({
        courseId,
        path: file,
        lessonCount: course.lessons.length,
        bytes: Buffer.byteLength(json),
        message: "Exported to a file. Open or pass that path instead of reading the course into context.",
    });
};
