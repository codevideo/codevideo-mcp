import os from "os";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { IAction } from "@fullstackcraftllc/codevideo-types";
import { generateHtmlStringFromActions } from '@fullstackcraftllc/codevideo-exporters';
import { getCurrentActionsOrThrow } from "./get_current_actions";

// calls the HTML generator from the codevideo-exporters package
export const makeHTMLWebPage = async (actions?: Array<IAction>): Promise<string> => {
    // Use provided actions or retrieve from storage
    const actionsToUse = actions || getCurrentActionsOrThrow();
    
    // Generate the HTML content
    const htmlContent = await generateHtmlStringFromActions(actionsToUse);
    
    // Create output file on desktop with timestamp
    const homeDir = os.homedir();
    const desktopDir = path.join(homeDir, 'Desktop');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(desktopDir, `codevideo-${timestamp}.html`);
    
    // Write HTML to file
    fs.writeFileSync(outputFile, htmlContent, 'utf8');
    
    // Open the HTML file in the default browser
    const openChild = spawn('open', [outputFile], {
        detached: true,
        stdio: 'ignore'
    });
    openChild.unref();
    
    // Return the HTML content
    return htmlContent;
}