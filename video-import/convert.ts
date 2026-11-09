// Turns rebuilt file states (track.ts) and the lesson's caption cues into a
// CodeVideo lesson: verbatim narration as author-speak-before actions, and the
// code changes between them as editor actions.
//
// Every action is applied to a VirtualIDE as it is generated, so the caret
// moves come from the IDE's real caret and each step is checked against the
// file contents read from the video.
//
// usage: npx tsx video-import/convert.ts <lessonDir> <repoDirAtLessonStart> <config.json>
import fs from "node:fs";
import path from "node:path";
import { VirtualIDE } from "@fullstackcraftllc/codevideo-virtual-ide";
import { buildFileStructureFromRootFolder } from "@fullstackcraftllc/codevideo-adapters";
import type { IAction, ICourseSnapshot, IFileStructure, ILesson } from "@fullstackcraftllc/codevideo-types";
import type { Cue } from "./vtt";
import type { StatePoint } from "./track";
import { computeDiagnostics } from "../src/tools/diagnostics";

export interface ConvertConfig {
    id: string;
    name: string;
    description: string;
    openEditors: string[];      // editors open when the lesson starts, e.g. "src/App.tsx"
    activeEditor: string;
    expandedFolders: string[];  // folders shown open in the explorer
    extraFolders: string[];     // shown in the explorer but not in the repo (e.g. node_modules)
    blankFiles: string[];       // kept in the tree with empty content (too big or binary)
    extraFiles: string[];       // files the adapter skips but the explorer shows (e.g. .gitignore)
    editorCarets?: Record<string, { row: number; col: number }>; // 1-based, as in the status bar
    showDiagnostics?: boolean;  // squiggles on after the opening narration, as VS Code shows them
}

// ---------- initial snapshot ----------

const setNode = (structure: IFileStructure, filePath: string, node: IFileStructure[string]) => {
    const parts = filePath.split("/");
    let level = structure;
    for (const part of parts.slice(0, -1)) {
        const dir = level[part];
        if (!dir || dir.type !== "directory") throw new Error(`no folder ${part} for ${filePath}`);
        dir.children = dir.children ?? {};
        level = dir.children;
    }
    level[parts[parts.length - 1]] = node;
};

const getNode = (structure: IFileStructure, filePath: string) => {
    let level: IFileStructure | undefined = structure;
    let node: IFileStructure[string] | undefined;
    for (const part of filePath.split("/")) {
        node = level?.[part];
        level = node?.type === "directory" ? node.children : undefined;
    }
    return node;
};

const folderPaths = (structure: IFileStructure, prefix = ""): string[] =>
    Object.entries(structure).flatMap(([name, node]) =>
        node.type === "directory" ? [prefix + name, ...folderPaths(node.children ?? {}, `${prefix}${name}/`)] : []);

export const buildInitialSnapshot = async (repoDir: string, config: ConvertConfig): Promise<ICourseSnapshot> => {
    const { fileStructure } = await buildFileStructureFromRootFolder(repoDir);
    for (const file of config.extraFiles) {
        setNode(fileStructure, file, { type: "file", content: fs.readFileSync(path.join(repoDir, file), "utf8"), language: "", caretPosition: { row: 1, col: 1 } });
    }
    for (const folder of config.extraFolders) {
        setNode(fileStructure, folder, { type: "directory", content: "", children: {}, collapsed: true });
    }
    for (const folder of folderPaths(fileStructure)) {
        const node = getNode(fileStructure, folder);
        if (node?.type === "directory") node.collapsed = !config.expandedFolders.includes(folder);
    }
    for (const file of config.blankFiles) {
        const node = getNode(fileStructure, file);
        if (node?.type === "file") node.content = "";
    }
    const base = new VirtualIDE().getCourseSnapshot();
    return {
        ...base,
        fileExplorerSnapshot: { ...base.fileExplorerSnapshot, fileStructure },
        editorSnapshot: {
            ...base.editorSnapshot,
            editors: config.openEditors.map(filename => ({
                isActive: filename === config.activeEditor,
                filename,
                content: fs.readFileSync(path.join(repoDir, filename), "utf8"),
                caretPosition: config.editorCarets?.[filename] ?? { row: 1, col: 1 },
                highlightCoordinates: null,
                isSaved: true,
            })),
        },
    };
};

