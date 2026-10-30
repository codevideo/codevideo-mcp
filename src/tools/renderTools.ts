import os from "os";
import fs from "fs";
import path from "path";
import { ILesson } from "@fullstackcraftllc/codevideo-types";
import { generateHtmlStringFromLesson } from "@fullstackcraftllc/codevideo-exporters";
import { getLesson, listLessons, StoredLesson } from "../store/courseStore";
import { validateCourse } from "./courseTools";
import { getCodeVideoCliRuntime } from "../utils/getBinaryPath";
import { spawnDetached } from "../utils/spawnDetached";

// Phase 2: previews + video render, gated behind validation.
// - Previews are server-side HTML (cheap, no browser needed in the MCP) for the
//   human-in-the-loop "does this look right?" check before any expensive rendering.
// - Video render spawns the codevideo-cli per lesson, ONLY once the course passes
//   validate_course. (Real PNG/snapshot previews need a headless render step — best added
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

// ---------- video render (gated; spawns codevideo-cli per lesson) ----------

const spawnLessonVideo = async (lesson: ILesson): Promise<string> => {
    const runtime = getCodeVideoCliRuntime();
    const desktopDir = process.env.CODEVIDEO_OUTPUT_DIR || path.join(os.homedir(), "Desktop");
    fs.mkdirSync(desktopDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeName = (lesson.name || "lesson").replace(/[^a-z0-9-_]+/gi, "_").slice(0, 40) || "lesson";
    const outputFile = path.join(desktopDir, `codevideo-${safeName}-${timestamp}.mp4`);
    await spawnDetached(runtime.binaryPath, ["-p", JSON.stringify(lesson), "-o", outputFile], {
        cwd: process.cwd(),
        env: runtime.env,
    });
    return outputFile;
};

export const renderLessonVideoTool = async (courseId: string, lessonId: string): Promise<string> => {
    const validation = await validateCourse(courseId);
    if (!validation.done) {
        return ok({ ok: false, gated: true, message: "No video until the course passes validation. Fix the course first.", reasons: validation.reasons });
    }
    const outputPath = await spawnLessonVideo(toILesson(getLesson(courseId, lessonId)));
    return ok({ ok: true, lessonId, outputPath, message: `Video render started in the background: ${outputPath}` });
};

export const renderCourseVideosTool = async (courseId: string): Promise<string> => {
    const validation = await validateCourse(courseId);
    if (!validation.done) {
        return ok({ ok: false, gated: true, message: "No video until the course passes validation. Fix the course first.", reasons: validation.reasons });
    }
    const jobs = await Promise.all(listLessons(courseId).map(async (l) => ({
        lessonId: l.id,
        name: l.name,
        outputPath: await spawnLessonVideo(toILesson(l)),
    })));
    return ok({ ok: true, courseId, jobs, message: `Started ${jobs.length} background video render jobs (one per lesson).` });
};
