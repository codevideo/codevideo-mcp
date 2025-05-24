import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { IAction } from "@fullstackcraftllc/codevideo-types";

// retrieves the current actions from the key value sqlite database
export const getCurrentActions = (): IAction[] | null => {
    try {
        const homeDir = os.homedir();
        const dbPath = path.join(homeDir, '.codevideo', 'codevideo.db');
        
        // Check if database file exists
        if (!fs.existsSync(dbPath)) {
            return null;
        }
        
        // Open database
        const db = new Database(dbPath);
        
        // Check if table exists
        const tableExists = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='key_value_store'
        `).get();
        
        if (!tableExists) {
            db.close();
            return null;
        }
        
        // Retrieve current_actions
        const stmt = db.prepare(`
            SELECT value FROM key_value_store 
            WHERE key = ?
        `);
        
        const result = stmt.get('current_actions') as { value: string } | undefined;
        db.close();
        
        if (!result) {
            return null;
        }
        
        // Parse JSON back to actions array
        const actions: IAction[] = JSON.parse(result.value);
        return actions;
    } catch (error: any) {
        console.error('Error retrieving actions:', error);
        return null;
    }
};

// Helper function that returns actions or throws descriptive error
export const getCurrentActionsOrThrow = (): IAction[] => {
    const actions = getCurrentActions();
    if (!actions) {
        throw new Error('No actions found in storage. Please use codevideo_set_current_actions first to store actions, then try again.');
    }
    return actions;
};
