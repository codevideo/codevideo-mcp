import { ILesson } from "@fullstackcraftllc/codevideo-types";
import { getCurrentLessonOrThrow } from "./get_current_lesson";
import { RenderOptions } from "../render/options";
import { RenderJob } from "../render/jobs";
import { estimatedSeconds, newVideoPath, queueRenders } from "../render/queue";
import type { VideoResult } from "./make_video_from_actions";

/** Queues a video of a lesson (given, or the stored current lesson) for the background render worker. */
export const queueVideoFromLesson = (
    lesson?: ILesson,
    options: RenderOptions = {},
    open = true
): { job: RenderJob; estimatedSeconds: number } => {
    const lessonToUse = lesson || getCurrentLessonOrThrow();
    const [job] = queueRenders([{
        kind: "lesson",
        label: lessonToUse.name || "lesson",
        project: lessonToUse,
        outputPath: newVideoPath(lessonToUse.name),
        options,
        open,
        defaultLanguage: options.defaultLanguage ?? "typescript",
    }]);
    return { job, estimatedSeconds: estimatedSeconds(lessonToUse.actions, options) };
};

// Kept for the REST server, which reports results in this shape.
export const makeVideoFromLesson = async (lesson?: ILesson, options: RenderOptions = {}, open = true): Promise<VideoResult> => {
    try {
        const { job } = queueVideoFromLesson(lesson, options, open);
        return {
            outputPath: job.outputPath,
            jobId: job.id,
            stdout: `Video queued as render job ${job.id}; it renders in the background to ${job.outputPath}.`,
            stderr: "",
        };
    } catch (error: any) {
        return { outputPath: "", stdout: "", stderr: `Failed to queue the video: ${error.message}`, error };
    }
};
