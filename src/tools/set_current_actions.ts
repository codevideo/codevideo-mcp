import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { IAction } from "@fullstackcraftllc/codevideo-types";

// sets the current actions to the key value sqlite database
export const setCurrentActions = (actions: IAction[]): string => {
    try {
        // Create database directory if it doesn't exist
        const homeDir = os.homedir();
        const dbDir = path.join(homeDir, '.codevideo');
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        
        const dbPath = path.join(dbDir, 'codevideo.db');
        
        // Open or create database
        const db = new Database(dbPath);
        
        // Create table if it doesn't exist
        db.exec(`
            CREATE TABLE IF NOT EXISTS key_value_store (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Prepare statement to insert or replace the current_actions
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO key_value_store (key, value, updated_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `);
        
        // Convert actions to JSON string and store
        const actionsJson = JSON.stringify(actions);
        stmt.run('current_actions', actionsJson);
        
        db.close();
        
        return `Successfully stored ${actions.length} actions in local database at ${dbPath}`;
    } catch (error: any) {
        return `Error storing actions: ${error.message}`;
    }
};