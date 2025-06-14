import os from "os";
import path from "path";
import { spawn } from "child_process";
import { ILesson } from "@fullstackcraftllc/codevideo-types";
import { getCurrentLessonOrThrow } from "./get_current_lesson";

export interface VideoResult {
    outputPath: string;
    stdout: string;
    stderr: string;
    error?: any;
}

export const makeVideoFromLesson = async (lesson?: ILesson): Promise<VideoResult> => {

    // attempt to read CLI path from env varaible PATH_TO_CODEVIDEO_CLI - if PATH_TO_CODEVIDEO_CLI is not set return error message
    // const cliExePath = process.env.PATH_TO_CODEVIDEO_CLI;
    // hardcoded now for demo
    const cliExePath = "/Users/chris/enterprise/codevideo/codevideo-cli/codevideo";

    // TODO: reactivate getBinaryPath from the go binaries that are downloaded from releases github and packaged here
    // we will likely have signing issues on macOS, so we will need to sign the binary ourselves
    // const cliExePath = getBinaryPath();

    // if (!cliExePath) {
    //     return {
    //         outputPath: '',
    //         stdout: '',
    //         stderr: '',
    //         error: new Error('PATH_TO_CODEVIDEO_CLI environment variable is not set. Please set it to the path of the codevideo-cli executable.')
    //     };
    // }
    // // if it is set, check if it exists
    // if (!path.isAbsolute(cliExePath)) {
    //     return {
    //         outputPath: '',
    //         stdout: '',
    //         stderr: '',
    //         error: new Error('PATH_TO_CODEVIDEO_CLI environment variable is not an absolute path. Please set it to the absolute path of the codevideo-cli executable.')
    //     };
    // }

    // // check if the path exists
    // if (!fs.existsSync(cliExePath)) {
    //     return {
    //         outputPath: '',
    //         stdout: '',
    //         stderr: '',
    //         error: new Error(`PATH_TO_CODEVIDEO_CLI environment variable is set to a path that does not exist: ${cliExePath}. Please set it to the path of the codevideo-cli executable.`)
    //     };
    // }

    // // check if the path is a file
    // if (!fs.statSync(cliExePath).isFile()) {
    //     return {
    //         outputPath: '',
    //         stdout: '',
    //         stderr: '',
    //         error: new Error(`PATH_TO_CODEVIDEO_CLI environment variable is set to a path that is not a file: ${cliExePath}. Please set it to the path of the codevideo-cli executable.`)
    //     };
    // }

    // // check if the path is executable
    // try {
    //     fs.accessSync(cliExePath, fs.constants.F_OK | fs.constants.X_OK);
    // } catch (error) {
    //     return {
    //         outputPath: '',
    //         stdout: '',
    //         stderr: '',     
    //         error: new Error(`PATH_TO_CODEVIDEO_CLI environment variable is set to a path that is not executable: ${cliExePath}. Please set it to the path of the codevideo-cli executable.`)
    //     };
    // }

    // derive the directory path from the executable path
    const cliDirPath = path.dirname(cliExePath);

    try {
        // Use provided lesson or retrieve from storage
        const lessonToUse = lesson || getCurrentLessonOrThrow();
        // Create JSON string directly
        const lessonJson = JSON.stringify(lessonToUse);

        // Create output file on desktop with timestamp
        const homeDir = os.homedir();
        const desktopDir = path.join(homeDir, 'Desktop');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFile = path.join(desktopDir, `codevideo-${timestamp}.mp4`);
        
        // Fire-and-forget: Start the video generation process in the background
        const child = spawn(
            cliExePath,
            ['run', '.', '-p', lessonJson, '-o', outputFile, '--open'],
            {
                cwd: cliDirPath,
                detached: true,
                stdio: 'ignore' // Detach stdio streams from parent
            }
        );
        
        // Unreference the child process, allowing the parent to exit independently
        child.unref();
        
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
