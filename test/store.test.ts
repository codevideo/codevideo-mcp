import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { after } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { IAction } from "@fullstackcraftllc/codevideo-types";
import { homeEnv, tempHome } from "./helpers";

// The store opens ~/.codevideo/codevideo.db on each call, so point home at a
// scratch folder before using it.
const home = tempHome();
Object.assign(process.env, homeEnv(home));
after(() => fs.rmSync(home, { recursive: true, force: true }));

const {
    addLesson,
    createCourse,
    editLessonActions,
    fileEntriesFromSnapshot,
    getLesson,
    getLessonActions,
    getLessonFile,
    setLessonActions,
    snapshotFromActions,
} = await import("../src/store/courseStore");
const { emptyCourseSnapshot } = await import("../src/utils/emptyCourseSnapshot");
const { validateCourse } = await import("../src/tools/courseTools");

const writeFile = (file: string, text: string): IAction[] => [
    { name: "file-explorer-create-file", value: file },
    { name: "file-explorer-open-file", value: file },
    { name: "editor-type", value: text },
    { name: "editor-save", value: "1" },
] as IAction[];

const fileText = (snapshot: Parameters<typeof fileEntriesFromSnapshot>[0], file: string): string | undefined =>
    fileEntriesFromSnapshot(snapshot).find((entry) => entry.path.endsWith(file))?.content;

test("a failed replay leaves the lesson's actions and snapshots as they were", () => {
    const courseId = createCourse({ name: "Rollback" });
    const first = addLesson(courseId, { name: "First", continuesFromPrevious: false });
    const second = addLesson(courseId, { name: "Second", continuesFromPrevious: false });
    const original = writeFile("a.ts", "let x = 1;");
    setLessonActions(courseId, first, original);
    const before = getLesson(courseId, first);

    // A broken snapshot on the second lesson makes replaying the course throw.
    const db = new DatabaseSync(path.join(home, ".codevideo", "codevideo.db"));
    db.prepare(`UPDATE lessons SET initial_snapshot = '{}' WHERE id = ?`).run(second);
    db.close();

    assert.throws(() => setLessonActions(courseId, first, writeFile("b.ts", "let y = 2;")));
    const after = getLesson(courseId, first);
    assert.deepEqual(after.actions, original);
    assert.deepEqual(after.finalSnapshot, before.finalSnapshot);
});

test("editing a lesson recomputes the lessons that continue from it", () => {
    const courseId = createCourse({ name: "Continuity" });
    const first = addLesson(courseId, { name: "First" });
    const second = addLesson(courseId, { name: "Second" });
    setLessonActions(courseId, first, writeFile("a.ts", "let x = 1;"));
    assert.equal(fileText(getLesson(courseId, second).initialSnapshot, "a.ts"), "let x = 1;");

    editLessonActions(courseId, first, [{ start: 2, deleteCount: 1, insert: [{ name: "editor-type", value: "let x = 2;" } as IAction] }]);
    assert.equal(fileText(getLesson(courseId, second).initialSnapshot, "a.ts"), "let x = 2;");
});

test("edits apply in order like splice, all or nothing", () => {
    const courseId = createCourse({ name: "Edits" });
    const lessonId = addLesson(courseId, { name: "Only" });
    const speak = (value: string) => ({ name: "author-speak-before", value }) as IAction;
    setLessonActions(courseId, lessonId, [speak("a"), speak("b"), speak("c")]);

    editLessonActions(courseId, lessonId, [
        { start: 1, deleteCount: 1, insert: [speak("B"), speak("B2")] }, // a B B2 c
        { start: 4, deleteCount: 0, insert: [speak("d")] }, // a B B2 c d
    ]);
    assert.deepEqual(getLesson(courseId, lessonId).actions.map((a) => a.value), ["a", "B", "B2", "c", "d"]);

    assert.throws(
        () => editLessonActions(courseId, lessonId, [
            { start: 0, deleteCount: 1, insert: [] },
            { start: 9, deleteCount: 0, insert: [speak("x")] },
        ]),
        /start 9 is outside/
    );
    assert.deepEqual(getLesson(courseId, lessonId).actions.map((a) => a.value), ["a", "B", "B2", "c", "d"]);
});