// ---------- line diff ----------

interface Hunk { a1: number; a2: number; b1: number; b2: number; }

// Longest-matching-block diff (same idea as Python's difflib): keeps inserted
// blocks contiguous, which reads like someone typing them.
export const diffHunks = (a: string[], b: string[]): Hunk[] => {
    const blocks: Array<{ i: number; j: number; size: number }> = [];
    const match = (alo: number, ahi: number, blo: number, bhi: number) => {
        let best = { i: alo, j: blo, size: 0 };
        let j2len = new Map<number, number>();
        for (let i = alo; i < ahi; i++) {
            const next = new Map<number, number>();
            for (let j = blo; j < bhi; j++) {
                if (a[i] !== b[j]) continue;
                const k = (j2len.get(j - 1) ?? 0) + 1;
                next.set(j, k);
                if (k > best.size) best = { i: i - k + 1, j: j - k + 1, size: k };
            }
            j2len = next;
        }
        if (!best.size) return;
        match(alo, best.i, blo, best.j);
        blocks.push(best);
        match(best.i + best.size, ahi, best.j + best.size, bhi);
    };
    match(0, a.length, 0, b.length);
    blocks.push({ i: a.length, j: b.length, size: 0 });
    const hunks: Hunk[] = [];
    let ai = 0, bj = 0;
    for (const block of blocks) {
        if (ai < block.i || bj < block.j) hunks.push({ a1: ai, a2: block.i, b1: bj, b2: block.j });
        ai = block.i + block.size;
        bj = block.j + block.size;
    }
    return hunks;
};

// ---------- emitting actions against a live VirtualIDE ----------

class Emitter {
    readonly actions: IAction[] = [];
    private readonly folders: Set<string>;

    constructor(readonly ide: VirtualIDE, snapshot: ICourseSnapshot) {
        this.folders = new Set(folderPaths(snapshot.fileExplorerSnapshot.fileStructure));
    }

    emit(name: string, value: string | number) {
        const action = { name, value: String(value) } as IAction;
        this.ide.applyAction(action);
        this.actions.push(action);
    }

    private editors() { return this.ide.getEditorSnapshot().editors; }
    private active() { return this.editors().find(e => e.isActive); }
    lines(): string[] { return (this.active()?.content ?? "").split("\n"); }
    caret() {
        const c = this.active()!.caretPosition;
        return { row: c.row - 1, col: c.col - 1 };
    }
    activeFile(): string | null { return this.active()?.filename ?? null; }

