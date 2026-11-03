import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { codevideoHome, Db, transaction, withDatabase } from "../store/db";
import { ideConfigFor, maxProjectArgumentBytes } from "./cli";
import { RenderOptions } from "./options";

/**
 * Render jobs, kept in the shared database so the background worker and any
 * MCP server process see the same queue. Each job also has a folder,
 * ~/.codevideo/jobs/<id>/, holding its project, config and the CLI's logs.
 */

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "interrupted";
export type JobKind = "actions" | "lesson" | "course-lesson";

export interface RenderJob {
    id: string;
    kind: JobKind;
    courseId: string | null;
    lessonId: string | null;
    label: string;
    outputPath: string;
    options: RenderOptions;
    open: boolean;
    status: JobStatus;
    pid: number | null;
    progress: string | null;
    error: string | null;
    cancelRequested: boolean;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
}

export interface JobSpec {
    kind: JobKind;
    courseId?: string;
    lessonId?: string;
    label: string;
    /** The actions array, lesson or course the CLI renders. */
    project: unknown;
    outputPath: string;
    options: RenderOptions;
    open: boolean;
    /** For the CLI's config file when IDE options are set. */
    defaultLanguage: string;
}

const SCHEMA = `
    CREATE TABLE IF NOT EXISTS render_jobs (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        course_id TEXT,
        lesson_id TEXT,
        label TEXT NOT NULL DEFAULT '',
        output_path TEXT NOT NULL,
        options TEXT NOT NULL DEFAULT '{}',
        open INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        pid INTEGER,
        progress TEXT,
        error TEXT,
        cancel_requested INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON render_jobs(status);
    CREATE TABLE IF NOT EXISTS render_worker (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        pid INTEGER NOT NULL,
        heartbeat_at INTEGER NOT NULL
    );
`;

/** A worker that hasn't written its heartbeat for this long is gone. */
export const WORKER_STALE_MS = 10_000;

const withJobs = <T>(fn: (db: Db) => T): T =>
    withDatabase((db) => {
        db.exec(SCHEMA);
        return fn(db);
    });

export const jobDir = (id: string): string => path.join(codevideoHome(), "jobs", id);

interface JobRow {
    id: string;
    kind: string;
    course_id: string | null;
    lesson_id: string | null;
    label: string;
    output_path: string;
    options: string;
    open: number;
    status: string;
    pid: number | null;
    progress: string | null;
    error: string | null;
    cancel_requested: number;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
}

const toJob = (row: JobRow): RenderJob => ({
    id: row.id,
    kind: row.kind as JobKind,
    courseId: row.course_id,
    lessonId: row.lesson_id,
    label: row.label,
    outputPath: row.output_path,
    options: JSON.parse(row.options),
    open: row.open === 1,
    status: row.status as JobStatus,
    pid: row.pid,
    progress: row.progress,
    error: row.error,
    cancelRequested: row.cancel_requested === 1,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
});

const now = (): string => new Date().toISOString();

/**
 * Queues jobs in order, writing each one's project (and config) to its folder.
 * Refuses the whole batch if any project is too big for the CLI's -p argument.
 */
export const enqueueJobs = (specs: JobSpec[]): RenderJob[] => {
    const prepared = specs.map((spec) => {
        const projectJson = JSON.stringify(spec.project);
        const bytes = Buffer.byteLength(projectJson);
        if (bytes > maxProjectArgumentBytes()) {
            throw new Error(
                `"${spec.label}" is ${Math.ceil(bytes / 1024)} KiB as JSON, more than the ${Math.floor(maxProjectArgumentBytes() / 1024)} KiB ` +
                    "the CLI can take on its command line here. Split it into smaller lessons."
            );
        }
        return { spec, projectJson, id: randomUUID() };
    });
    for (const { spec, projectJson, id } of prepared) {
        const dir = jobDir(id);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "project.json"), projectJson);
        const config = ideConfigFor(spec.options, spec.defaultLanguage);
        if (config) fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify(config, null, 2));
    }
    return withJobs((db) =>
        transaction(db, () => {
            const insert = db.prepare(`
                INSERT INTO render_jobs (id, kind, course_id, lesson_id, label, output_path, options, open, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)
            `);
            return prepared.map(({ spec, id }) => {
                insert.run(id, spec.kind, spec.courseId ?? null, spec.lessonId ?? null, spec.label, spec.outputPath, JSON.stringify(spec.options), spec.open ? 1 : 0, now());
                return toJob(db.prepare(`SELECT * FROM render_jobs WHERE id = ?`).get(id) as unknown as JobRow);
            });
        })
    );
};

export const getJob = (id: string): RenderJob | null =>
    withJobs((db) => {
        const row = db.prepare(`SELECT * FROM render_jobs WHERE id = ?`).get(id) as unknown as JobRow | undefined;
        return row ? toJob(row) : null;
    });

/** Jobs newest first, optionally for one course or in one status. */
export const listJobs = (filter: { courseId?: string; status?: JobStatus; limit?: number } = {}): RenderJob[] =>
    withJobs((db) => {
        const where: string[] = [];
        const params: string[] = [];
        if (filter.courseId) {
            where.push("course_id = ?");
            params.push(filter.courseId);
        }
        if (filter.status) {
            where.push("status = ?");
            params.push(filter.status);
        }
        const sql = `SELECT * FROM render_jobs ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY rowid DESC LIMIT ?`;
        return (db.prepare(sql).all(...params, filter.limit ?? 20) as unknown as JobRow[]).map(toJob);
    });

