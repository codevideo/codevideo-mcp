import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { getCodeVideoCliRuntime } from "../src/utils/getBinaryPath";

const parseText = (result: any) => {
    const text = result.content[0].text;
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`Expected JSON tool response, received: ${text}`, { cause: error });
    }
};

test("npm CLI resolver selects a working 0.0.7 binary", () => {
    const runtime = getCodeVideoCliRuntime();
    const output = execFileSync(runtime.binaryPath, ["--version"], {
        env: runtime.env,
        encoding: "utf8",
    });
    assert.match(output, /CodeVideo CLI v0\.0\.7/);
});

test("MCP exposes tools and rejects an empty lesson as complete", async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "codevideo-mcp-test-"));
    const client = new Client({ name: "codevideo-mcp-test", version: "1.0.0" });
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: ["--import", "tsx", "src/index.ts"],
        cwd: process.cwd(),
        env: { ...process.env, HOME: home },
        stderr: "pipe",
    });

    try {
        await client.connect(transport);
        const tools = await client.listTools();
        assert.ok(tools.tools.length >= 40);

        const course = parseText(await client.callTool({
            name: "codevideo_create_course",
            arguments: { name: "Validation smoke test" },
        }));
        const lesson = parseText(await client.callTool({
            name: "codevideo_add_lesson",
            arguments: { courseId: course.courseId, name: "Empty lesson" },
        }));
        const validation = parseText(await client.callTool({
            name: "codevideo_validate_course",
            arguments: { courseId: course.courseId },
        }));

        assert.equal(validation.done, false);
        assert.equal(validation.lessons[0].lessonId, lesson.lessonId);
        assert.equal(validation.lessons[0].hasActions, false);
        assert.match(validation.reasons.join("\n"), /has no actions/);

        const actions = [{
            name: "author-speak-before",
            value: "This is a minimal package smoke-test lesson.",
        }];
        const actionValidation = parseText(await client.callTool({
            name: "codevideo_validate_actions",
            arguments: { actions },
        }));
        assert.equal(actionValidation.isError, false);

        const stored = parseText(await client.callTool({
            name: "codevideo_set_lesson_actions",
            arguments: { courseId: course.courseId, lessonId: lesson.lessonId, actions },
        }));
        assert.equal(stored.actionCount, 1);

        const preview = parseText(await client.callTool({
            name: "codevideo_generate_lesson_preview",
            arguments: { courseId: course.courseId, lessonId: lesson.lessonId },
        }));
        assert.ok(fs.statSync(preview.previewHtml).isFile());
    } finally {
        await client.close();
        fs.rmSync(home, { recursive: true, force: true });
    }
});
