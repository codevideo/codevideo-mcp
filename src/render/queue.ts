import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { IAction, estimateVideoDurationInSeconds } from "@fullstackcraftllc/codevideo-types";
import { enqueueJobs, getJob, jobDir, JobSpec, queuePosition, RenderJob } from "./jobs";
import { ensureWorker } from "./worker";
import { estimatePauses, RenderOptions } from "./options";

/** Where videos are saved: CODEVIDEO_OUTPUT_DIR, or the Desktop. */
export const outputDirectory = (): string => process.env.CODEVIDEO_OUTPUT_DIR || path.join(os.homedir(), "Desktop");

const timestamp = (): string => new Date().toISOString().replace(/[:.]/g, "-");

/** A new video path in the output directory, optionally named after a lesson. */
export const newVideoPath = (name?: string): string => {
    const safe = (name ?? "").replace(/[^a-z0-9-_]+/gi, "_").slice(0, 40);
    return path.join(outputDirectory(), safe ? `codevideo-${safe}-${timestamp()}.mp4` : `codevideo-${timestamp()}.mp4`);
};

/** Rough video length in seconds at the render page's pauses (or the options'). */
export const estimatedSeconds = (actions: IAction[], options?: RenderOptions): number =>
    Math.round(estimateVideoDurationInSeconds(actions, estimatePauses(options)));

/** Queues jobs in order and makes sure the background worker is running them. */
export const queueRenders = (specs: JobSpec[]): RenderJob[] => {
    const jobs = enqueueJobs(specs);
    ensureWorker();
    return jobs;
};

const lastLines = (file: string, count: number): string[] => {
    try {
        return fs.readFileSync(file, "utf8").split("\n").map((line) => line.trimEnd()).filter(Boolean).slice(-count);
    } catch {
        return [];
    }
};

/** A compact view of a job for tool replies; the log tail only when asked for. */
export const describeJob = (job: RenderJob, withLog = false): Record<string, unknown> => {
    const position = job.status === "queued" ? queuePosition(job.id) : null;
    return {
        jobId: job.id,
        label: job.label,
        status: job.status,
        ...(position !== null ? { jobsAhead: position } : {}),
        outputPath: job.outputPath,
        ...(job.status === "succeeded" ? { saved: true } : {}),
        ...(job.progress ? { progress: job.progress } : {}),
        ...(job.error ? { error: job.error } : {}),
        createdAt: job.createdAt,
        ...(job.startedAt ? { startedAt: job.startedAt } : {}),
        ...(job.finishedAt ? { finishedAt: job.finishedAt } : {}),
        ...(withLog ? { logTail: lastLines(path.join(jobDir(job.id), "stderr.log"), 8), logs: jobDir(job.id) } : {}),
    };
};

export const describeJobById = (jobId: string, withLog = false): Record<string, unknown> | null => {
    const job = getJob(jobId);
    return job ? describeJob(job, withLog) : null;
};
