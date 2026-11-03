import { IAction } from "@fullstackcraftllc/codevideo-types";
import { getCurrentActionsOrThrow } from "./get_current_actions";
import { RenderOptions } from "../render/options";
import { RenderJob } from "../render/jobs";
import { estimatedSeconds, newVideoPath, queueRenders } from "../render/queue";

export interface VideoResult {
    outputPath: string;
    stdout: string;
    stderr: string;
    error?: any;
    jobId?: string;
}

/** Queues a video of actions (given, or the stored current actions) for the background render worker. */
export const queueVideoFromActions = (
    actions?: IAction[],
    options: RenderOptions = {},
    open = true
): { job: RenderJob; estimatedSeconds: number } => {
    const actionsToUse = actions || getCurrentActionsOrThrow();
    const [job] = queueRenders([{
        kind: "actions",
        label: `${actionsToUse.length} actions`,
        project: actionsToUse,
        outputPath: newVideoPath(),
        options,
        open,
        defaultLanguage: options.defaultLanguage ?? "typescript",
    }]);
    return { job, estimatedSeconds: estimatedSeconds(actionsToUse, options) };
};

// Kept for the REST server, which reports results in this shape.
export const makeVideoFromActions = async (actions?: IAction[], options: RenderOptions = {}, open = true): Promise<VideoResult> => {
    try {
        const { job } = queueVideoFromActions(actions, options, open);
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
