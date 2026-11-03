import os from "os";
import fs from "fs";
import path from "path";
import { ILesson } from "@fullstackcraftllc/codevideo-types";
import { generateHtmlStringFromLesson } from "@fullstackcraftllc/codevideo-exporters";
import { getCourse, getLesson, listLessons, StoredLesson } from "../store/courseStore";
import { validateCourse } from "./courseTools";
import { JobSpec } from "../render/jobs";
import { RenderOptions } from "../render/options";
import { describeJob, estimatedSeconds, newVideoPath, queueRenders } from "../render/queue";

// Phase 2: previews + video render, gated behind validation.
// - Previews are server-side HTML (cheap, no browser needed in the MCP) for the
//   human-in-the-loop "does this look right?" check before any expensive rendering.
// - Video renders are queued, one job per lesson, ONLY once the course passes
//   validate_course; the background render worker runs them one at a time. (Real PNG/snapshot previews need a headless render step — best added
//   as a `--screenshot` mode on the CLI, which already drives a browser. See README/notes.)

const ok = (data: unknown): string => JSON.stringify(data, null, 2);

const toILesson = (l: StoredLesson): ILesson => ({
    id: l.id,
    name: l.name,
    description: l.description,
    actions: l.actions,
    initialSnapshot: l.initialSnapshot,
    finalSnapshot: l.finalSnapshot,
});

const writePreviewHtml = async (courseId: string, l: StoredLesson): Promise<string> => {
    const html = await generateHtmlStringFromLesson(toILesson(l), {});
    const outDir = path.join(os.homedir(), ".codevideo", "previews", courseId);
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, `${l.id}.html`);
    fs.writeFileSync(file, html, "utf8");
    return file;
};

// ---------- previews (server-side HTML) ----------

export const generateLessonPreviewTool = async (courseId: string, lessonId: string): Promise<string> => {
    const file = await writePreviewHtml(courseId, getLesson(courseId, lessonId));
    return ok({ courseId, lessonId, previewHtml: file, message: "Open this HTML file in a browser to preview the lesson." });
};

export const generateCoursePreviewsTool = async (courseId: string): Promise<string> => {
    const validation = await validateCourse(courseId);
    if (!validation.done) {
        return ok({
            ok: false,
            gated: true,
            message: "Course has not passed validation yet — fix it first, then generate previews.",
            reasons: validation.reasons,
        });
    }
    const previews: { lessonId: string; name: string; previewHtml: string }[] = [];
    for (const l of listLessons(courseId)) {
        previews.push({ lessonId: l.id, name: l.name, previewHtml: await writePreviewHtml(courseId, l) });
    }
    return ok({
        ok: true,
        courseId,
        previews,
        message: "Previews generated. Review them; once a human approves, call codevideo_render_course_videos to spawn per-lesson video rendering.",
    });
};

// ---------- video render (gated; queued for the background render worker) ----------

const lessonSpec = (course: { id: string; primaryLanguage: string }, l: StoredLesson, options: RenderOptions, open: boolean): JobSpec => ({
    kind: "course-lesson",
    courseId: course.id,
    lessonId: l.id,
    label: l.name || "lesson",
    project: toILesson(l),
    outputPath: newVideoPath(l.name || "lesson"),
    options,
    open,
    defaultLanguage: options.defaultLanguage ?? (course.primaryLanguage || "typescript"),
});

export const renderLessonVideoTool = async (courseId: string, lessonId: string, options: RenderOptions = {}, open = true): Promise<string> => {
    const validation = await validateCourse(courseId);
    if (!validation.done) {
        return ok({ ok: false, gated: true, message: "No video until the course passes validation. Fix the course first.", reasons: validation.reasons });
    }
    const course = getCourse(courseId);
    const lesson = getLesson(courseId, lessonId);
    const [job] = queueRenders([lessonSpec(course, lesson, options, open)]);
    return ok({
        ok: true,
        ...describeJob(job),
        estimatedSeconds: estimatedSeconds(lesson.actions, options),
        message: "Queued. It renders in the background; check it with codevideo_get_render_job.",
    });
};

export const renderCourseVideosTool = async (courseId: string, options: RenderOptions = {}, open = false): Promise<string> => {
    const validation = await validateCourse(courseId);
    if (!validation.done) {
        return ok({ ok: false, gated: true, message: "No video until the course passes validation. Fix the course first.", reasons: validation.reasons });
    }
    const course = getCourse(courseId);
    const jobs = queueRenders(course.lessons.map((l) => lessonSpec(course, l, options, open)));
    return ok({
        ok: true,
        courseId,
        jobs: jobs.map((job, i) => ({
            jobId: job.id,
            lessonId: job.lessonId,
            label: job.label,
            outputPath: job.outputPath,
            estimatedSeconds: estimatedSeconds(course.lessons[i].actions, options),
        })),
        message: `Queued ${jobs.length} lesson video(s). They render one at a time in the background; check them with codevideo_list_render_jobs({ courseId }).`,
    });
};