test("lesson actions can be read a slice at a time, with indices", () => {
    const courseId = createCourse({ name: "Slices" });
    const lessonId = addLesson(courseId, { name: "Only" });
    setLessonActions(courseId, lessonId, Array.from({ length: 7 }, (_, i) => ({ name: "author-speak-before", value: `s${i}` }) as IAction));
    const slice = getLessonActions(courseId, lessonId, 5, 10);
    assert.equal(slice.total, 7);
    assert.deepEqual(slice.actions.map((a) => [a.index, a.value]), [[5, "s5"], [6, "s6"]]);
});

// The four selection actions added in codevideo-types 2.4.0, through the real
// VirtualIDE replay (virtual-editor 1.8.0).
test("selection actions replay through the VirtualIDE", () => {
    const cases: [IAction[], string][] = [
        [[{ name: "editor-shift+home", value: "1" }, { name: "editor-type", value: "const y = 2;" }] as IAction[], "const y = 2;"],
        [[{ name: "editor-arrow-left", value: "3" }, { name: "editor-shift+end", value: "1" }, { name: "editor-backspace", value: "1" }] as IAction[], "let x ="],
        [[{ name: "editor-command+shift+arrow-left", value: "1" }, { name: "editor-type", value: "Z" }] as IAction[], "Z"],
        [[{ name: "editor-command-left", value: "1" }, { name: "editor-command+shift+arrow-right", value: "1" }, { name: "editor-type", value: "Z" }] as IAction[], "Z"],
    ];
    for (const [selection, expected] of cases) {
        const actions = [...writeFile("a.ts", "let x = 1;").slice(0, 3), ...selection, { name: "editor-save", value: "1" } as IAction];
        assert.equal(fileText(snapshotFromActions(emptyCourseSnapshot(), actions), "a.ts"), expected, selection.map((a) => a.name).join(", "));
    }
});

const opening = { name: "author-speak-before", value: "Let's write a helper." } as IAction;

// The two ways a lesson shows a file being made.
const viaMouse = (file: string, text: string): IAction[] => [
    { name: "mouse-move-file-explorer", value: "1" },
    { name: "mouse-right-click", value: "1" },
    { name: "mouse-move-file-explorer-context-menu-new-file", value: "1" },
    { name: "mouse-left-click", value: "1" },
    { name: "file-explorer-type-new-file-input", value: file },
    { name: "file-explorer-enter-new-file-input", value: "1" },
    { name: "editor-type", value: text },
    { name: "editor-save", value: "1" },
] as IAction[];
const viaTouch = (file: string, text: string): IAction[] => [
    { name: "terminal-open", value: "1" },
    { name: "terminal-type", value: `touch ${file}` },
    { name: "terminal-enter", value: "1" },
    { name: "mouse-move-file-explorer-file", value: file },
    { name: "file-explorer-open-file", value: file },
    { name: "editor-type", value: text },
    { name: "editor-save", value: "1" },
] as IAction[];

test("validation rejects files that appear with nothing on screen making them", async () => {
    const code = "export const add = (a: number, b: number): number => a + b;\n";
    const courseId = createCourse({ name: "On screen" });
    const lessonId = addLesson(courseId, { name: "Helper" });

    setLessonActions(courseId, lessonId, writeFile("math.ts", code));
    const rejected = await validateCourse(courseId);
    assert.equal(rejected.done, false);
    assert.ok(
        rejected.reasons.some((reason) => reason.includes("action 0 is file-explorer-create-file: make the file with the mouse")),
        JSON.stringify(rejected.reasons)
    );

    for (const actions of [viaMouse("math.ts", code), viaTouch("math.ts", code)]) {
        setLessonActions(courseId, lessonId, [opening, ...actions]);
        const accepted = await validateCourse(courseId);
        assert.equal(accepted.done, true, JSON.stringify(accepted.reasons));
        assert.equal(getLessonFile(courseId, lessonId, "math.ts"), code);
    }
});

