import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { compileFiles } from '../src/tools/compileCheck';
import test from 'node:test';
import type { IAction } from '@fullstackcraftllc/codevideo-types';
import { VirtualIDE } from '@fullstackcraftllc/codevideo-virtual-ide';
import { verifyLesson } from '../src/tools/verifyLesson';
import { homeEnv, startMcp, tempHome } from './helpers';
const write = (code: string, save = true): IAction[] => [
    { name: 'file-explorer-create-file', value: 'main.ts' },
    { name: 'file-explorer-open-file', value: 'main.ts' },
    { name: 'editor-type', value: code },
    ...(save ? [{ name: 'editor-save', value: '1' }] : []),
] as IAction[];
const good = 'export const count: number = 1;\n';
const bad = 'export const count: number = "wrong";\n';
test('lesson verification refuses unsaved code even if the saved empty file compiles', async () => {
    const result = await verifyLesson({ actions: write(bad, false) });
    assert.equal(result.outcome, 'failed'); assert.equal(result.status, 'errors');
    assert.equal(result.projects[0].outcome, 'passed');
    assert.equal(result.lessonIssues[0].kind, 'unsaved');
    assert.match(result.lessonIssues[0].message, /editor-save/);
});
test('lesson verification replays a cloned initial snapshot and detects stale final state', async () => {
    const ide = new VirtualIDE(); ide.applyActions(write(good));
    const initial = ide.getCourseSnapshot(); const before = structuredClone(initial);
    const actions: IAction[] = [{ name: 'editor-shift+home', value: '1' }, { name: 'editor-type', value: bad }, { name: 'editor-save', value: '1' }];
    const result = await verifyLesson({ initialSnapshot: initial, finalSnapshot: initial, actions });
    assert.deepEqual(initial, before);
    assert.equal(result.outcome, 'failed');
    assert.ok(result.lessonIssues.some(i => i.kind === 'snapshot'));
    assert.ok(result.projects.flatMap(p => p.errors).some(e => e.code === 'TS2322'));
});
test('lesson verification reports a replay failure without running compilation', async () => {
    const result = await verifyLesson({ initialSnapshot: {} as any, actions: [] });
    assert.equal(result.outcome, 'failed'); assert.equal(result.lessonIssues[0].kind, 'replay'); assert.deepEqual(result.projects, []);
});
test('empty lessons cannot gain a successful compile outcome', async () => {
    assert.equal((await verifyLesson({ actions: [{ name: 'author-speak-before', value: 'Hello.' }] })).outcome, 'unsupported');
});
test('MCP stdio authors, breaks, repairs and rechecks a chained course using exact saved files', async () => {
    const scratch = tempHome(); const mcp = await startMcp(homeEnv(scratch));
    try {
        const { courseId } = await mcp.call('codevideo_create_course', { name: 'Verification round trip' });
        const { lessonId } = await mcp.call('codevideo_add_lesson', { courseId, name: 'First', description: 'Create a typed value' });
        const actions = [
            { name: 'author-speak-before', value: 'We will write a typed value.' },
            { name: 'mouse-move-file-explorer', value: '1' }, { name: 'mouse-right-click', value: '1' },
            { name: 'mouse-move-file-explorer-context-menu-new-file', value: '1' }, { name: 'mouse-left-click', value: '1' },
            { name: 'file-explorer-type-new-file-input', value: 'main.ts' }, { name: 'file-explorer-enter-new-file-input', value: '1' },
            { name: 'editor-type', value: good }, { name: 'editor-save', value: '1' },
        ];
        await mcp.call('codevideo_set_lesson_actions', { courseId, lessonId, actions });
        const second = await mcp.call('codevideo_add_lesson', { courseId, name: 'Second', description: 'Continue from the first' });
        await mcp.call('codevideo_set_lesson_actions', { courseId, lessonId: second.lessonId, actions: [{ name: 'author-speak-before', value: 'We wrote a typed value in the last lesson.' }] });
        for (const code of [good, bad, good]) {
            await mcp.call('codevideo_edit_lesson_actions', { courseId, lessonId, edits: [{ start: 7, deleteCount: 1, insert: [{ name: 'editor-type', value: code }] }] });
            const state = await mcp.call('codevideo_get_lesson_file', { courseId, lessonId: second.lessonId, path: 'main.ts' });
            assert.equal(state.content, code);
            const result = await mcp.call('codevideo_compile_lesson', { courseId, lessonId });
            assert.equal(result.outcome, code === bad ? 'failed' : 'passed', JSON.stringify(result));
            if (code === bad) assert.ok(result.projects[0].errors.some((e: any) => e.code === 'TS2322' && e.file === 'main.ts' && e.line === 1));
            const course = await mcp.call('codevideo_validate_course', { courseId });
            assert.equal(course.done, code !== bad, JSON.stringify(course.reasons));
        }
    } finally { await mcp.close(); fs.rmSync(scratch, { recursive: true, force: true }); }
});

