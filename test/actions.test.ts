import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { AllActionDescriptions } from "@fullstackcraftllc/codevideo-types";
import { homeEnv, McpSession, startMcp, tempHome } from "./helpers";

// What the model learns about actions comes from codevideo-types as is, so
// these checks read the expected text from there instead of restating it.

const withMcp = async (fn: (mcp: McpSession) => Promise<void>): Promise<void> => {
    const home = tempHome();
    const mcp = await startMcp(homeEnv(home));
    try {
        await fn(mcp);
    } finally {
        await mcp.close();
        fs.rmSync(home, { recursive: true, force: true });
    }
};

const describedValue = (name: string): string => AllActionDescriptions.find((action) => action.name === name)!.valueDescription;

test("codevideo_get_action_names lists every action with what its value takes", async () => {
    await withMcp(async (mcp) => {
        const lines = ((await mcp.callRaw("codevideo_get_action_names", {})).content[0].text as string).split("\n");
        assert.equal(lines.length, AllActionDescriptions.length);
        for (const action of AllActionDescriptions) {
            assert.ok(lines.some((line) => line.startsWith(`${action.name}: `) && line.endsWith(`Value: ${action.valueDescription}`)), action.name);
        }
    });
});

test("codevideo_validate_actions names what's wrong and what to do instead", async () => {
    await withMcp(async (mcp) => {
        const checked = await mcp.call("codevideo_validate_actions", {
            actions: [
                { name: "composite-create-file-with-mouse", value: "math.ts" },
                { name: "file-explorer-create-file", value: "math.ts" },
                { name: "file-explorer-rename-file", value: "math.ts" },
                { name: "editor-highlight-code", value: "add" },
            ],
        });
        assert.equal(checked.isError, true);
        const messages = checked.errorMessages.join("\n");
        assert.match(messages, /action 0 is composite-create-file-with-mouse: not supported yet/);
        assert.match(messages, /action 1 is file-explorer-create-file: make the file with the mouse/);
        assert.ok(messages.includes(`action index 2`) && messages.includes(describedValue("file-explorer-rename-file")), messages);
        assert.match(messages, /action 3 is editor-highlight-code: not supported yet/);
    });
});

test("storing a lesson flags actions lessons can't use, until an edit swaps them out", async () => {
    await withMcp(async (mcp) => {
        const { courseId } = await mcp.call("codevideo_create_course", { name: "Problems", primaryLanguage: "typescript" });
        const { lessonId } = await mcp.call("codevideo_add_lesson", { courseId, name: "Only", description: "Writes a.ts." });
        const stored = await mcp.call("codevideo_set_lesson_actions", {
            courseId,
            lessonId,
            actions: [
                { name: "file-explorer-create-file", value: "a.ts" },
                { name: "file-explorer-open-file", value: "a.ts" },
                { name: "editor-type", value: "let a = 1;\n" },
                { name: "editor-save", value: "1" },
            ],
        });
        assert.match(stored.problems, /action 0 is file-explorer-create-file: make the file with the mouse/);

        const edited = await mcp.call("codevideo_edit_lesson_actions", {
            courseId,
            lessonId,
            edits: [{
                start: 0,
                deleteCount: 2,
                insert: [
                    { name: "mouse-move-file-explorer", value: "1" },
                    { name: "mouse-right-click", value: "1" },
                    { name: "mouse-move-file-explorer-context-menu-new-file", value: "1" },
                    { name: "mouse-left-click", value: "1" },
                    { name: "file-explorer-type-new-file-input", value: "a.ts" },
                    { name: "file-explorer-enter-new-file-input", value: "1" },
                ],
            }],
        });
        assert.equal(edited.problems, undefined);
    });
});

test("each lesson needs a description, and the next lesson gets it back for its recap", async () => {
    await withMcp(async (mcp) => {
        const { courseId } = await mcp.call("codevideo_create_course", { name: "Recaps", primaryLanguage: "typescript" });
        const missing = await mcp.callRaw("codevideo_add_lesson", { courseId, name: "No description" });
        assert.equal(missing.isError, true);

        const first = await mcp.call("codevideo_add_lesson", { courseId, name: "Add", description: "Writes an add function in math.ts." });
        assert.equal(first.previousLesson, undefined);
        await mcp.call("codevideo_set_lesson_actions", {
            courseId,
            lessonId: first.lessonId,
            actions: [
                { name: "author-speak-before", value: "Let's write add." },
                { name: "mouse-move-file-explorer", value: "1" },
                { name: "mouse-right-click", value: "1" },
                { name: "mouse-move-file-explorer-context-menu-new-file", value: "1" },
                { name: "mouse-left-click", value: "1" },
                { name: "file-explorer-type-new-file-input", value: "math.ts" },
                { name: "file-explorer-enter-new-file-input", value: "1" },
                { name: "editor-type", value: "export const add = (a: number, b: number) => a + b;\n" },
                { name: "editor-save", value: "1" },
            ],
        });
        const second = await mcp.call("codevideo_add_lesson", { courseId, name: "Use it", description: "Imports add into main.ts." });
        assert.deepEqual(second.previousLesson, {
            name: "Add",
            description: "Writes an add function in math.ts.",
            files: [{ path: "math.ts", change: "created", open: true }],
        });
    });
});
