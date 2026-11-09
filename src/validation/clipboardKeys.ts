import { VirtualIDE } from "@fullstackcraftllc/codevideo-virtual-ide";
import { IAction, ICourseSnapshot } from "@fullstackcraftllc/codevideo-types";

export interface ClipboardKeyProblem {
    index: number;
    name: string;
    reason: string;
}

const CLIPBOARD_KEYS = new Set(["editor-command-c", "editor-command-x", "editor-command-v"]);

/**
 * Copy, cut and paste presses that would do nothing on screen: any of them
 * with no file open, and a paste while the clipboard is empty. Replays the
 * lesson in a VirtualIDE to know what's open and what the clipboard holds at
 * each press.
 */
export const checkClipboardKeys = (initialSnapshot: ICourseSnapshot, actions: IAction[]): ClipboardKeyProblem[] => {
    if (!actions.some((action) => CLIPBOARD_KEYS.has(action.name))) return [];
    const ide = new VirtualIDE();
    ide.applyCourseSnapshot(structuredClone(initialSnapshot));
    const problems: ClipboardKeyProblem[] = [];
    actions.forEach((action, index) => {
        if (CLIPBOARD_KEYS.has(action.name)) {
            if (ide.getEditorSnapshot().editors.length === 0) {
                problems.push({ index, name: action.name, reason: "no file is open here, so nothing happens; open the file first" });
            } else if (action.name === "editor-command-v" && ide.getClipboardSnapshot().text === "") {
                problems.push({ index, name: action.name, reason: "the clipboard is empty here, so nothing is pasted; copy or cut first (editor-command-c, editor-command-x), or use clipboard-set-text for text copied off screen" });
            }
        }
        ide.applyAction(action);
    });
    return problems;
};

/** "action 5 (editor-command-v): the clipboard is empty here, ..." for each one. */
export const describeClipboardKeyProblems = (problems: ClipboardKeyProblem[]): string =>
    problems.map((problem) => `action ${problem.index} (${problem.name}): ${problem.reason}`).join("; ");
