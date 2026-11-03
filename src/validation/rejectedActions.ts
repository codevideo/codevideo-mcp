import { AllActionDescriptions, IAction } from "@fullstackcraftllc/codevideo-types";

/**
 * Actions lessons can't use, each with how to do the same thing instead. The
 * file-explorer ones change files with nothing on screen causing it, so in the
 * video things just appear; editor-highlight-code and the composites aren't
 * implemented yet, so the IDE and the renderer skip them and nothing happens.
 */
const REJECTED_ACTIONS = new Map<string, string>([
    ["file-explorer-create-file", "make the file with the mouse (right-click, New File) or touch in the terminal"],
    ["file-explorer-create-folder", "make the folder with the mouse (right-click, New Folder) or mkdir in the terminal"],
    ["file-explorer-set-file-contents", "type the contents with editor-type"],
    ["editor-highlight-code", "not supported yet; to point at code, bring its file forward with mouse-move-editor-tab and talk about it"],
    ["composite-create-file-with-mouse", "not supported yet; make the file with the mouse steps (right-click, New File)"],
    ["composite-create-file-with-terminal", "not supported yet; type touch <path> with terminal-type, then terminal-enter"],
    ["composite-create-folder-with-mouse", "not supported yet; make the folder with the mouse steps (right-click, New Folder)"],
    ["composite-create-folder-with-terminal", "not supported yet; type mkdir <path> with terminal-type, then terminal-enter"],
    ["composite-close-all-editors-with-mouse", "not supported yet; close editors one at a time with mouse-move-editor-tab-close and mouse-left-click"],
    ["composite-close-all-editors-with-keyboard", "not supported yet; close editors one at a time with mouse-move-editor-tab-close and mouse-left-click"],
]);

export interface RejectedAction {
    index: number;
    name: string;
}

/** The actions in a lesson that lessons can't use, with their positions. */
export const rejectedActionsIn = (actions: IAction[]): RejectedAction[] =>
    actions.flatMap((action, index) => (REJECTED_ACTIONS.has(action.name) ? [{ index, name: action.name }] : []));

/** "action 3 is file-explorer-create-file: make the file with ..." for each one. */
export const describeRejected = (rejected: RejectedAction[]): string =>
    rejected.map((action) => `action ${action.index} is ${action.name}: ${REJECTED_ACTIONS.get(action.name)}`).join("; ");

/** What an action's value should be, from codevideo-types, for error messages. */
export const valueHint = (name: string): string | undefined =>
    AllActionDescriptions.find((action) => action.name === name)?.valueDescription;
