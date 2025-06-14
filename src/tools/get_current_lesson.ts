import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { ILesson } from "@fullstackcraftllc/codevideo-types";
import { CURRENT_LESSON_KEY } from "../constants/Constants";

// retrieves the current lesson from the key value sqlite database
export const getCurrentLesson = (): ILesson | null => {
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
        
        // Retrieve current_lesson
        const stmt = db.prepare(`
            SELECT value FROM key_value_store 
            WHERE key = ?
        `);
        
        const result = stmt.get(CURRENT_LESSON_KEY) as { value: string } | undefined;
        db.close();
        
        if (!result) {
            return null;
        }
        
        // Parse JSON back to lesson object
        const lesson: ILesson = JSON.parse(result.value);
        return lesson;
    } catch (error: any) {
        console.error('Error retrieving lesson:', error);
        return null;
    }
};

// Helper function that returns lesson or throws descriptive error
export const getCurrentLessonOrThrow = (): ILesson => {
    const lesson = getCurrentLesson();
    if (!lesson) {
        throw new Error('No lesson found in storage. Please use codevideo_set_current_lesson first to store a lesson, then try again.');
    }
    return lesson;
};