test("validation rejects composite actions, which nothing implements yet", async () => {
    const courseId = createCourse({ name: "Composites" });
    const lessonId = addLesson(courseId, { name: "Only" });
    setLessonActions(courseId, lessonId, [
        { name: "composite-create-file-with-mouse", value: "math.ts" },
        { name: "editor-type", value: "export const x = 1;\n" },
        { name: "editor-save", value: "1" },
    ] as IAction[]);
    const result = await validateCourse(courseId);
    assert.equal(result.done, false);
    assert.ok(
        result.reasons.some((reason) => reason.includes("action 0 is composite-create-file-with-mouse: not supported yet")),
        JSON.stringify(result.reasons)
    );
});

test("validation rejects a paste with nothing on the clipboard", async () => {
    const courseId = createCourse({ name: "Paste" });
    const lessonId = addLesson(courseId, { name: "From the docs" });
    const typed = viaMouse("x.ts", "export const x = 1;\n").slice(0, -1);
    const paste = { name: "editor-command-v", value: "1" } as IAction;
    const save = { name: "editor-save", value: "1" } as IAction;

    setLessonActions(courseId, lessonId, [opening, ...typed, paste, save]);
    const rejected = await validateCourse(courseId);
    assert.equal(rejected.done, false);
    assert.ok(
        rejected.reasons.some((reason) => reason.includes(`action ${typed.length + 1} (editor-command-v): the clipboard is empty here`)),
        JSON.stringify(rejected.reasons)
    );

    const fromDocs = { name: "clipboard-set-text", value: "export const y = 2;\n" } as IAction;
    setLessonActions(courseId, lessonId, [opening, ...typed, fromDocs, paste, save]);
    const accepted = await validateCourse(courseId);
    assert.equal(accepted.done, true, JSON.stringify(accepted.reasons));
    assert.equal(getLessonFile(courseId, lessonId, "x.ts"), "export const x = 1;\nexport const y = 2;\n");
});

test("validation requires every lesson to open with speech", async () => {
    const courseId = createCourse({ name: "Openings" });
    const lessonId = addLesson(courseId, { name: "Silent start" });
    const code = "export const x = 1;\n";
    setLessonActions(courseId, lessonId, viaMouse("x.ts", code));
    const silent = await validateCourse(courseId);
    assert.equal(silent.done, false);
    assert.ok(silent.reasons.some((reason) => reason.includes("must open with author-speak-before")), JSON.stringify(silent.reasons));

    setLessonActions(courseId, lessonId, [opening, ...viaMouse("x.ts", code)]);
    assert.equal((await validateCourse(courseId)).done, true);
});

test("a replay that breaks names the action responsible", () => {
    const courseId = createCourse({ name: "Tabs" });
    const lessonId = addLesson(courseId, { name: "Two files" });
    const a = (name: string, value = "1") => ({ name, value }) as IAction;
    const inSrc = (file: string): IAction[] => [
        a("mouse-move-file-explorer-folder", "src"), a("mouse-right-click"), a("mouse-move-file-explorer-folder-context-menu-new-file"),
        a("mouse-left-click"), a("file-explorer-type-new-file-input", file), a("file-explorer-enter-new-file-input"),
    ];
    const actions = [
        a("mouse-move-file-explorer"), a("mouse-right-click"), a("mouse-move-file-explorer-context-menu-new-folder"), a("mouse-left-click"),
        a("file-explorer-type-new-folder-input", "src"), a("file-explorer-enter-new-folder-input"),
        ...inSrc("a.ts"), ...inSrc("b.ts"),
        // A tab clicked by its bare name instead of its path.
        a("mouse-move-editor-tab", "a.ts"), a("mouse-left-click"),
    ];
    assert.throws(() => setLessonActions(courseId, lessonId, actions), /Action 19 \(mouse-left-click\) clicks what action 18 \(mouse-move-editor-tab "a\.ts"\) points at/);

    actions[18] = a("mouse-move-editor-tab", "src/a.ts");
    setLessonActions(courseId, lessonId, actions);
});

test("lesson files can be named with or without a leading slash", () => {
    const courseId = createCourse({ name: "Paths" });
    const lessonId = addLesson(courseId, { name: "Only" });
    setLessonActions(courseId, lessonId, viaMouse("a.ts", "let a = 1;"));
    for (const name of ["a.ts", "/a.ts", "./a.ts"]) assert.equal(getLessonFile(courseId, lessonId, name), "let a = 1;", name);
    assert.equal(getLessonFile(courseId, lessonId, "b.ts"), null);
});
