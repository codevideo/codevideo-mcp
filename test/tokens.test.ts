import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { homeEnv, startMcp, tempHome } from "./helpers";

// The course store's point: authoring lesson N costs the model about as much
// context as lesson 1, because snapshots and earlier lessons stay server-side.
// Bytes of tool arguments plus replies stand in for tokens.

const REPLY_BUDGET_BYTES = 16 * 1024;

const lessonActions = (i: number) => [
    { name: "author-speak-before", value: `In lesson ${i} we add one more helper to the project.` },
    { name: "file-explorer-create-file", value: `helper${i}.ts` },
    { name: "file-explorer-open-file", value: `helper${i}.ts` },
    { name: "editor-type", value: `export const helper${i} = (n: number): number => n * ${i};\n` },
    { name: "editor-save", value: "1" },
    { name: "author-speak-before", value: "That's this lesson's helper; next we build on it." },
];

/** Authors a course of `lessons` lessons and returns the bytes each lesson cost. */
const authorCourse = async (lessons: number): Promise<number[]> => {
    const home = tempHome();
    const mcp = await startMcp(homeEnv(home));
    try {
        let bytes = 0;
        const call = async (name: string, args: Record<string, unknown>) => {
            const result = await mcp.callRaw(name, args);
            const reply = result.content[0].text as string;
            assert.ok(Buffer.byteLength(reply) <= REPLY_BUDGET_BYTES, `${name} replied with ${Buffer.byteLength(reply)} bytes`);
            bytes += Buffer.byteLength(JSON.stringify(args)) + Buffer.byteLength(reply);
            return JSON.parse(reply);
        };
        const { courseId } = await call("codevideo_create_course", { name: "Flatness", primaryLanguage: "typescript" });
        const perLesson: number[] = [];
        for (let i = 1; i <= lessons; i++) {
            const before = bytes;
            const { lessonId } = await call("codevideo_add_lesson", { courseId, name: `Lesson ${i}`, description: `Adds helper${i}.` });
            await call("codevideo_set_lesson_actions", { courseId, lessonId, actions: lessonActions(i) });
            perLesson.push(bytes - before);
        }
        // Course-wide calls stay small too, the export included.
        await call("codevideo_get_course_status", { courseId });
        const exported = await call("codevideo_export_course", { courseId });
        assert.equal(exported.lessonCount, lessons);
        assert.ok(fs.statSync(exported.path).size > REPLY_BUDGET_BYTES / 4);
        return perLesson;
    } finally {
        await mcp.close();
        fs.rmSync(home, { recursive: true, force: true });
    }
};

test("authoring a lesson costs the same in a long course as in a short one", async () => {
    const average = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const short = average(await authorCourse(2));
    const long = await authorCourse(6);
    assert.ok(Math.abs(average(long) - short) / short <= 0.1, `per-lesson bytes: ${short} with 2 lessons, ${average(long)} with 6`);
    // Lesson 1 has no previous lesson to recap, so lesson 2 is the first like the rest.
    assert.ok(long[5] <= long[1] * 1.1, `lesson 6 cost ${long[5]} bytes, lesson 2 cost ${long[1]}`);
});
