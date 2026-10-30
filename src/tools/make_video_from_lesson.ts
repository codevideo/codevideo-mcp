import os from "os";
import fs from "fs";
import path from "path";
import { ILesson } from "@fullstackcraftllc/codevideo-types";
import { getCurrentLessonOrThrow } from "./get_current_lesson";
import { getCodeVideoCliRuntime } from "../utils/getBinaryPath";
import { spawnDetached } from "../utils/spawnDetached";

export interface VideoResult {
    outputPath: string;
    stdout: string;
    stderr: string;
    error?: any;
}

export const makeVideoFromLesson = async (lesson?: ILesson): Promise<VideoResult> => {
    try {
        const runtime = getCodeVideoCliRuntime();
        // Use provided lesson or retrieve from storage
        const lessonToUse = lesson || getCurrentLessonOrThrow();
        // Create JSON string directly
        const lessonJson = JSON.stringify(lessonToUse);

        // Create output file on desktop with timestamp
        const homeDir = os.homedir();
        const desktopDir = process.env.CODEVIDEO_OUTPUT_DIR || path.join(homeDir, 'Desktop');
        fs.mkdirSync(desktopDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFile = path.join(desktopDir, `codevideo-${timestamp}.mp4`);
        
        // Fire-and-forget: Start the video generation process in the background
        await spawnDetached(
            runtime.binaryPath,
            ['-p', lessonJson, '-o', outputFile, '--open'],
            {
                cwd: process.cwd(),
                env: runtime.env,
            }
        );
        
        // Return immediately with status message
        return {
            outputPath: outputFile,
            stdout: `Video generation job with lesson has started in the background via the codevideo-cli command. MP4 file path: ${outputFile}. It should open automatically as soon as it is done being rendered - this could take a while depending on the complexity of the lesson.`,
            stderr: ''
        };
    } catch (error: any) {
        console.error('Error starting video generation:', error);
        
        return {
            outputPath: '',
            stdout: '',
            stderr: `Failed to start video generation: ${error.message}`,
            error
        };
    }
};
