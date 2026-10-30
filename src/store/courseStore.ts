import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { randomUUID } from 'node:crypto';
import { IAction, ICourse, ICourseSnapshot, IFileEntry, ILesson } from "@fullstackcraftllc/codevideo-types";
import { VirtualIDE } from "@fullstackcraftllc/codevideo-virtual-ide";
import { emptyCourseSnapshot } from "../utils/emptyCourseSnapshot";

/**
 * Server-side course store for the CodeVideo MCP.
 *
 * The whole point of this module: snapshots and full course/lesson objects live HERE,
 * inside the MCP process (a local SQLite file), keyed by id. The driving LLM only ever
 * sees actions, compile errors, and small targeted reads — never the multi-KB snapshots
 * that used to round-trip through its context and make full-course generation flakey.
 *
 * Snapshots are derived state: a lesson's finalSnapshot is recomputed from its
 * initialSnapshot + actions via the VirtualIDE, and "continuing" lessons chain off the
 * previous lesson's finalSnapshot. All of that happens server-side.
 */

// ---------- types ----------

export interface StoredLesson {
    id: string;
    courseId: string;
    name: string;
    description: string;
    /** Whether this lesson is expected to compile cleanly (false for slideshow/discussion/half-refactor lessons). */
    mustCompile: boolean;
    /** Whether the initialSnapshot is derived from the previous lesson's finalSnapshot. */
    continuesFromPrevious: boolean;
    actions: IAction[];
    initialSnapshot: ICourseSnapshot;
    finalSnapshot: ICourseSnapshot;
}

export interface StoredCourse {
    id: string;
    name: string;
    description: string;
    primaryLanguage: string;
    lessons: StoredLesson[];
}

// ---------- db plumbing ----------

const getDbPath = (): string => {
    const dbDir = path.join(os.homedir(), '.codevideo');
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    return path.join(dbDir, 'codevideo.db');
};

const openDb = (): Database.Database => {
    const db = new Database(getDbPath());
    db.pragma('journal_mode = WAL');
    db.exec(`
        CREATE TABLE IF NOT EXISTS courses (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            primary_language TEXT NOT NULL DEFAULT '',
            lesson_order TEXT NOT NULL DEFAULT '[]',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS lessons (
            id TEXT PRIMARY KEY,
            course_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            must_compile INTEGER NOT NULL DEFAULT 1,
            continues_from_previous INTEGER NOT NULL DEFAULT 1,
            actions TEXT NOT NULL DEFAULT '[]',
            initial_snapshot TEXT NOT NULL,
            final_snapshot TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
    `);
    return db;
};

/** Run a function with an open db connection, always closing it afterwards. */
const withDb = <T>(fn: (db: Database.Database) => T): T => {
    const db = openDb();
    try {
        return fn(db);
    } finally {
        db.close();
    }
};

// ---------- snapshot helpers (derive state via the VirtualIDE) ----------

/** Replay `actions` on top of `initial` and return the resulting course snapshot. */
export const snapshotFromActions = (initial: ICourseSnapshot, actions: IAction[]): ICourseSnapshot => {
    const virtualIDE = new VirtualIDE();
    virtualIDE.applyCourseSnapshot(initial);
    if (actions.length > 0) {
        virtualIDE.applyActions(actions);
    }
    return virtualIDE.getCourseSnapshot();
};

/** Materialize a snapshot into its file paths + contents (used for compile + file reads). */
export const fileEntriesFromSnapshot = (snapshot: ICourseSnapshot): IFileEntry[] => {
    const virtualIDE = new VirtualIDE();
    virtualIDE.applyCourseSnapshot(snapshot);
    return virtualIDE.getFullFilePathsAndContents();
};

// ---------- row <-> object mapping ----------

interface LessonRow {
    id: string;
    course_id: string;
    name: string;
    description: string;
    must_compile: number;
    continues_from_previous: number;
    actions: string;
    initial_snapshot: string;
    final_snapshot: string;
}

