import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { getCodeVideoCliRuntime } from "../utils/getBinaryPath";
import { codevideoHome } from "../store/db";
import { cliArgs, cliEnv, parseCliLine } from "./cli";
import {
    acquireWorkerLock,
    claimNextJob,
    finishJob,
    hasQueuedJobs,
    isCancelRequested,
    jobDir,
    liveWorker,
    markOrphanedJobsInterrupted,
    releaseWorkerLock,
    RenderJob,
    setJobPid,
    setJobProgress,
    workerHeartbeat,
} from "./jobs";

/**
 * The background render worker: a detached process, started on demand by the
 * MCP server, that renders queued jobs one at a time and exits when the queue
 * is empty. It outlives the MCP client, so closing Claude doesn't stop a
 * course halfway. One CLI at a time, because every CLI run binds port 7001
 * for its embedded site; running renders in parallel would need a port
 * override in the CLI.
 */

const HEARTBEAT_MS = 2_000;
const CANCEL_POLL_MS = 500;
const KILL_GRACE_MS = 10_000;

const log = (message: string): void => {
    try {
        fs.appendFileSync(path.join(codevideoHome(), "jobs", "worker.log"), `${new Date().toISOString()} [${process.pid}] ${message}\n`);
    } catch {
        // Logging must never take the worker down.
    }
};

/**
 * Runs a database update from a timer or stream callback, where a throw would
 * crash the worker mid-render; a missed heartbeat or progress line is harmless.
 */
const quietly = (what: string, fn: () => void): void => {
    try {
        fn();
    } catch (error) {
        log(`${what} failed: ${(error as Error).message}`);
    }
};

/**
 * Makes sure a worker is draining the queue: starts one unless a live worker
 * already is. Call it after queueing jobs.
 */
export const ensureWorker = (): void => {
    if (liveWorker()) return;
    const orphaned = markOrphanedJobsInterrupted();
    if (orphaned > 0) log(`marked ${orphaned} job(s) left by a stopped worker as interrupted`);
    const entry = process.argv[1];
    if (!entry) throw new Error("Can't start the render worker: the MCP's entry script is unknown.");
    const child = spawn(process.execPath, [...process.execArgv, entry, "--render-worker"], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        env: process.env,
    });
    child.unref();
};

/** The worker's main loop; resolves when there's nothing left to render. */
export const runWorker = async (): Promise<void> => {
    fs.mkdirSync(path.join(codevideoHome(), "jobs"), { recursive: true });
    while (acquireWorkerLock(process.pid)) {
        log("worker started");
        const heartbeat = setInterval(() => quietly("heartbeat", () => workerHeartbeat(process.pid)), HEARTBEAT_MS);
        try {
            for (let job = claimNextJob(); job; job = claimNextJob()) {
                await runJob(job);
            }
        } finally {
            clearInterval(heartbeat);
            releaseWorkerLock(process.pid);
        }
        // A job queued while this worker was finishing saw it as alive and didn't
        // start another one, so look again before exiting.
        if (!hasQueuedJobs()) break;
    }
    log("worker exiting: queue empty");
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Whether any process is left in a process group (Unix). */
const groupAlive = (pgid: number): boolean => {
    try {
        process.kill(-pgid, 0);
        return true;
    } catch (error) {
        return (error as NodeJS.ErrnoException).code === "EPERM";
    }
};

/**
 * Stops the CLI and everything it started (node, Chrome, ffmpeg), and resolves
 * once they're gone. On Unix the CLI leads its own process group. It gets
 * SIGINT, not SIGTERM: the recorder's Puppeteer answers SIGTERM by closing
 * Chrome and staying alive, but answers SIGINT by closing Chrome and exiting.
 * Anything still in the group after the grace period gets SIGKILL.
 */
const stopTree = async (child: ChildProcess): Promise<void> => {
    if (!child.pid) return;
    if (process.platform === "win32") {
        spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true });
        return;
    }
    const group = child.pid;
    const signal = (name: NodeJS.Signals) => {
        try {
            process.kill(-group, name);
        } catch {
            // Already gone.
        }
    };
    signal("SIGINT");
    for (const deadline = Date.now() + KILL_GRACE_MS; groupAlive(group) && Date.now() < deadline; ) await sleep(200);
    if (groupAlive(group)) {
        log(`process group ${group} outlived SIGINT by ${KILL_GRACE_MS / 1000}s; killing it`);
        signal("SIGKILL");
    }
};

