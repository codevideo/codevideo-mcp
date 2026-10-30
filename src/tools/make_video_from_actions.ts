import os from "os";
import fs from "fs";
import path from "path";
import { IAction } from "@fullstackcraftllc/codevideo-types";
import { getCurrentActionsOrThrow } from "./get_current_actions";
import { getCodeVideoCliRuntime } from "../utils/getBinaryPath";
import { spawnDetached } from "../utils/spawnDetached";

export interface VideoResult {
    outputPath: string;
    stdout: string;
    stderr: string;
    error?: any;
}

export const makeVideoFromActions = async (actions?: IAction[]): Promise<VideoResult> => {
    try {
        const runtime = getCodeVideoCliRuntime();
        // Use provided actions or retrieve from storage
        const actionsToUse = actions || getCurrentActionsOrThrow();
        // Create JSON string directly
        const actionsJson = JSON.stringify(actionsToUse);
        
        // Create output file on desktop with timestamp
        const homeDir = os.homedir();
        const desktopDir = process.env.CODEVIDEO_OUTPUT_DIR || path.join(homeDir, 'Desktop');
        fs.mkdirSync(desktopDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFile = path.join(desktopDir, `codevideo-${timestamp}.mp4`);
        
        // Fire-and-forget: Start the video generation process in the background
        await spawnDetached(
            runtime.binaryPath,
            ['-p', actionsJson, '-o', outputFile, '--open'],
            {
                cwd: process.cwd(),
                env: runtime.env,
            }
        );
        
        // Return immediately with status message
        return {
            outputPath: outputFile,
            stdout: `Video generation job with ${actionsToUse.length} actions has started in the background via the codevideo-cli command. MP4 file path: ${outputFile}. It should open automatically as soon as it is done being rendered - this could take a while depending on how many actions there are.`,
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
