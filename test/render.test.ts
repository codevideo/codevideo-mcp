import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { FAKE_CLI, homeEnv, isAlive, McpSession, startMcp, tempHome, waitFor } from "./helpers";

// Render jobs end to end through the MCP server: the real queue and background
// worker, with test/fixtures/fake-cli.mjs standing in for codevideo-cli.

interface Run {
    pid: number;
    args: string[];
    path: string;
    start: number;
    end: number;
}

const withRenderSession = async (fn: (mcp: McpSession, home: string) => Promise<void>): Promise<void> => {
    const home = tempHome();
    const mcp = await startMcp({
        ...homeEnv(home),
        PATH_TO_CODEVIDEO_CLI: FAKE_CLI,
        CODEVIDEO_OUTPUT_DIR: path.join(home, "videos"),
        FAKE_CLI_LOG: path.join(home, "cli-runs.jsonl"),
        FAKE_CLI_PIDS: path.join(home, "cli-pids.json"),
    });
    try {
        await fn(mcp, home);
    } finally {
        await mcp.close();
        // Let a worker that's still finishing up exit before removing its folder.
        await new Promise((resolve) => setTimeout(resolve, 500));
        fs.rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
};

const runs = (home: string): Run[] => {
    const file = path.join(home, "cli-runs.jsonl");
    return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : [];
};

const waitForStatus = async (mcp: McpSession, jobId: string, status: string) => {
    let last: any;
    try {
        return await waitFor(async () => {
            last = await mcp.call("codevideo_get_render_job", { jobId });
            return last.status === status ? last : undefined;
        }, 60_000, `job ${jobId} to be ${status}`);
    } catch (error) {
        throw new Error(`${(error as Error).message}; last seen: ${JSON.stringify(last)}`);
    }
};

const killTree = (pid: number): void => {
    if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"]);
    else try {
        process.kill(pid, "SIGKILL");
    } catch {
        // Already gone.
    }
};

test("tool calls wait for a locked database instead of failing", async () => {
    await withRenderSession(async (mcp, home) => {
        assert.deepEqual(await mcp.call("codevideo_list_render_jobs", {}), []);
        // Every call opens and closes its own connection, and the last one to
        // close briefly locks the whole file while it checkpoints the WAL. Hold
        // that kind of lock for a second.
        const db = new DatabaseSync(path.join(home, ".codevideo", "codevideo.db"));
        db.exec("PRAGMA locking_mode = EXCLUSIVE; BEGIN EXCLUSIVE; COMMIT;");
        const listed = mcp.call("codevideo_list_render_jobs", {});
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        db.close();
        assert.deepEqual(await listed, []);
    });
});

test("a video renders in the background with its options, and the job reports the saved file", async () => {
    await withRenderSession(async (mcp, home) => {
        const queued = await mcp.call("codevideo_make_video_from_actions", {
            actions: [{ name: "author-speak-before", value: "Hello there." }],
            options: { orientation: "portrait", isMouseVisible: false, isEditorTabsVisible: false },
        });
        assert.match(queued.jobId, /^[0-9a-f-]{36}$/);
        assert.equal(typeof queued.estimatedSeconds, "number");

        const job = await waitForStatus(mcp, queued.jobId, "succeeded");
        assert.equal(job.saved, true);
        assert.equal(fs.readFileSync(job.outputPath, "utf8"), "fake mp4");
        assert.equal(job.progress, "[100%] Done · 0:01");

        const [run] = runs(home);
        assert.deepEqual(run.args.slice(run.args.indexOf("-n"), run.args.indexOf("-n") + 2), ["-n", "portrait"]);
        assert.ok(run.args.includes("--open"), "single videos open when done by default");
        assert.equal(run.path.split(path.delimiter)[0], path.dirname(process.execPath), "the CLI finds the MCP's own Node first on PATH");
        const config = JSON.parse(fs.readFileSync(run.args[run.args.indexOf("-c") + 1], "utf8"));
        assert.deepEqual(config, { theme: "dark", defaultLanguage: "typescript", withCaptions: true, isMouseVisible: false, isEditorTabsVisible: false });
    });
});

test("a course renders lesson by lesson, without opening a player", async () => {
    await withRenderSession(async (mcp, home) => {
        const { courseId } = await mcp.call("codevideo_create_course", { name: "Two lessons", primaryLanguage: "typescript" });
        const typeAndSave = (file: string, text: string) => [
            { name: "author-speak-before", value: `Now ${file}.` },
            { name: "mouse-move-file-explorer", value: "1" },
            { name: "mouse-right-click", value: "1" },
            { name: "mouse-move-file-explorer-context-menu-new-file", value: "1" },
            { name: "mouse-left-click", value: "1" },
            { name: "file-explorer-type-new-file-input", value: file },
            { name: "file-explorer-enter-new-file-input", value: "1" },
            { name: "editor-type", value: text },
            { name: "editor-save", value: "1" },
        ];
        for (const [name, file] of [["One", "one.ts"], ["Two", "two.ts"]]) {
            const { lessonId } = await mcp.call("codevideo_add_lesson", { courseId, name, description: `Writes ${file}.` });
            await mcp.call("codevideo_set_lesson_actions", { courseId, lessonId, actions: typeAndSave(file, "export const n: number = 1;\n") });
        }
        const validation = await mcp.call("codevideo_validate_course", { courseId });
        assert.equal(validation.done, true, JSON.stringify(validation.reasons));

        const queued = await mcp.call("codevideo_render_course_videos", { courseId });
        assert.equal(queued.jobs.length, 2, JSON.stringify(queued));
        for (const job of queued.jobs) await waitForStatus(mcp, job.jobId, "succeeded");

        const recorded = runs(home);
        const [first, second] = recorded;
        assert.equal(recorded.length, 2, JSON.stringify(recorded));
        assert.ok(second.start >= first.end, `the second lesson started before the first finished: ${JSON.stringify(recorded)}`);
        assert.ok(!first.args.includes("--open") && !second.args.includes("--open"), "course renders don't open a player by default");
        const listed = await mcp.call("codevideo_list_render_jobs", { courseId });
        assert.deepEqual(listed.map((job: { status: string }) => job.status), ["succeeded", "succeeded"], JSON.stringify(listed));
    });
});

test("a failed render reports the CLI's error", async () => {
    await withRenderSession(async (mcp) => {
        const queued = await mcp.call("codevideo_make_video_from_actions", {
            actions: [{ name: "author-speak-before", value: "fake:fail" }],
            open: false,
        });
        const job = await waitForStatus(mcp, queued.jobId, "failed");
        assert.equal(job.error, "recording failed: exit status 1: CODEVIDEO_CHROME_PATH is not an executable file: /nonexistent/chrome");
        assert.ok(job.logTail.some((line: string) => line.startsWith("error: ")));
    });
});

test("cancelling a running job stops the CLI and what it started", async () => {
    await withRenderSession(async (mcp, home) => {
        const queued = await mcp.call("codevideo_make_video_from_actions", {
            actions: [{ name: "author-speak-before", value: "fake:hang" }],
            open: false,
        });
        await waitForStatus(mcp, queued.jobId, "running");
        const pidsFile = path.join(home, "cli-pids.json");
        const pids = await waitFor(async () => fs.existsSync(pidsFile) && JSON.parse(fs.readFileSync(pidsFile, "utf8")), 30_000, "the fake CLI's pids");

        const reply = await mcp.call("codevideo_cancel_render_job", { jobId: queued.jobId });
        assert.equal(reply.stopping, 1);
        const job = await waitForStatus(mcp, queued.jobId, "cancelled");
        await waitFor(async () => !isAlive(pids.pid) && !isAlive(pids.childPid), 15_000, "the CLI and its child to exit");
        assert.equal(fs.existsSync(job.outputPath), false, "the partial video is removed");
    });
});

test("a job left running by a worker that died is marked interrupted, and the queue carries on", async () => {
    await withRenderSession(async (mcp, home) => {
        const stuck = await mcp.call("codevideo_make_video_from_actions", {
            actions: [{ name: "author-speak-before", value: "fake:hang" }],
            open: false,
        });
        await waitForStatus(mcp, stuck.jobId, "running");
        const pidsFile = path.join(home, "cli-pids.json");
        const pids = await waitFor(async () => fs.existsSync(pidsFile) && JSON.parse(fs.readFileSync(pidsFile, "utf8")), 30_000, "the fake CLI's pids");

        const db = new DatabaseSync(path.join(home, ".codevideo", "codevideo.db"));
        db.exec("PRAGMA busy_timeout = 5000");
        const worker = db.prepare(`SELECT pid FROM render_worker WHERE id = 1`).get() as { pid: number };
        db.close();
        killTree(worker.pid);
        killTree(pids.pid);
        killTree(pids.childPid);
        await waitFor(async () => !isAlive(worker.pid), 15_000, "the worker to exit");

        const next = await mcp.call("codevideo_make_video_from_actions", {
            actions: [{ name: "author-speak-before", value: "After the crash." }],
            open: false,
        });
        await waitForStatus(mcp, next.jobId, "succeeded");
        const interrupted = await mcp.call("codevideo_get_render_job", { jobId: stuck.jobId });
        assert.equal(interrupted.status, "interrupted");
    });
});

test("projects too big for the CLI's command line are refused before queueing", async () => {
    await withRenderSession(async (mcp) => {
        const result = await mcp.callRaw("codevideo_make_video_from_actions", {
            actions: [{ name: "editor-type", value: "x".repeat(200 * 1024) }],
        });
        assert.equal(result.isError, true);
        assert.match(result.content[0].text, /KiB as JSON, more than the \d+ KiB the CLI can take/);
        assert.deepEqual(await mcp.call("codevideo_list_render_jobs", {}), []);
    });
});
