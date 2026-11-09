import assert from "node:assert/strict";
import test from "node:test";
import { IAction, ICourseSnapshot } from "@fullstackcraftllc/codevideo-types";
import { VirtualIDE } from "@fullstackcraftllc/codevideo-virtual-ide";
import { computeDiagnostics } from "../src/tools/diagnostics";
import { compileFiles } from "../src/tools/compileCheck";
import { checkDiagnosticHovers } from "../src/validation/diagnosticHovers";

// The squiggles a render draws come from the same TypeScript release, options
// and import shims, so these are the messages a viewer sees in the video.

const generics = [
    "interface IFooBar {",
    "    foo: string;",
    "    bar: string;",
    "}",
    "",
    "function sortByKey<T>(data: Array<T>, key: keyof T) {",
    "    return data;",
    "}",
    "",
    "sortByKey<IFooBar>([], \"cat\")",
    "",
].join("\n");

test("reports the lesson 3 keyof error where VS Code puts it", () => {
    const diagnostics = computeDiagnostics([{ path: "src/generics/generics.ts", content: generics }]);
    assert.deepEqual(diagnostics, [{
        path: "src/generics/generics.ts",
        line: 10,
        column: 24,
        endLine: 10,
        endColumn: 29,
        severity: "error",
        code: 2345,
        message: "Argument of type '\"cat\"' is not assignable to parameter of type 'keyof IFooBar'.",
    }]);
});

test("React code with npm imports, typed hooks and event handlers has no squiggles", () => {
    const app = [
        "import React, { useState, ReactNode } from 'react';",
        "import * as R from 'react';",
        "import Moment from 'react-moment';",
        "import { genericSearch } from './utils/genericSearch';",
        "import './styles.scss';",
        "export function App(props: { children?: ReactNode }) {",
        "    const [query, setQuery] = useState<string>('');",
        "    const Fc: R.FC<{ a: string }> = () => null;",
        "    return <div><input onChange={(event) => setQuery(event.target.value)} /><Moment>{query}</Moment>{genericSearch([1], query).length}{props.children}</div>;",
        "}",
        "export class Panel extends React.Component<{ title: string }> {}",
    ].join("\n");
    const util = "export function genericSearch<T>(items: Array<T>, query: string): Array<T> { return items.filter(() => query.length > 0); }\n";
    assert.deepEqual(computeDiagnostics([{ path: "/src/App.tsx", content: app }, { path: "src/utils/genericSearch.ts", content: util }]), []);
});

test("JavaScript files get syntax errors only", () => {
    // line 2 is broken syntax; line 3 is a type error, which plain JavaScript doesn't check
    const diagnostics = computeDiagnostics([{ path: "src/a.js", content: "const a = 1;\na.foo.bar = (;\nconst b = 1; b.toFixed().missing.call();\n" }]);
    assert.ok(diagnostics.length > 0);
    assert.ok(diagnostics.every((d) => d.line === 2), JSON.stringify(diagnostics));
});

test("compile_lesson separates permissive editor diagnostics from project verification", async () => {
    const clean = await compileFiles([{ path: "src/App.tsx", content: "import React from 'react';\nexport const App = React;\n" }]);
    assert.equal(clean.status, "errors");
    assert.equal(clean.outcome, "blocked");
    assert.deepEqual(clean.diagnostics, []);

    const broken = await compileFiles([{ path: "src/generics/generics.ts", content: generics }]);
    assert.equal(broken.status, "errors");
    assert.equal(broken.outcome, "failed");
    assert.deepEqual(broken.projects.map(p => ({ language: p.language, errors: p.errors })), [{
        language: "TypeScript",
        errors: [{ file: "src/generics/generics.ts", line: 10, column: 24, code: "TS2345", message: "Argument of type '\"cat\"' is not assignable to parameter of type 'keyof IFooBar'." }],
    }]);
});

const typedLesson = (hover: string): { snapshot: ICourseSnapshot; actions: IAction[] } => {
    const snapshot = new VirtualIDE().getCourseSnapshot();
    const actions: IAction[] = [
        { name: "author-speak-before", value: "Let's see what TypeScript says." },
        { name: "file-explorer-create-file", value: "src/generics/generics.ts" },
        { name: "file-explorer-open-file", value: "src/generics/generics.ts" },
        { name: "editor-type", value: generics },
        { name: "editor-show-diagnostics", value: "1" },
        { name: "mouse-move-editor-diagnostic", value: hover },
        { name: "author-speak-before", value: "Argument of type cat is not assignable to parameter of type keyof IFooBar." },
    ];
    return { snapshot, actions };
};

test("a hover on the squiggle passes, unsaved text included", () => {
    const { snapshot, actions } = typedLesson("src/generics/generics.ts:10:25");
    assert.deepEqual(checkDiagnosticHovers(snapshot, actions), []);
    // without a column, any line where a squiggle starts will do
    const lineOnly = typedLesson("src/generics/generics.ts:10");
    assert.deepEqual(checkDiagnosticHovers(lineOnly.snapshot, lineOnly.actions), []);
});

test("a hover that misses names the squiggles that are there", () => {
    const { snapshot, actions } = typedLesson("src/generics/generics.ts:6:1");
    const problems = checkDiagnosticHovers(snapshot, actions);
    assert.equal(problems.length, 1);
    assert.equal(problems[0].index, 5);
    assert.match(problems[0].reason, /no squiggle at that spot; src\/generics\/generics.ts has 10:24-10:29 "Argument of type '"cat"'/);
});

test("a hover on a file that isn't the active editor fails", () => {
    const { snapshot, actions } = typedLesson("src/other.ts:1:1");
    const problems = checkDiagnosticHovers(snapshot, actions);
    assert.equal(problems.length, 1);
    assert.match(problems[0].reason, /src\/other.ts isn't the active editor here \(active: src\/generics\/generics.ts\)/);
});
