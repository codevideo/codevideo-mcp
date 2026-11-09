import assert from "node:assert/strict";
import test from "node:test";
import { IAction } from "@fullstackcraftllc/codevideo-types";
import { VirtualIDE } from "@fullstackcraftllc/codevideo-virtual-ide";
import { checkClipboardKeys } from "../src/validation/clipboardKeys";

// Copy, cut and paste only show on screen when a file is open and, for a
// paste, when the clipboard holds something at that point in the lesson.

const act = (name: string, value = "1") => ({ name, value } as IAction);
const openNewFile = (file: string): IAction[] => [act("file-explorer-create-file", file), act("file-explorer-open-file", file)];
const empty = () => new VirtualIDE().getCourseSnapshot();

test("moving a line to another file with cut and paste passes", () => {
    const actions = [
        ...openNewFile("a.ts"),
        act("editor-type", "keep\nmove me"),
        act("editor-command-x"),
        ...openNewFile("b.ts"),
        act("editor-command-v"),
    ];
    assert.deepEqual(checkClipboardKeys(empty(), actions), []);
});

test("a paste before anything was copied is flagged, and clipboard-set-text fixes it", () => {
    const actions = [...openNewFile("a.ts"), act("editor-command-v")];
    const problems = checkClipboardKeys(empty(), actions);
    assert.equal(problems.length, 1);
    assert.equal(problems[0].index, 2);
    assert.match(problems[0].reason, /the clipboard is empty here, so nothing is pasted/);

    const fixed = [...openNewFile("a.ts"), act("clipboard-set-text", "const fromDocs = true;"), act("editor-command-v")];
    assert.deepEqual(checkClipboardKeys(empty(), fixed), []);
});

test("copy, cut and paste with no file open are flagged", () => {
    const actions = [act("clipboard-set-text", "x"), act("editor-command-c"), act("editor-command-x"), act("editor-command-v")];
    const problems = checkClipboardKeys(empty(), actions);
    assert.deepEqual(problems.map((problem) => problem.index), [1, 2, 3]);
    for (const problem of problems) assert.match(problem.reason, /no file is open here/);
});

test("a paste after clipboard-clear is flagged", () => {
    const actions = [...openNewFile("a.ts"), act("clipboard-set-text", "x"), act("clipboard-clear"), act("editor-command-v")];
    assert.deepEqual(checkClipboardKeys(empty(), actions).map((problem) => problem.index), [4]);
});

test("text already on the clipboard when the lesson starts can be pasted", () => {
    const setup = new VirtualIDE();
    setup.applyActions(openNewFile("a.ts"));
    const snapshot = setup.getCourseSnapshot();
    snapshot.clipboardSnapshot = { text: "copied in the previous lesson" };
    assert.deepEqual(checkClipboardKeys(snapshot, [act("editor-command-v")]), []);
});
