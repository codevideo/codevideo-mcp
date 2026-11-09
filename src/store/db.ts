import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import type { DatabaseSync } from "node:sqlite";

/**
 * The MCP's one SQLite database, ~/.codevideo/codevideo.db, on Node's built-in
 * node:sqlite (Node 22.13+), so installs need no native addon. The MCP server
 * and the background render worker share it: WAL lets one read while the
 * other writes, and the busy timeout makes a writer wait instead of failing.
 */

export type Db = DatabaseSync;

/** ~/.codevideo, created on first use. The database, render jobs, exports and previews live here. */
export const codevideoHome = (): string => {
    const dir = process.env.CODEVIDEO_HOME || path.join(os.homedir(), ".codevideo");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
};

export const databasePath = (): string => path.join(codevideoHome(), "codevideo.db");

let sqlite: typeof import("node:sqlite") | undefined;

// Node 22-24 print "SQLite is an experimental feature" when the module first
// loads. Load it lazily with that one warning muted so stderr stays clean.
const loadSqlite = (): typeof import("node:sqlite") => {
    if (!sqlite) {
        const emitWarning = process.emitWarning;
        process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
            const message = typeof warning === "string" ? warning : warning.message;
            if (/SQLite/.test(message)) return;
            return (emitWarning as (...args: unknown[]) => void).call(process, warning, ...rest);
        }) as typeof process.emitWarning;
        try {
            sqlite = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
        } finally {
            process.emitWarning = emitWarning;
        }
    }
    return sqlite;
};

export const openDatabase = (): Db => {
    // Newer Node renames the class to Database and keeps DatabaseSync as an alias.
    const db = new (loadSqlite().DatabaseSync)(databasePath());
    // The timeout goes first so the WAL pragma waits too: the MCP server and the
    // render worker open connections all the time, and one may be holding the
    // file for a moment (checkpointing as the last to close).
    db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
    return db;
};

/** Runs fn with an open connection and always closes it afterwards. */
export const withDatabase = <T>(fn: (db: Db) => T): T => {
    const db = openDatabase();
    try {
        return fn(db);
    } finally {
        db.close();
    }
};

/**
 * Runs fn in a write transaction: everything commits or nothing does.
 * BEGIN IMMEDIATE takes the write lock up front, so the server and the worker
 * can't both read a row and then race to update it.
 */
export const transaction = <T>(db: Db, fn: () => T): T => {
    db.exec("BEGIN IMMEDIATE");
    try {
        const result = fn();
        db.exec("COMMIT");
        return result;
    } catch (error) {
        db.exec("ROLLBACK");
        throw error;
    }
};
