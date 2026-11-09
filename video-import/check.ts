// Runs the MCP's own action checks on a converted lesson.
import fs from "node:fs";
import { validateActions } from "../src/tools/validate_actions";
import { rejectedActionsIn, describeRejected } from "../src/validation/rejectedActions";
import { checkDiagnosticHovers } from "../src/validation/diagnosticHovers";

const lesson = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const rejected = rejectedActionsIn(lesson.actions);
console.log("validate_actions:", validateActions(lesson.actions).slice(0, 300));
console.log("rejected actions:", rejected.length ? describeRejected(rejected) : "none");
console.log("opens with speech:", lesson.actions[0]?.name === "author-speak-before");
console.log("empty values:", lesson.actions.filter((a: any) => !a.value).length);
const hoverProblems = checkDiagnosticHovers(lesson.initialSnapshot, lesson.actions);
console.log("diagnostic hovers:", lesson.actions.filter((a: any) => a.name === "mouse-move-editor-diagnostic").length, "found,", hoverProblems.length ? JSON.stringify(hoverProblems) : "all land on a squiggle");