const rowToLesson = (row: LessonRow): StoredLesson => ({
    id: row.id,
    courseId: row.course_id,
    name: row.name,
    description: row.description,
    mustCompile: row.must_compile === 1,
    continuesFromPrevious: row.continues_from_previous === 1,
    actions: JSON.parse(row.actions),
    initialSnapshot: JSON.parse(row.initial_snapshot),
    finalSnapshot: JSON.parse(row.final_snapshot),
});

const getLessonOrder = (db: Database.Database, courseId: string): string[] => {
    const row = db.prepare(`SELECT lesson_order FROM courses WHERE id = ?`).get(courseId) as { lesson_order: string } | undefined;
    if (!row) throw new Error(`Course not found: ${courseId}`);
    return JSON.parse(row.lesson_order);
};

const getLessonsOrdered = (db: Database.Database, courseId: string): StoredLesson[] => {
    const order = getLessonOrder(db, courseId);
    const get = db.prepare(`SELECT * FROM lessons WHERE id = ?`);
    return order
        .map((id) => get.get(id) as LessonRow | undefined)
        .filter((r): r is LessonRow => !!r)
        .map(rowToLesson);
};

/**
 * Recompute the whole snapshot chain for a course. Non-continuing lessons keep their own
 * stored initialSnapshot; continuing lessons take the previous lesson's recomputed
 * finalSnapshot as their initial. Each lesson's finalSnapshot = initial + its actions.
 * Cheap (local VirtualIDE replay) and keeps continuity correct after any edit.
 */
const recomputeChain = (db: Database.Database, courseId: string): void => {
    const order = getLessonOrder(db, courseId);
    const getRow = db.prepare(`SELECT * FROM lessons WHERE id = ?`);
    const update = db.prepare(`UPDATE lessons SET initial_snapshot = ?, final_snapshot = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
    let previousFinal: ICourseSnapshot | null = null;
    const tx = db.transaction(() => {
        for (const lessonId of order) {
            const row = getRow.get(lessonId) as LessonRow | undefined;
            if (!row) continue;
            const lesson = rowToLesson(row);
            const initial = lesson.continuesFromPrevious && previousFinal ? previousFinal : lesson.initialSnapshot;
            const final = snapshotFromActions(initial, lesson.actions);
            update.run(JSON.stringify(initial), JSON.stringify(final), lessonId);
            previousFinal = final;
        }
    });
    tx();
};

// ---------- public API ----------

export const courseExists = (courseId: string): boolean =>
    withDb((db) => !!db.prepare(`SELECT 1 FROM courses WHERE id = ?`).get(courseId));

export const createCourse = (input: { name: string; description?: string; primaryLanguage?: string; id?: string }): string =>
    withDb((db) => {
        const id = input.id && input.id.trim().length > 0 ? input.id.trim() : randomUUID();
        db.prepare(`
            INSERT INTO courses (id, name, description, primary_language, lesson_order)
            VALUES (?, ?, ?, ?, '[]')
        `).run(id, input.name, input.description ?? '', input.primaryLanguage ?? '');
        return id;
    });

export const addLesson = (
    courseId: string,
    input: { name: string; description?: string; mustCompile?: boolean; continuesFromPrevious?: boolean; initialSnapshot?: ICourseSnapshot }
): string =>
    withDb((db) => {
        const order = getLessonOrder(db, courseId);
        const continuesFromPrevious = input.continuesFromPrevious ?? order.length > 0;

        // determine the starting snapshot
        let initial: ICourseSnapshot;
        if (continuesFromPrevious && order.length > 0) {
            const prev = db.prepare(`SELECT final_snapshot FROM lessons WHERE id = ?`).get(order[order.length - 1]) as { final_snapshot: string } | undefined;
            initial = prev ? JSON.parse(prev.final_snapshot) : emptyCourseSnapshot();
        } else {
            initial = input.initialSnapshot ?? emptyCourseSnapshot();
        }

        const lessonId = randomUUID();
        const tx = db.transaction(() => {
            db.prepare(`
                INSERT INTO lessons (id, course_id, name, description, must_compile, continues_from_previous, actions, initial_snapshot, final_snapshot)
                VALUES (?, ?, ?, ?, ?, ?, '[]', ?, ?)
            `).run(
                lessonId,
                courseId,
                input.name,
                input.description ?? '',
                (input.mustCompile ?? true) ? 1 : 0,
                continuesFromPrevious ? 1 : 0,
                JSON.stringify(initial),
                JSON.stringify(initial) // no actions yet => final == initial
            );
            order.push(lessonId);
            db.prepare(`UPDATE courses SET lesson_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(JSON.stringify(order), courseId);
        });
        tx();
        return lessonId;
    });

