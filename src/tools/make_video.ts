import fs from "fs";
import { exec } from "child_process";
import { IAction } from "@fullstackcraftllc/codevideo-types";

// uses the CodeVideo CLI tool to build a video from a series of actions
// for now, uses the local codevideo CLI tool
export const makeVideo = (actions: Array<IAction>): string => {
    // create a temporary directory
    const tempDir = `./temp-${Date.now()}`;
    fs.mkdirSync(tempDir, { recursive: true });

    // create a temporary file to store the actions
    const actionsFile = `${tempDir}/actions.json`;
    fs.writeFileSync(actionsFile, JSON.stringify(actions, null, 2));

    // run the codevideo CLI tool to build the video
    const outputFile = `./output-${Date.now()}.mp4`;
    issueTerminalCommand(`./Users/chris/enterprise/codevideo/codevideo-cli/codevideo -p $(cat ${actionsFile})`);

    // return the output file path
    return outputFile;
}

// helper function to issue terminal commands in sync fashion
const issueTerminalCommand = (command: string): void => {
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing command: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`stderr: ${stderr}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
    });
}