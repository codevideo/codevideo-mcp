import { IAction, isValidAction } from "@fullstackcraftllc/codevideo-types";
import {
    addLesson,
    createCourse,
    exportCourse,
    getCourse,
    getLesson,
    getLessonFile,
    getLessonFileTree,
    getLessonFiles,
    listLessons,
    setLessonActions,
} from "../store/courseStore";
import { compileFiles, ICompileCheckResult } from "./compileCheck";

// All tool functions return a JSON string for the MCP `text` content block.
const ok = (data: unknown): string => JSON.stringify(data, null, 2);

// ---------- course / lesson lifecycle ----------

export const createCourseTool = (input: { name: string; description?: string; primaryLanguage?: string; id?: string }): string => {
    const courseId = createCourse(input);
    return ok({ courseId, message: `Created course "${input.name}". Add lessons with codevideo_add_lesson(courseId).` });
};

export const addLessonTool = (
    courseId: string,
    input: { name: string; description?: string; mustCompile?: boolean; continuesFromPrevious?: boolean }
): string => {
    const lessonId = addLesson(courseId, input);
    const lesson = getLesson(courseId, lessonId);
    return ok({
        lessonId,
        continuesFromPrevious: lesson.continuesFromPrevious,
        mustCompile: lesson.mustCompile,
        message:
            `Added lesson "${input.name}". ` +
            (lesson.continuesFromPrevious
                ? "Its initial state is the previous lesson's final state (chained server-side)."
                : "Its initial state is empty (from scratch).") +
            " Author its actions, then call codevideo_set_lesson_actions(courseId, lessonId, actions).",
    });
};

export const setLessonActionsTool = (courseId: string, lessonId: string, actions: IAction[]): string => {
    const { actionCount } = setLessonActions(courseId, lessonId, actions);
    return ok({
        ok: true,
        actionCount,
        message: `Stored ${actionCount} actions. Final snapshot recomputed server-side. Use codevideo_compile_lesson to check it builds.`,
    });
};

// ---------- context-lean reads (never dump the whole snapshot) ----------

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
    const files = getLessonFiles(courseId, lessonId);
    const result = await compileFiles(files);
    return ok({ courseId, lessonId, fileCount: files.length, ...result });
};

interface LessonValidation {
    lessonId: string;
    name: string;
    index: number;
    actionsValid: boolean;
    hasActions: boolean;
    invalidActionIndexes: number[];
    snapshotContinuous: boolean;
    mustCompile: boolean;
    compileStatus: ICompileCheckResult["status"] | "skipped";
    compileErrors: ICompileCheckResult["projects"];
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

        // continuity: a continuing lesson's initial state must equal the previous lesson's final state.
        // (The store sets these equal by construction; the check still catches externally-imported lessons.)
        let snapshotContinuous = true;
        if (i > 0 && lesson.continuesFromPrevious) {
            snapshotContinuous = JSON.stringify(lesson.initialSnapshot) === JSON.stringify(lessons[i - 1].finalSnapshot);
        }

        let compileStatus: LessonValidation["compileStatus"] = "skipped";
        let compileErrors: ICompileCheckResult["projects"] = [];
        if (lesson.mustCompile) {
            const c = await compileFiles(getLessonFiles(courseId, lesson.id));
            compileStatus = c.status;
            compileErrors = c.projects.filter((p) => p.errors.length > 0);
        }

        results.push({
            lessonId: lesson.id,
            name: lesson.name,
            index: i,
            actionsValid: invalidActionIndexes.length === 0,
            hasActions: lesson.actions.length > 0,
            invalidActionIndexes,
            snapshotContinuous,
            mustCompile: lesson.mustCompile,
            compileStatus,
            compileErrors,
        });
    }

    const allActionsValid = results.every((r) => r.actionsValid);
    const allHaveActions = results.every((r) => r.hasActions);
    const allContinuous = results.every((r) => r.snapshotContinuous);
    const compileEnforced = results.filter((r) => r.mustCompile);
    const allMustCompileClean = compileEnforced.every((r) => r.compileStatus === "ok");
    const finalLesson = results[results.length - 1];
    const finalCompilesClean = !!finalLesson && finalLesson.mustCompile && finalLesson.compileStatus === "ok";

    const done = lessons.length > 0 && allHaveActions && allActionsValid && allContinuous && allMustCompileClean && finalCompilesClean;

    const reasons: string[] = [];
    if (lessons.length === 0) reasons.push("Course has no lessons.");
    for (const lesson of results.filter((result) => !result.hasActions)) {
        reasons.push(`Lesson "${lesson.name}" (${lesson.lessonId}) has no actions.`);
    }
    if (!allActionsValid) reasons.push("Some lessons contain invalid actions.");
    if (!allContinuous) reasons.push("Some lessons do not follow cleanly from the previous lesson (snapshot discontinuity).");
    if (!allMustCompileClean) reasons.push("Some lessons marked mustCompile do not compile cleanly.");
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
            mustCompile: l.mustCompile,
            continuesFromPrevious: l.continuesFromPrevious,
            hasActions: l.actions.length > 0,
        })),
    });
};

export const exportCourseTool = (courseId: string): string => ok(exportCourse(courseId));