/** How many queued jobs will run before this one (0 = next), or null when it isn't queued. */
export const queuePosition = (id: string): number | null =>
    withJobs((db) => {
        const row = db.prepare(`SELECT rowid AS seq, status FROM render_jobs WHERE id = ?`).get(id) as { seq: number; status: string } | undefined;
        if (!row || row.status !== "queued") return null;
        const ahead = db.prepare(`SELECT COUNT(*) AS n FROM render_jobs WHERE status = 'queued' AND rowid < ?`).get(row.seq) as { n: number };
        return ahead.n;
    });

/**
 * Cancels one job, or every unfinished job of a course. Queued jobs are
 * cancelled at once; running ones are flagged, and the worker stops them.
 */
export const requestCancel = (target: { jobId?: string; courseId?: string }): { cancelled: number; stopping: number } =>
    withJobs((db) =>
        transaction(db, () => {
            const [column, value] = target.jobId ? ["id", target.jobId] : ["course_id", target.courseId ?? ""];
            const cancelled = db
                .prepare(`UPDATE render_jobs SET status = 'cancelled', finished_at = ? WHERE ${column} = ? AND status = 'queued'`)
                .run(now(), value).changes;
            const stopping = db
                .prepare(`UPDATE render_jobs SET cancel_requested = 1 WHERE ${column} = ? AND status = 'running'`)
                .run(value).changes;
            return { cancelled: Number(cancelled), stopping: Number(stopping) };
        })
    );

// ---------- worker side ----------

/** Takes the oldest queued job and marks it running, or returns null when the queue is empty. */
export const claimNextJob = (): RenderJob | null =>
    withJobs((db) =>
        transaction(db, () => {
            const row = db.prepare(`SELECT * FROM render_jobs WHERE status = 'queued' ORDER BY rowid LIMIT 1`).get() as unknown as JobRow | undefined;
            if (!row) return null;
            db.prepare(`UPDATE render_jobs SET status = 'running', started_at = ? WHERE id = ?`).run(now(), row.id);
            return toJob({ ...row, status: "running" });
        })
    );

export const hasQueuedJobs = (): boolean =>
    withJobs((db) => !!db.prepare(`SELECT 1 FROM render_jobs WHERE status = 'queued' LIMIT 1`).get());

export const setJobPid = (id: string, pid: number): void =>
    withJobs((db) => {
        db.prepare(`UPDATE render_jobs SET pid = ? WHERE id = ?`).run(pid, id);
    });

export const setJobProgress = (id: string, progress: string): void =>
    withJobs((db) => {
        db.prepare(`UPDATE render_jobs SET progress = ? WHERE id = ?`).run(progress, id);
    });

export const isCancelRequested = (id: string): boolean =>
    withJobs((db) => !!db.prepare(`SELECT 1 FROM render_jobs WHERE id = ? AND cancel_requested = 1`).get(id));

export const finishJob = (id: string, status: Exclude<JobStatus, "queued" | "running">, error: string | null): void =>
    withJobs((db) => {
        db.prepare(`UPDATE render_jobs SET status = ?, error = ?, finished_at = ? WHERE id = ?`).run(status, error, now(), id);
    });

export const isProcessAlive = (pid: number): boolean => {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return (error as NodeJS.ErrnoException).code === "EPERM";
    }
};

/** The worker currently draining the queue, if its process is alive and its heartbeat recent. */
export const liveWorker = (): { pid: number } | null =>
    withJobs((db) => {
        const row = db.prepare(`SELECT pid, heartbeat_at FROM render_worker WHERE id = 1`).get() as { pid: number; heartbeat_at: number } | undefined;
        if (!row || Date.now() - row.heartbeat_at > WORKER_STALE_MS || !isProcessAlive(row.pid)) return null;
        return { pid: row.pid };
    });

/** Makes pid the queue's worker unless another live worker already is. */
export const acquireWorkerLock = (pid: number): boolean =>
    withJobs((db) =>
        transaction(db, () => {
            const row = db.prepare(`SELECT pid, heartbeat_at FROM render_worker WHERE id = 1`).get() as { pid: number; heartbeat_at: number } | undefined;
            if (row && row.pid !== pid && Date.now() - row.heartbeat_at <= WORKER_STALE_MS && isProcessAlive(row.pid)) return false;
            db.prepare(`INSERT OR REPLACE INTO render_worker (id, pid, heartbeat_at) VALUES (1, ?, ?)`).run(pid, Date.now());
            return true;
        })
    );

export const workerHeartbeat = (pid: number): void =>
    withJobs((db) => {
        db.prepare(`UPDATE render_worker SET heartbeat_at = ? WHERE id = 1 AND pid = ?`).run(Date.now(), pid);
    });

export const releaseWorkerLock = (pid: number): void =>
    withJobs((db) => {
        db.prepare(`DELETE FROM render_worker WHERE id = 1 AND pid = ?`).run(pid);
    });

/** Jobs left running by a worker that died; called before starting a new one. */
export const markOrphanedJobsInterrupted = (): number =>
    withJobs((db) =>
        Number(
            db.prepare(`UPDATE render_jobs SET status = 'interrupted', error = 'The render worker stopped before this job finished.', finished_at = ? WHERE status = 'running'`)
                .run(now()).changes
        )
    );
