import { VirtualIDE } from "@fullstackcraftllc/codevideo-virtual-ide";
import {
    IAction,
    ICourseSnapshot,
    IFileSource,
    diagnosticContains,
    normalizeDiagnosticsPath,
    parseDiagnosticLocation,
} from "@fullstackcraftllc/codevideo-types";
import { computeDiagnostics } from "../tools/diagnostics";

export interface DiagnosticHoverProblem {
    index: number;
    value: string;
    reason: string;
}

/** Project files as the editor shows them: saved contents, replaced by each open editor's text. */
const filesOnScreen = (ide: VirtualIDE): IFileSource[] => {
    const files = new Map(ide.getFullFilePathsAndContents().map((file) => [normalizeDiagnosticsPath(file.path), file.content]));
    for (const editor of ide.getEditorSnapshot().editors) files.set(normalizeDiagnosticsPath(editor.filename), editor.content);
    return [...files].map(([path, content]) => ({ path, content }));
};

/**
 * Checks every mouse-move-editor-diagnostic against the squiggles a render
 * would show at that point: the file must be the active editor, and the
 * location must be inside one of its diagnostics (or, without a column, on a
 * line where one starts). Replays the lesson in a VirtualIDE to get the text
 * on screen at each hover, unsaved edits included.
 */
export const checkDiagnosticHovers = (initialSnapshot: ICourseSnapshot, actions: IAction[]): DiagnosticHoverProblem[] => {
    if (!actions.some((action) => action.name === "mouse-move-editor-diagnostic")) return [];
    const ide = new VirtualIDE();
    ide.applyCourseSnapshot(structuredClone(initialSnapshot));
    const problems: DiagnosticHoverProblem[] = [];
    actions.forEach((action, index) => {
        if (action.name === "mouse-move-editor-diagnostic") {
            const location = parseDiagnosticLocation(action.value);
            const active = ide.getEditorSnapshot().editors.find((editor) => editor.isActive);
            if (!location) {
                problems.push({ index, value: action.value, reason: "the value isn't a 'path:line:column' location" });
            } else if (!active || normalizeDiagnosticsPath(active.filename) !== location.path) {
                problems.push({ index, value: action.value, reason: `${location.path} isn't the active editor here (active: ${active?.filename ?? "none"})` });
            } else {
                const diagnostics = computeDiagnostics(filesOnScreen(ide), [location.path]);
                const column = location.column;
                const hit = column === undefined
                    ? diagnostics.some((d) => d.line === location.line)
                    : diagnostics.some((d) => diagnosticContains(d, location.line, column));
                if (!hit) {
                    const there = diagnostics.map((d) => `${d.line}:${d.column}-${d.endLine}:${d.endColumn} "${d.message.split("\n")[0]}"`);
                    problems.push({
                        index,
                        value: action.value,
                        reason: there.length
                            ? `no squiggle at that spot; ${location.path} has ${there.join("; ")}`
                            : `${location.path} has no squiggles at this point in the lesson`,
                    });
                }
            }
        }
        ide.applyAction(action);
    });
    return problems;
};
