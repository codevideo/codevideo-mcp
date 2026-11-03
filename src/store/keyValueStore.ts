import { databasePath, withDatabase } from "./db";

/**
 * The single-slot key-value store behind the legacy tools
 * (codevideo_set_current_actions, codevideo_set_current_lesson and the tools that
 * read them). Every conversation shares one slot per key; the course tools keep
 * courses apart by id.
 */

const SCHEMA = `
    CREATE TABLE IF NOT EXISTS key_value_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`;

/** Stores value under key and returns the database path. */
export const setStoredValue = (key: string, value: string): string =>
    withDatabase((db) => {
        db.exec(SCHEMA);
        db.prepare(`INSERT OR REPLACE INTO key_value_store (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`).run(key, value);
        return databasePath();
    });

/** The value stored under key, or null when there is none. */
export const getStoredValue = (key: string): string | null =>
    withDatabase((db) => {
        db.exec(SCHEMA);
        const row = db.prepare(`SELECT value FROM key_value_store WHERE key = ?`).get(key) as { value: string } | undefined;
        return row ? row.value : null;
    });