/** Feeds a stream's text to onLine one complete line at a time, also copying it to a file. */
const followLines = (stream: NodeJS.ReadableStream, file: fs.WriteStream, onLine: (line: string) => void): void => {
    let pending = "";
    stream.on("data", (chunk: Buffer) => {
        file.write(chunk);
        pending += chunk.toString("utf8");
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        lines.forEach((line) => onLine(line.replace(/\r$/, "")));
    });
    stream.on("end", () => {
        if (pending) onLine(pending);
        file.end();
    });
};

const runJob = async (job: RenderJob): Promise<void> => {
    const dir = jobDir(job.id);
    try {
        const runtime = getCodeVideoCliRuntime();
        const configPath = path.join(dir, "config.json");
        const args = cliArgs({
            projectJson: fs.readFileSync(path.join(dir, "project.json"), "utf8"),
            outputPath: job.outputPath,
            configPath: fs.existsSync(configPath) ? configPath : undefined,
            options: job.options,
            open: job.open,
        });
        fs.mkdirSync(path.dirname(job.outputPath), { recursive: true });
        log(`job ${job.id} (${job.label}) starting`);

        // PATH_TO_CODEVIDEO_CLI may name a Node script (a wrapper, or the tests'
        // fake CLI); run those with this Node, since Windows can't execute them.
        const [command, commandArgs] = /\.[cm]?js$/i.test(runtime.binaryPath)
            ? [process.execPath, [runtime.binaryPath, ...args]]
            : [runtime.binaryPath, args];
        const child = spawn(command, commandArgs, {
            cwd: dir,
            env: cliEnv(runtime.env, job.options),
            // Its own process group on Unix, so a cancel can stop Chrome too.
            detached: process.platform !== "win32",
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
        });
        if (child.pid) setJobPid(job.id, child.pid);

        let lastError: string | null = null;
        let lastProgress: string | null = null;
        const onLine = (line: string): void => {
            const parsed = parseCliLine(line);
            if (parsed.kind === "progress" && parsed.text !== lastProgress) {
                lastProgress = parsed.text;
                quietly("progress update", () => setJobProgress(job.id, parsed.text));
            } else if (parsed.kind === "error") {
                lastError = parsed.text;
            }
        };
        followLines(child.stdout!, fs.createWriteStream(path.join(dir, "stdout.log")), onLine);
        followLines(child.stderr!, fs.createWriteStream(path.join(dir, "stderr.log")), onLine);

        let stopping: Promise<void> | undefined;
        const cancelPoll = setInterval(() => quietly("cancel check", () => {
            if (!stopping && isCancelRequested(job.id)) {
                log(`job ${job.id} cancelling`);
                stopping = stopTree(child);
            }
        }), CANCEL_POLL_MS);

        const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null; spawnError?: Error }>((resolve) => {
            child.once("error", (spawnError) => resolve({ code: null, signal: null, spawnError }));
            child.once("close", (code, signal) => resolve({ code, signal }));
        });
        clearInterval(cancelPoll);

        if (stopping) {
            // Settle only once nothing from this job is left running. Any file at
            // the output path is a partial video: the path is new for each job.
            await stopping;
            fs.rmSync(job.outputPath, { force: true });
            finishJob(job.id, "cancelled", null);
        } else if (exit.spawnError) {
            finishJob(job.id, "failed", `Couldn't start codevideo-cli: ${exit.spawnError.message}`);
        } else if (exit.code === 0 && fs.existsSync(job.outputPath) && fs.statSync(job.outputPath).size > 0) {
            finishJob(job.id, "succeeded", null);
        } else {
            const how = exit.code === 0 ? "exited without writing the video" : exit.code !== null ? `exited with code ${exit.code}` : `was stopped by ${exit.signal}`;
            finishJob(job.id, "failed", lastError ?? `codevideo-cli ${how}; see ${path.join(dir, "stderr.log")}`);
        }
        log(`job ${job.id} finished`);
    } catch (error) {
        finishJob(job.id, "failed", (error as Error).message);
        log(`job ${job.id} failed in the worker: ${(error as Error).stack ?? error}`);
    }
};