export const setLessonActions = (courseId: string, lessonId: string, actions: IAction[]): { actionCount: number } =>
    withDb((db) => {
        const exists = db.prepare(`SELECT 1 FROM lessons WHERE id = ? AND course_id = ?`).get(lessonId, courseId);
        if (!exists) throw new Error(`Lesson not found: ${lessonId} in course ${courseId}`);
        db.prepare(`UPDATE lessons SET actions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(JSON.stringify(actions), lessonId);
        recomputeChain(db, courseId);
        return { actionCount: actions.length };
    });

export const getLesson = (courseId: string, lessonId: string): StoredLesson =>
    withDb((db) => {
        const row = db.prepare(`SELECT * FROM lessons WHERE id = ? AND course_id = ?`).get(lessonId, courseId) as LessonRow | undefined;
        if (!row) throw new Error(`Lesson not found: ${lessonId} in course ${courseId}`);
        return rowToLesson(row);
    });

export const listLessons = (courseId: string): StoredLesson[] => withDb((db) => getLessonsOrdered(db, courseId));

export const getCourse = (courseId: string): StoredCourse =>
    withDb((db) => {
        const c = db.prepare(`SELECT id, name, description, primary_language FROM courses WHERE id = ?`).get(courseId) as
            | { id: string; name: string; description: string; primary_language: string }
            | undefined;
        if (!c) throw new Error(`Course not found: ${courseId}`);
        return {
            id: c.id,
            name: c.name,
            description: c.description,
            primaryLanguage: c.primary_language,
            lessons: getLessonsOrdered(db, courseId),
        };
    });

/** Export as a plain ICourse (the shape the CLI / exporters consume). */
export const exportCourse = (courseId: string): ICourse => {
    const course = getCourse(courseId);
    const lessons: ILesson[] = course.lessons.map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        actions: l.actions,
        initialSnapshot: l.initialSnapshot,
        finalSnapshot: l.finalSnapshot,
    }));
    return {
        id: course.id,
        name: course.name,
        description: course.description,
        primaryLanguage: course.primaryLanguage,
        lessons,
    } as ICourse;
};

/** Cheap, context-lean read: just the file paths present at the end of a lesson. */
export const getLessonFileTree = (courseId: string, lessonId: string): string[] => {
    const lesson = getLesson(courseId, lessonId);
    return fileEntriesFromSnapshot(lesson.finalSnapshot).map((f) => f.path).sort();
};

/** Cheap, context-lean read: the contents of a single file at the end of a lesson. */
export const getLessonFile = (courseId: string, lessonId: string, filePath: string): string | null => {
    const lesson = getLesson(courseId, lessonId);
    const entry = fileEntriesFromSnapshot(lesson.finalSnapshot).find((f) => f.path === filePath);
    return entry ? entry.content : null;
};

/** All files at the end of a lesson (used by the compile-check tool). */
export const getLessonFiles = (courseId: string, lessonId: string): IFileEntry[] => {
    const lesson = getLesson(courseId, lessonId);
    return fileEntriesFromSnapshot(lesson.finalSnapshot);
};