test('MCP verification preserves replay warnings without turning them into failures', async () => {
    const actions = [...write(good), { name: 'terminal-open', value: '1' }, { name: 'terminal-type', value: 'not-a-real-command' }, { name: 'terminal-enter', value: '1' }] as IAction[];
    const checked = await verifyLesson({ actions });
    assert.equal(checked.outcome, 'passed');
    assert.ok(checked.warnings.some(w => /command/i.test(w.message)));
});


for (const language of ['Python', 'Go', 'C#']) {
    const tool = language === 'Python' ? 'python3' : language === 'Go' ? 'go' : 'dotnet';
    let installed = false;
    try { execFileSync(tool, language === 'Go' ? ['version'] : ['--version'], { stdio: 'ignore' }); installed = true; } catch {}
    test(`MCP adapter verifies real ${language} good/error/repaired files offline`, { skip: !installed && process.env.CODEVIDEO_REQUIRE_TOOLCHAINS !== '1' }, async () => {
        assert.ok(installed, `${tool} is required in integration CI`);
        for (const broken of [false, true, false]) {
            const files = language === 'Python' ? [{ path: 'app/main.py', content: broken ? 'def broken(\n' : 'print("hello")' }]
                : language === 'Go' ? [{ path: 'go.mod', content: 'module example.com/lesson\n\ngo 1.22\n' }, { path: 'main.go', content: broken ? 'package main\nfunc main() { var n int = "wrong"; _ = n }' : 'package main\nfunc main() {}' }]
                : [{ path: 'Lesson.csproj', content: '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>' }, { path: 'Helper.cs', content: broken ? 'public class Helper { int value = "wrong"; }' : 'public class Helper {}' }];
            const result = await compileFiles(files);
            assert.equal(result.outcome, broken ? 'failed' : 'passed', JSON.stringify(result));
            if (broken) assert.ok(result.projects[0].errors.some(error => error.line === (language === 'Go' ? 2 : 1) && error.file.endsWith(language === 'Python' ? '.py' : language === 'Go' ? '.go' : '.cs')));
        }
    });
}

test('lesson replay failures identify the responsible action', async () => {
    const ide = new VirtualIDE(); ide.applyActions(write(good));
    const result = await verifyLesson({ initialSnapshot: ide.getCourseSnapshot(), actions: [
        { name: 'mouse-move-editor-tab', value: 'missing.ts' },
        { name: 'mouse-left-click', value: '1' },
    ] });
    assert.equal(result.outcome, 'failed');
    assert.ok(result.lessonIssues.some(issue => issue.kind === 'replay' && issue.actionIndex === 1), JSON.stringify(result));
});

test('an intentionally broken intermediate lesson may skip compilation while the final lesson must pass', async () => {
    const scratch = tempHome(); const mcp = await startMcp(homeEnv(scratch));
    try {
        const { courseId } = await mcp.call('codevideo_create_course', { name: 'Deliberate error' });
        const first = await mcp.call('codevideo_add_lesson', { courseId, name: 'Broken value', description: 'Introduce a type error', mustCompile: false });
        await mcp.call('codevideo_set_lesson_actions', { courseId, lessonId: first.lessonId, actions: [
            { name: 'author-speak-before', value: 'We introduce a type error.' },
            { name: 'terminal-open', value: '1' }, { name: 'terminal-type', value: 'touch main.ts' }, { name: 'terminal-enter', value: '1' },
            { name: 'mouse-move-file-explorer-file', value: 'main.ts' }, { name: 'file-explorer-open-file', value: 'main.ts' },
            { name: 'editor-type', value: bad.trim() }, { name: 'editor-save', value: '1' },
        ] });
        const last = await mcp.call('codevideo_add_lesson', { courseId, name: 'Repair', description: 'Repair the type error' });
        await mcp.call('codevideo_set_lesson_actions', { courseId, lessonId: last.lessonId, actions: [
            { name: 'author-speak-before', value: 'We introduced a type error. Now we repair it.' },
            { name: 'editor-shift+home', value: '1' }, { name: 'editor-type', value: good.trim() }, { name: 'editor-save', value: '1' },
        ] });
        const checked = await mcp.call('codevideo_validate_course', { courseId });
        assert.equal(checked.done, true, JSON.stringify(checked));
        assert.equal(checked.lessons[0].compileStatus, 'skipped');
        assert.equal(checked.lessons[1].verification.outcome, 'passed');
    } finally { await mcp.close(); fs.rmSync(scratch, { recursive: true, force: true }); }
});