    /** Project files as on screen: saved contents, replaced by open editors' text. */
    filesOnScreen(): Array<{ path: string; content: string }> {
        const files = new Map(this.ide.getFullFilePathsAndContents().map(f => [f.path.replace(/^\//, ""), f.content]));
        for (const editor of this.editors()) files.set(editor.filename.replace(/^\//, ""), editor.content);
        return [...files].map(([path, content]) => ({ path, content }));
    }
    private files() { return new Set(this.ide.getFullFilePathsAndContents().map(f => f.path.replace(/^\//, ""))); }

    private createFolder(folder: string) {
        const parent = folder.split("/").slice(0, -1).join("/");
        const name = folder.split("/").slice(-1)[0];
        if (parent) this.emit("mouse-move-file-explorer-folder", parent); else this.emit("mouse-move-file-explorer", 1);
        this.emit("mouse-right-click", 1);
        this.emit(parent ? "mouse-move-file-explorer-folder-context-menu-new-folder" : "mouse-move-file-explorer-context-menu-new-folder", 1);
        this.emit("mouse-left-click", 1);
        this.emit("file-explorer-type-new-folder-input", name);
        this.emit("file-explorer-enter-new-folder-input", 1);
        this.folders.add(folder);
    }

    private createFile(file: string) {
        const parent = file.split("/").slice(0, -1).join("/");
        const name = file.split("/").slice(-1)[0];
        if (parent) this.emit("mouse-move-file-explorer-folder", parent); else this.emit("mouse-move-file-explorer", 1);
        this.emit("mouse-right-click", 1);
        this.emit(parent ? "mouse-move-file-explorer-folder-context-menu-new-file" : "mouse-move-file-explorer-context-menu-new-file", 1);
        this.emit("mouse-left-click", 1);
        this.emit("file-explorer-type-new-file-input", name);
        this.emit("file-explorer-enter-new-file-input", 1);
    }

    // Brings a file forward the way it happens on screen: create it, click its tab, or open it.
    focus(file: string) {
        if (!this.files().has(file)) {
            const parts = file.split("/");
            for (let i = 1; i < parts.length; i++) {
                const folder = parts.slice(0, i).join("/");
                if (!this.folders.has(folder)) this.createFolder(folder);
            }
            this.createFile(file);
        } else if (this.activeFile() !== file) {
            if (this.editors().some(e => e.filename === file)) {
                this.emit("mouse-move-editor-tab", file);
                this.emit("mouse-left-click", 1);
            } else {
                this.emit("mouse-move-file-explorer-file", file);
                this.emit("file-explorer-open-file", file);
            }
        }
        if (this.activeFile() !== file) throw new Error(`could not bring ${file} forward (active: ${this.activeFile()})`);
    }

    private navigate(row: number, col: number) {
        let c = this.caret();
        if (row < c.row) this.emit("editor-arrow-up", c.row - row);
        if (row > c.row) this.emit("editor-arrow-down", row - c.row);
        c = this.caret();
        if (c.col !== col) {
            const length = this.lines()[row].length;
            if (col === length) this.emit("editor-command-right", 1);
            else if (col === 0) this.emit("editor-command-left", 1);
            else if (col > c.col) this.emit("editor-arrow-right", col - c.col);
            else if (c.col - col <= col + 1) this.emit("editor-arrow-left", c.col - col);
            else { this.emit("editor-command-left", 1); this.emit("editor-arrow-right", col); }
        }
        c = this.caret();
        if (c.row !== row || c.col !== col) throw new Error(`caret at ${c.row}:${c.col}, wanted ${row}:${col}`);
    }

    // Edits the active file into `target`, one diff hunk at a time, top to bottom.
    editTo(target: string[]) {
        for (const hunk of diffHunks(this.lines(), target)) {
            const current = this.lines();
            const start = hunk.b1; // lines above the hunk already match the target
            const oldCount = hunk.a2 - hunk.a1;
            const ctxStart = Math.max(start - 1, 0);
            const ctxEnd = Math.min(start + oldCount + 1, current.length);
            const oldText = current.slice(ctxStart, ctxEnd).join("\n");
            const newText = target.slice(hunk.b1 - (start - ctxStart), hunk.b2 + (ctxEnd - (start + oldCount))).join("\n");
            let p = 0;
            while (p < oldText.length && p < newText.length && oldText[p] === newText[p]) p++;
            let q = 0;
            while (q < oldText.length - p && q < newText.length - p && oldText[oldText.length - 1 - q] === newText[newText.length - 1 - q]) q++;
            const deleteCount = oldText.length - p - q;
            const insert = newText.slice(p, newText.length - q);
            const at = (offset: number) => {
                const before = oldText.slice(0, offset).split("\n");
                return { row: ctxStart + before.length - 1, col: before[before.length - 1].length };
            };
            if (deleteCount > 0) {
                const end = at(p + deleteCount);
                this.navigate(end.row, end.col);
                if (deleteCount <= 12) this.emit("editor-backspace", deleteCount);
                else { this.emit("editor-shift+arrow-left", deleteCount); this.emit("editor-backspace", 1); }
            } else {
                const pos = at(p);
                this.navigate(pos.row, pos.col);
            }
            if (insert) this.emit("editor-type", insert);
        }
        const result = this.lines();
        if (result.join("\n") !== target.join("\n")) {
            throw new Error(`edit mismatch\n--- got\n${result.join("\n")}\n--- wanted\n${target.join("\n")}`);
        }
    }
}

// ---------- narration grouping ----------

const endsSentence = (text: string) => /([.?!]["')\]]*|:\()$/.test(text.trim());
const sentenceCount = (text: string) => (text.match(/[.?!](\s|$)/g) ?? []).length;
const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;
// Captions often split one spoken sentence into tiny cues ("Is." "a[key]."); speaking
// each as its own clip sounds choppy, so a clip carries at least this many words.
const MIN_WORDS_PER_CLIP = 4;

const sameState = (a: StatePoint, b: StatePoint) =>
    a.activeFile === b.activeFile && JSON.stringify(a.files) === JSON.stringify(b.files);

// Strips characters an IDE closes for you, so half-typed lines read as prefixes.
const stripAutoClosed = (line: string) => line.replace(/[)\]}"'>`]+\s*$/, "");
const isSubsequence = (needle: string, hay: string) => {
    let i = 0;
    for (const ch of hay) if (ch === needle[i]) i++;
    return i === needle.length;
};

// A state is worth showing on its own if it holds a line that never makes it into
// the group's last state in any form: a demo edit that is undone, not half-typing.
const hasTransientLine = (state: StatePoint, last: StatePoint) => {
    const finalLines = Object.values(last.files).flat();
    return Object.values(state.files).flat().some(line => {
        const core = stripAutoClosed(line).trim();
        return core.length > 0 && !finalLines.some(f => isSubsequence(core, f.trim()));
    });
};

export interface ConvertReportGroup { from: number; to: number; speech: string; states: number[]; actionCount: number; hovers: string[]; }

// "! hover 2345 "cat"" in observations: the original video hovered the TS2345 squiggle on "cat".
const parseHover = (note: string): { code: number; text: string } | null => {
    const match = /^hover (\d+) (.+)$/.exec(note.trim());
    return match ? { code: Number(match[1]), text: match[2].trim() } : null;
};

/** The hover location of the diagnostic with `code` whose squiggled text contains `text`, in the active editor. */
const hoverLocation = (emitter: Emitter, code: number, text: string): string => {
    const file = emitter.activeFile();
    if (!file) throw new Error(`hover on ${code} ${text}: no active editor`);
    const lines = emitter.lines();
    const covered = (d: { line: number; column: number; endLine: number; endColumn: number }) =>
        lines.slice(d.line - 1, d.endLine).join("\n").slice(d.column - 1, d.column - 1 + (d.endLine === d.line ? d.endColumn - d.column : Infinity));
    const diagnostics = computeDiagnostics(emitter.filesOnScreen(), [file]);
    const match = diagnostics.find(d => d.code === code && covered(d).includes(text.replace(/^"(.*)"$/, "$1")) );
    if (!match) throw new Error(`hover on ${code} ${text}: no such squiggle in ${file}; found ${diagnostics.map(d => `${d.line}:${d.column} ts(${d.code})`).join(", ") || "none"}`);
    return `${file}:${match.line}:${match.column}`;
};

export const convert = async (lessonDir: string, repoDir: string, config: ConvertConfig) => {
    const cues: Cue[] = JSON.parse(fs.readFileSync(path.join(lessonDir, "cues.json"), "utf8"));
    // VS Code auto-indents empty lines and trims that whitespace again when the caret
    // leaves; typing it out would only add stray edits, so blank lines count as empty.
    const points: StatePoint[] = (JSON.parse(fs.readFileSync(path.join(lessonDir, "states.json"), "utf8")) as StatePoint[])
        .map(point => ({ ...point, files: Object.fromEntries(Object.entries(point.files).map(([file, lines]) => [file, lines.map(line => line.trim() ? line : "")])) }));
    const snapshot = await buildInitialSnapshot(repoDir, config);
    const ide = new VirtualIDE();
    // the IDE keeps and mutates what it is given, so it gets its own copy
    ide.applyCourseSnapshot(structuredClone(snapshot));
    const emitter = new Emitter(ide, snapshot);
    const report: ConvertReportGroup[] = [];

    let speech: string[] = [];
    let pending: StatePoint[] = [];
    let groupStart = points[1]?.t ?? 0;
    let lastEmitted = points[0];

    const applyState = (state: StatePoint) => {
        for (const [file, lines] of Object.entries(state.files)) {
            const existing = ide.getFullFilePathsAndContents().find(f => f.path.replace(/^\//, "") === file);
            const unchanged = existing && existing.content === lines.join("\n");
            if (unchanged && state.activeFile !== file) continue;
            if (!existing || !unchanged) {
                emitter.focus(file);
                emitter.editTo(lines);
            }
        }
        if (state.activeFile && state.files[state.activeFile] && emitter.activeFile() !== state.activeFile) {
            emitter.focus(state.activeFile);
        }
    };

    let diagnosticsShown = false;
    const flush = (t: number) => {
        const before = emitter.actions.length;
        const last = pending[pending.length - 1];
        const shown = pending.filter((state, i) => i === pending.length - 1 || hasTransientLine(state, last));
        const hovers = pending.flatMap(state => state.notes).map(parseHover).filter((h): h is { code: number; text: string } => h !== null);
        const hoverValues: string[] = [];
        if (hovers.length) {
            // The narration reads the error out, so it plays while the hover is up.
            for (const state of shown) applyState(state);
            for (const hover of hovers) {
                const value = hoverLocation(emitter, hover.code, hover.text);
                emitter.emit("mouse-move-editor-diagnostic", value);
                hoverValues.push(value);
            }
            if (speech.length) emitter.emit("author-speak-before", speech.join(" "));
            // then move away, as the author did, so the hover doesn't cover the code from here on
            emitter.emit("mouse-move-editor", 1);
        } else {
            if (speech.length) emitter.emit("author-speak-before", speech.join(" "));
            if (config.showDiagnostics && !diagnosticsShown) { emitter.emit("editor-show-diagnostics", 1); diagnosticsShown = true; }
            for (const state of shown) applyState(state);
        }
        report.push({ from: groupStart, to: t, speech: speech.join(" "), states: shown.map(s => s.index), actionCount: emitter.actions.length - before, hovers: hoverValues });
        if (last) lastEmitted = last;
        speech = [];
        pending = [];
        groupStart = t;
    };

    for (let k = 1; k < points.length; k++) {
        const point = points[k];
        const cue = cues[point.afterCue];
        speech.push(cue.text);
        const previous = pending[pending.length - 1] ?? lastEmitted;
        if (!sameState(previous, point) || point.notes.some(note => parseHover(note))) pending.push(point);
        const isLast = k === points.length - 1;
        const words = wordCount(speech.join(" "));
        if (isLast || (endsSentence(cue.text) && words >= MIN_WORDS_PER_CLIP)) {
            if (pending.length || isLast || sentenceCount(speech.join(" ")) >= 3) flush(point.t);
        }
    }

    const lesson: ILesson = {
        id: config.id,
        name: config.name,
        description: config.description,
        initialSnapshot: snapshot,
        actions: emitter.actions,
    };
    return { lesson, report, finalFiles: lastEmitted.files };
};

// Replays the lesson from scratch and returns the files as they look on screen:
// an open editor's text (saved or not), otherwise the file's saved content.
export const replay = (lesson: ILesson) => {
    const ide = new VirtualIDE();
    ide.applyCourseSnapshot(structuredClone(lesson.initialSnapshot!));
    ide.applyActions(lesson.actions);
    const files: Record<string, string> = Object.fromEntries(ide.getFullFilePathsAndContents().map(f => [f.path.replace(/^\//, ""), f.content]));
    for (const editor of ide.getEditorSnapshot().editors) files[editor.filename] = editor.content;
    return files;
};

const main = async () => {
    const [lessonDir, repoDir, configPath] = process.argv.slice(2);
    if (!lessonDir || !repoDir || !configPath) throw new Error("usage: convert.ts <lessonDir> <repoDir> <config.json>");
    const config: ConvertConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const { lesson, report, finalFiles } = await convert(lessonDir, repoDir, config);

    const replayed = replay(lesson);
    for (const [file, lines] of Object.entries(finalFiles)) {
        if (replayed[file] !== lines.join("\n")) throw new Error(`replay of ${file} does not match the video's last state`);
    }

    fs.writeFileSync(path.join(lessonDir, "lesson.json"), JSON.stringify(lesson, null, 2));
    fs.writeFileSync(path.join(lessonDir, "convert-report.json"), JSON.stringify(report, null, 2));
    const counts = new Map<string, number>();
    for (const action of lesson.actions) counts.set(action.name, (counts.get(action.name) ?? 0) + 1);
    console.log(`${lesson.actions.length} actions in ${report.length} narration groups; replay matches the video's final files`);
    console.log([...counts].sort((a, b) => b[1] - a[1]).map(([name, n]) => `${name} ${n}`).join(", "));
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
    main().catch(error => { console.error(error); process.exit(1); });
}
