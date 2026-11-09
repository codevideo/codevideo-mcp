import dotenv from 'dotenv';
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import * as packageJson from '../package.json';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { IAction, ICourse, ICourseSnapshot, ILesson, AllActionStrings, isRepeatableAction } from "@fullstackcraftllc/codevideo-types";

// prompts
import { instructionsToCreateACourse } from "./prompts/instructions_to_create_a_course";
import { instructionsToCreateLessonActions } from "./prompts/instructions_to_create_lesson_actions";
import { instructionsToCreateLessonVideo } from './prompts/instructions_to_create_lesson_video';
import { instructionsToTranslateActions } from './prompts/instructions_to_translate_actions';
import { instructionsToBuildCourseFromScratch } from "./prompts/instructions_to_build_course_from_scratch";

// tools
import { getFinalLessonSnapshot } from "./tools/get_final_lesson_snapshot";
import { getInitialLessonStateFromLocalCodebase } from "./tools/get_initial_lesson_state_from_local_repo";
import { getInitialLessonStateFromGitHubRepo } from "./tools/get_initial_lesson_state_from_github_repo";
import { isRepeatable } from "./tools/is_repeatable_action";
import { createCourseWithInitialMetadata } from "./tools/create_course_with_initial_metadata";
import { addLessonToCourse } from "./tools/add_lesson_to_course";
import { addActionsToLesson } from "./tools/add_actions_to_lesson";
import { getEmptyLessonSnapshot } from "./tools/get_empty_lesson_snapshot";
import { critiqueVideoUsingGemini } from "./tools/critique_video_using_gemini";
import { setCurrentActions } from "./tools/set_current_actions";
import { getCurrentActions } from "./tools/get_current_actions";
import { setCurrentLesson } from "./tools/set_current_lesson";
import { getCurrentLesson } from "./tools/get_current_lesson";
import { makeMarkdownFromActions } from "./tools/make_markdown_from_actions";
import { makeMarkdownFromLesson } from "./tools/make_markdown_from_lesson";
import { makeHTMLWebPage } from "./tools/make_html_web_page";
import { queueVideoFromActions } from "./tools/make_video_from_actions";
import { queueVideoFromLesson } from "./tools/make_video_from_lesson";
import { validateActions } from "./tools/validate_actions";

// course store tools (server-side state; snapshots stay out of the model's context)
import {
    createCourseTool,
    addLessonTool,
    setLessonActionsTool,
    getLessonFileTreeTool,
    getLessonFileTool,
    compileLessonTool,
    validateCourseTool,
    getCourseStatusTool,
    exportCourseTool,
    editLessonActionsTool,
    getLessonActionsTool,
} from "./tools/courseTools";

// phase 2: previews + gated video render
import {
    generateLessonPreviewTool,
    generateCoursePreviewsTool,
    renderLessonVideoTool,
    renderCourseVideosTool,
} from "./tools/renderTools";

// render jobs: a queue in the shared database, drained by a background worker
import { RenderOptions, RenderOptionsSchema } from "./render/options";
import { describeJob, describeJobById } from "./render/queue";
import { listJobs, requestCancel } from "./render/jobs";
import { runWorker } from "./render/worker";

// resources
import { getActionNames } from "./resources/get_action_names";
import { getExampleActionsArrayByKeyword } from "./resources/get_example_actions_array_by_keyword";
import { getExampleLessonByKeyword } from './resources/get_example_lessons_by_keyword';

// Load environment variables from .env file
dotenv.config();

const ActionSchema = z.object({
    name: z.string(),
    value: z.string()
});

// Strict variant for the new course-authoring entry point: rejects unknown action names and
// empty values at the MCP boundary, so the model gets immediate feedback instead of finding
// out only at validate time. The looser ActionSchema above is kept for the existing
// single-lesson tools that already work well.
const validActionNames = new Set<string>(AllActionStrings);
const StrictActionSchema = z.object({
    name: z.string().refine((name) => validActionNames.has(name), "unknown CodeVideo action name"),
    value: z.string().min(1, "action 'value' must not be empty")
}).refine(
    (a) => !isRepeatableAction(a as IAction) || /^[0-9]+$/.test(a.value),
    { message: "repeatable actions require a positive integer string value (usually \"1\")" }
);

const CourseSnapshotSchema = z.custom((value) => {
    if (!value || typeof value !== "object") return false;
    const snapshot = value as Partial<ICourseSnapshot>;
    return typeof snapshot.isUnsavedChangesDialogOpen === "boolean"
        && typeof snapshot.unsavedFileName === "string"
        && !!snapshot.fileExplorerSnapshot
        && !!snapshot.editorSnapshot
        && !!snapshot.terminalSnapshot
        && !!snapshot.mouseSnapshot
        && !!snapshot.authorSnapshot;
}, "Invalid CodeVideo course snapshot");

const LessonSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    actions: z.array(ActionSchema),
    initialSnapshot: CourseSnapshotSchema,
    finalSnapshot: CourseSnapshotSchema
})

const CourseSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    primaryLanguage: z.string(),
    lessons: z.array(LessonSchema)
});

// Every render tool takes the same options and an `open` switch.
const RenderOptionsParam = RenderOptionsSchema.optional()
    .describe("Render options: orientation, IDE layout (theme, font size, which panes and the cursor are visible), pacing, voice and render mode.");
const openParam = (whenOmitted: boolean) => z.boolean().optional()
    .describe(`Open the finished video in the default player. Defaults to ${whenOmitted}.`);

const QUEUED_MESSAGE = "Queued. It renders in the background, even if this client closes; check it with codevideo_get_render_job.";

const jobReply = (result: { job: Parameters<typeof describeJob>[0]; estimatedSeconds: number }): TextToolResult => ({
    content: [{
        type: "text",
        text: JSON.stringify({ ...describeJob(result.job), estimatedSeconds: result.estimatedSeconds, message: QUEUED_MESSAGE }, null, 2)
    }]
});

const errorReply = (prefix: string, error: unknown): TextToolResult => ({
    isError: true,
    content: [{ type: "text", text: `${prefix}: ${error instanceof Error ? error.message : String(error)}` }]
});

type ToolShape = Record<string, z.ZodTypeAny>;
type ToolArguments<Shape extends ToolShape> = z.output<z.ZodObject<Shape>>;
type TextToolResult = {
    content: Array<{ type: "text"; text: string }>;
    isError?: boolean;
};
type ToolHandler<Shape extends ToolShape> = (
    args: ToolArguments<Shape>,
) => TextToolResult | Promise<TextToolResult>;
interface ToolRegistrar {
    <Shape extends ToolShape>(name: string, shape: Shape, handler: ToolHandler<Shape>): void;
    <Shape extends ToolShape>(name: string, description: string, shape: Shape, handler: ToolHandler<Shape>): void;
}

export function createMcpServer(): McpServer {
    const server = new McpServer({
        name: "codevideo-mcp",
        version: packageJson.version,
    });

    setupMcpServerTools(server);
    return server;
}

function setupMcpServerTools(server: McpServer): void {
    const tool = server.tool.bind(server) as unknown as ToolRegistrar;

// Commenting out prompts and resources that aren't showing up 
// - does Claude just use them internally?
/*
// add prompts
server.prompt(
    "codevideo_create_lesson",
    { additionalContext: z.string() },
    ({ additionalContext }) => ({
        messages: [{
            role: "user",
            content: {
                type: "text",
                text: createLesson(additionalContext)
            }
        }]
    })
);

// add resources
server.resource(
    "codevideo_get_action_names",
    "codevideo_get_action_names://codevideo_get_action_names",
    (uri) => ({
        contents: [{
            uri: uri.href,
            text: getActionNames()
        }]
    })
);

server.resource(
    "codevideo_get_example_lesson",
    new ResourceTemplate("codevideo_get_example_lesson://{keyword}", { list: undefined }),
    async (uri, { keyword }) => ({
        contents: [{
            uri: uri.href,
            text: getExampleLesson(keyword)
        }]
    })
);
*/

tool(
    "codevideo_instructions_to_create_a_course",
    "Instructions for building a multi-lesson course as one JSON object passed between tool calls (the older flow: codevideo_create_course_with_initial_metadata, then codevideo_add_lesson_to_course per lesson). For new courses prefer the server-side flow in codevideo_instructions_to_build_course_from_scratch.",
    {
        additionalContext: z.string().describe("What to build, in your own words: the lessons for a course, or the topic for a lesson.")
    },
    async ({ additionalContext }) => {
        return {
            content: [{
                type: "text",
                text: instructionsToCreateACourse(additionalContext)
            }]
        };
    }
)

tool(
    "codevideo_instructions_to_create_lesson_actions",
    "Instructions for writing the actions of a single lesson: the action reference, the authoring rules, and how to store and render the result.",
    {
        additionalContext: z.string().describe("What to build, in your own words: the lessons for a course, or the topic for a lesson.")
    },
    async ({ additionalContext }) => {
        return {
            content: [{
                type: "text",
                text: instructionsToCreateLessonActions(additionalContext)
            }]
        };
    }
);

tool(
    "codevideo_instructions_to_create_lesson_video",
    "Instructions for writing a single lesson and rendering it to video, either from an actions array (codevideo_make_video_from_actions) or from a full lesson object with snapshots (codevideo_make_video_from_lesson).",
    {
        additionalContext: z.string().describe("What to build, in your own words: the lessons for a course, or the topic for a lesson.")
    },
    async ({ additionalContext }) => {
        return {
            content: [{
                type: "text",
                text: instructionsToCreateLessonVideo(additionalContext)
            }]
        };
    }
);

tool(
    "codevideo_instructions_to_translate_actions",
    "Generate translation instructions for CodeVideo actions. Pass actions array OR use previously stored actions from codevideo_set_current_actions (recommended workflow).",
    {
        actionsToTranslation: z.array(ActionSchema).optional().describe("Array of CodeVideo actions to translate. Optional if actions were previously stored with codevideo_set_current_actions"),
        targetLanguage: z.string().describe("Target language for translation (e.g., 'Spanish', 'French', 'German')")
    },
    async ({ actionsToTranslation, targetLanguage }) => {
        // Cast the actions to IAction if provided
        const typedActions = actionsToTranslation as IAction[] | undefined;

        return {
            content: [{
                type: "text",
                text: instructionsToTranslateActions(typedActions, targetLanguage)
            }]
        };
    }
);

tool(
    "codevideo_get_empty_lesson_snapshot",
    "An empty course snapshot (no files, editors or terminal output) as JSON, to use as the initialSnapshot of a lesson that starts from nothing.",
    {},
    async () => {
        return {
            content: [{
                type: "text",
                text: getEmptyLessonSnapshot()
            }]
        };
    }
)



tool(
    "codevideo_create_course_with_initial_metadata",
    "Returns a new course object as JSON (id, name, description, primaryLanguage, no lessons) for the older flow where the course JSON is passed between tool calls. Nothing is stored; the server-side flow uses codevideo_create_course.",
    {
        id: z.string(),
        name: z.string(),
        description: z.string(),
        primaryLanguage: z.string()
    },
    async ({ id, name, description, primaryLanguage }) => {
        return {
            content: [{
                type: "text",
                text: createCourseWithInitialMetadata(id, name, description, primaryLanguage)
            }]
        };
    }
)

tool(
    "codevideo_add_actions_to_lesson",
    "Sets a lesson object's actions, replacing any it had, and returns the updated lesson as JSON. Nothing is stored; for stored courses use codevideo_set_lesson_actions.",
    {
        lesson: LessonSchema,
        actions: z.array(ActionSchema)
    },
    async ({ lesson, actions }) => {
        // Cast the lesson to ILesson
        const typedLesson = lesson as ILesson;

        // Cast the actions to IAction
        const typedActions = actions as IAction[];

        return {
            content: [{
                type: "text",
                text: addActionsToLesson(typedLesson, typedActions)
            }]
        };
    }
)

tool(
    "codevideo_get_final_lesson_snapshot",
    "Get the final state snapshot after applying CodeVideo actions. Pass actions array OR use previously stored actions from codevideo_set_current_actions (recommended workflow).",
    {
        actions: z.array(ActionSchema).optional().describe("Array of CodeVideo actions to apply. Optional if actions were previously stored with codevideo_set_current_actions")
    },
    async ({ actions }) => {
        // Cast the actions to IAction if provided
        const typedActions = actions as IAction[] | undefined;

        return {
            content: [{
                type: "text",
                text: getFinalLessonSnapshot(typedActions)
            }]
        };
    }
)

tool(
    "codevideo_add_lesson_to_course",
    "Appends a new, empty lesson (id, name, description, an empty initial snapshot) to a course object and returns the updated course as JSON. Nothing is stored; for stored courses use codevideo_add_lesson.",
    {
        course: CourseSchema,
        id: z.string(),
        name: z.string(),
        description: z.string()
    },
    async ({ course, id, name, description }) => {
        // Cast the course to ICourse
        const typedCourse = course as ICourse;

        return {
            content: [{
                type: "text",
                text: addLessonToCourse(typedCourse, id, name, description)
            }]
        };
    }
);

tool(
    "codevideo_get_action_names",
    "Every CodeVideo action, one per line: what it does and what its value takes. Check the rows for the actions you plan to use.",
    {},
    async () => {
        return {
            content: [{
                type: "text",
                text: getActionNames()
            }]
        };
    }
);

tool(
    "codevideo_get_example_actions_array_by_keyword",
    "An example actions array as JSON for a keyword: javascript, js, console log or log; go, golang, golang console log or golang log; python, python console log or python log. Returns an empty string when nothing matches.",
    {
        keyword: z.string().describe("One of the keywords listed in this tool's description.")
    },
    async ({ keyword }) => {
        return {
            content: [{
                type: "text",
                text: getExampleActionsArrayByKeyword(keyword)
            }]
        };
    }
);

tool(
    "codevideo_get_example_lesson_by_keyword",
    "An example lesson as JSON (a Go CLI tool explored from an existing codebase) for the keyword go, golang, explore codebase, existing codebase or go cli tool. Returns an empty string when nothing matches.",
    {
        keyword: z.string().describe("One of the keywords listed in this tool's description.")
    },
    async ({ keyword }) => {
        return {
            content: [{
                type: "text",
                text: getExampleLessonByKeyword(keyword)
            }]
        };
    }
);

tool(
    "codevideo_get_initial_lesson_state_from_local_repo",
    "Create an initial lesson state snapshot from a local repository/codebase directory. This captures the file structure and creates an empty lesson template ready for action recording.",
    {
        repoLocation: z.string().describe("Local file system path to the repository/codebase directory")
    },
    async ({ repoLocation }) => {
        return {
            content: [{
                type: "text",
                text: await getInitialLessonStateFromLocalCodebase(repoLocation)
            }]
        };
    }
);

tool(
    "codevideo_get_initial_lesson_state_from_github_repo",
    "Create an initial lesson state snapshot from a GitHub repository URL. This fetches the repository content, captures the file structure, and creates an empty lesson template ready for action recording.",
    {
        repoUrl: z.string().describe("GitHub repository URL (e.g., https://github.com/user/repo)")
    },
    async ({ repoUrl }) => {
        return {
            content: [{
                type: "text",
                text: await getInitialLessonStateFromGitHubRepo(repoUrl)
            }]
        };
    }
);

tool(
    "codevideo_make_markdown_from_actions",
    "Generate a markdown blog post from CodeVideo actions array. Pass actions array OR use previously stored actions from codevideo_set_current_actions (recommended workflow).",
    {
        actions: z.array(ActionSchema).optional().describe("Array of CodeVideo actions. Optional if actions were previously stored with codevideo_set_current_actions")
    },
    async ({ actions }) => {
        // Cast the actions to IAction if provided
        const typedActions = actions as IAction[] | undefined;

        return {
            content: [{
                type: "text",
                text: makeMarkdownFromActions(typedActions)
            }]
        };
    }
);

tool(
    "codevideo_make_markdown_from_lesson",
    "Generate a markdown blog post from a complete lesson object. Pass a lesson object OR use previously stored lesson from lesson management tools. This extracts the actions from the lesson and generates markdown.",
    {
        lesson: LessonSchema.optional().describe("Complete lesson object. Optional if lesson was previously stored with lesson management tools")
    },
    async ({ lesson }) => {
        // Cast the lesson to ILesson if provided
        const typedLesson = lesson as ILesson | undefined;

        return {
            content: [{
                type: "text",
                text: makeMarkdownFromLesson(typedLesson)
            }]
        };
    }
);

tool(
    "codevideo_make_html_web_page",
    "Generate an HTML web page from CodeVideo actions. Pass actions array OR use previously stored actions from codevideo_set_current_actions (recommended workflow).",
    {
        actions: z.array(ActionSchema).optional().describe("Array of CodeVideo actions. Optional if actions were previously stored with codevideo_set_current_actions")
    },
    async ({ actions }) => {
        // Cast the actions to IAction if provided
        const typedActions = actions as IAction[] | undefined;

        return {
            content: [{
                type: "text",
                text: await makeHTMLWebPage(typedActions)
            }]
        };
    }
);

tool(
    "codevideo_make_video_from_actions",
    "Render a video from CodeVideo actions: pass actions, or omit them to use the ones stored with codevideo_set_current_actions. Queues a background render job and returns its jobId at once; follow it with codevideo_get_render_job.",
    {
        actions: z.array(ActionSchema).optional().describe("Array of CodeVideo actions. Optional if actions were previously stored with codevideo_set_current_actions"),
        options: RenderOptionsParam,
        open: openParam(true),
    },
    async ({ actions, options, open }) => {
        try {
            return jobReply(queueVideoFromActions(actions as IAction[] | undefined, (options ?? {}) as RenderOptions, open ?? true));
        } catch (error) {
            return errorReply("Couldn't queue the video", error);
        }
    }
);

tool(
    "codevideo_make_video_from_lesson",
    "Render a video from a complete lesson object: pass the lesson, or omit it to use the one stored with codevideo_set_current_lesson. Queues a background render job and returns its jobId at once; follow it with codevideo_get_render_job. For lessons in a stored course, use codevideo_render_lesson_video instead.",
    {
        lesson: LessonSchema.optional().describe("Complete lesson object with snapshots. Optional if lesson was previously stored with lesson management tools"),
        options: RenderOptionsParam,
        open: openParam(true),
    },
    async ({ lesson, options, open }) => {
        try {
            return jobReply(queueVideoFromLesson(lesson as ILesson | undefined, (options ?? {}) as RenderOptions, open ?? true));
        } catch (error) {
            return errorReply("Couldn't queue the video", error);
        }
    }
);

tool(
    "codevideo_validate_actions",
    "Checks a list of actions: unknown names, values of the wrong kind, and actions lessons can't use, each with what to do instead.",
    {
        actions: z.array(ActionSchema).optional()
    },
    async ({ actions }) => {
        // Cast the actions to IAction if provided
        const typedActions = actions as IAction[] | undefined;

        return {
            content: [{
                type: "text",
                text: validateActions(typedActions)
            }]
        };
    }
);

tool(
    "codevideo_is_repeatable_action",
    "Whether an action's value is a repeat count (how many times to press the key or run the step) rather than text. Returns true or false.",
    {
        action: ActionSchema
    },
    async ({ action }) => {
        // Cast the action to IAction
        const typedAction = action as IAction;

        return {
            content: [{
                type: "text",
                text: isRepeatable(typedAction)
            }]
        };
    }
)

tool(
    "codevideo_critique_video_using_gemini",
    "Critique a generated video using Google Gemini AI. Pass actions array OR use previously stored actions from codevideo_set_current_actions (recommended workflow).",
    {
        videoPath: z.string().describe("Path to the video file to critique"),
        actions: z.array(ActionSchema).optional().describe("Array of CodeVideo actions used to generate the video. Optional if actions were previously stored with codevideo_set_current_actions")
    },
    async ({ videoPath, actions }) => {
        // Cast the actions to IAction if provided
        const typedActions = actions as IAction[] | undefined;

        try {
            const critique = await critiqueVideoUsingGemini(videoPath, typedActions);
            return {
                content: [{
                    type: "text",
                    text: critique
                }]
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Error critiquing video:", errorMessage);
            return {
                content: [{
                    type: "text",
                    text: `Error critiquing video: ${errorMessage}`
                }]
            };
        }
    }
)

tool(
    "codevideo_set_current_actions",
    "Legacy single-slot store: keep one actions array for later tool calls, so they can run without re-sending it. Every conversation shares this one slot. For courses or several lessons, use codevideo_create_course and the course tools, which keep work apart by id.",
    {
        actions: z.array(ActionSchema).describe("Array of CodeVideo actions to store for later use")
    },
    async ({ actions }) => {
        // Cast the actions to IAction
        const typedActions = actions as IAction[];

        return {
            content: [{
                type: "text",
                text: setCurrentActions(typedActions)
            }]
        };
    }
)

tool(
    "codevideo_get_current_actions",
    "Legacy single-slot store: read back the actions stored with codevideo_set_current_actions (shared by every conversation).",
    {},
    async () => {
        const actions = getCurrentActions();
        if (!actions) {
            return {
                content: [{
                    type: "text",
                    text: "No actions found in storage. Use codevideo_set_current_actions first to store actions."
                }]
            };
        }

        return {
            content: [{
                type: "text",
                text: JSON.stringify(actions, null, 2)
            }]
        };
    }
)

tool(
    "codevideo_set_current_lesson",
    "Legacy single-slot store: keep one lesson object for later tool calls, so they can run without re-sending it. Every conversation shares this one slot. For courses or several lessons, use codevideo_create_course and the course tools, which keep work apart by id.",
    {
        lesson: LessonSchema.describe("Complete lesson object to store for later use")
    },
    async ({ lesson }) => {
        // Cast the lesson to ILesson
        const typedLesson = lesson as ILesson;

        return {
            content: [{
                type: "text",
                text: setCurrentLesson(typedLesson)
            }]
        };
    }
)

tool(
    "codevideo_get_current_lesson",
    "Legacy single-slot store: read back the lesson stored with codevideo_set_current_lesson (shared by every conversation).",
    {},
    async () => {
        const lesson = getCurrentLesson();
        if (!lesson) {
            return {
                content: [{
                    type: "text",
                    text: "No lesson found in storage. Use codevideo_set_current_lesson first to store a lesson."
                }]
            };
        }

        return {
            content: [{
                type: "text",
                text: JSON.stringify(lesson, null, 2)
            }]
        };
    }
)

// ===== Build-from-scratch course flow (server-side state; snapshots stay out of context) =====

tool(
    "codevideo_instructions_to_build_course_from_scratch",
    "Get step-by-step instructions for building a COMPLETE multi-lesson 'build from scratch' course with the course-store tools (snapshots stay server-side). Use this before authoring a full course.",
    { additionalContext: z.string().describe("What the course should teach / build") },
    async ({ additionalContext }) => ({
        content: [{ type: "text", text: instructionsToBuildCourseFromScratch(additionalContext) }]
    })
);

tool(
    "codevideo_create_course",
    "Create a new course (server-side, returns a courseId). Snapshots and lesson state live in the MCP, not in your context.",
    {
        name: z.string(),
        description: z.string().optional(),
        primaryLanguage: z.string().optional(),
        id: z.string().optional()
    },
    async ({ name, description, primaryLanguage, id }) => ({
        content: [{ type: "text", text: createCourseTool({ name, description, primaryLanguage, id }) }]
    })
);

tool(
    "codevideo_add_lesson",
    "Add a lesson to a course. By default it continues from the previous lesson's final state (chained server-side). Set mustCompile:false for slideshow/discussion/half-refactor lessons. The reply includes the previous lesson's name and description, for the recap that opens this lesson.",
    {
        courseId: z.string(),
        name: z.string(),
        description: z.string().min(1, "describe the lesson in one sentence; the next lesson's recap is written from it"),
        mustCompile: z.boolean().optional(),
        continuesFromPrevious: z.boolean().optional()
    },
    async ({ courseId, name, description, mustCompile, continuesFromPrevious }) => ({
        content: [{ type: "text", text: addLessonTool(courseId, { name, description, mustCompile, continuesFromPrevious }) }]
    })
);

tool(
    "codevideo_set_lesson_actions",
    "Store a lesson's actions, replacing any it had. The server recomputes the lesson's final snapshot and re-chains following lessons. Returns only a small ack (no snapshot). To change part of a lesson later, use codevideo_edit_lesson_actions instead of sending every action again.",
    {
        courseId: z.string(),
        lessonId: z.string(),
        actions: z.array(StrictActionSchema)
    },
    async ({ courseId, lessonId, actions }) => {
        try {
            return { content: [{ type: "text", text: setLessonActionsTool(courseId, lessonId, actions as IAction[]) }] };
        } catch (error) {
            return errorReply("Couldn't store the actions", error);
        }
    }
);

tool(
    "codevideo_edit_lesson_actions",
    "Change part of a lesson without re-sending it: each edit removes deleteCount actions at start and inserts the given ones there, like Array.splice. Edits apply in order (each start refers to the actions as the previous edits left them), all or nothing, with one snapshot recompute. Use codevideo_get_lesson_actions to find indices.",
    {
        courseId: z.string(),
        lessonId: z.string(),
        edits: z.array(z.object({
            start: z.number().int().min(0).describe("Index of the first action to change"),
            deleteCount: z.number().int().min(0).describe("How many actions to remove at start (0 to only insert)"),
            insert: z.array(StrictActionSchema).default([]).describe("Actions to insert at start"),
        })).min(1),
    },
    async ({ courseId, lessonId, edits }) => {
        try {
            return { content: [{ type: "text", text: editLessonActionsTool(courseId, lessonId, edits as { start: number; deleteCount: number; insert: IAction[] }[]) }] };
        } catch (error) {
            return errorReply("Couldn't apply the edits", error);
        }
    }
);

tool(
    "codevideo_get_lesson_actions",
    "Read part of a lesson's actions with their indices (default: the first 50), e.g. to find what to change with codevideo_edit_lesson_actions.",
    {
        courseId: z.string(),
        lessonId: z.string(),
        start: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(500).optional(),
    },
    async ({ courseId, lessonId, start, limit }) => ({
        content: [{ type: "text", text: getLessonActionsTool(courseId, lessonId, start, limit) }]
    })
);

tool(
    "codevideo_get_lesson_file_tree",
    "List the file paths present at the END of a lesson (cheap; no file contents, no snapshot).",
    { courseId: z.string(), lessonId: z.string() },
    async ({ courseId, lessonId }) => ({
        content: [{ type: "text", text: getLessonFileTreeTool(courseId, lessonId) }]
    })
);

tool(
    "codevideo_get_lesson_file",
    "Get the contents of ONE file at the END of a lesson (cheap targeted read instead of dumping the whole snapshot).",
    { courseId: z.string(), lessonId: z.string(), path: z.string() },
    async ({ courseId, lessonId, path }) => ({
        content: [{ type: "text", text: getLessonFileTool(courseId, lessonId, path) }]
    })
);

tool(
    "codevideo_compile_lesson",
    "Replay a lesson and verify its saved end-state projects offline. Returns passed, failed, blocked, or unsupported, with check kinds and actionable issues. Monaco diagnostics are presentation-only; dirty buffers prevent a pass.",
    { courseId: z.string(), lessonId: z.string() },
    async ({ courseId, lessonId }) => ({
        content: [{ type: "text", text: await compileLessonTool(courseId, lessonId) }]
    })
);

tool(
    "codevideo_validate_course",
    "Validate actions, continuity, diagnostic hovers, and fresh saved-file project verification. Every mustCompile lesson and the final lesson must have outcome passed; blocked/unsupported/dirty/stale states prevent done:true.",
    { courseId: z.string() },
    async ({ courseId }) => ({
        content: [{ type: "text", text: await validateCourseTool(courseId) }]
    })
);

tool(
    "codevideo_get_course_status",
    "Resumable checkpoint view of a course: lessons, action counts, estimated video length per lesson, flags — without pulling any snapshot.",
    { courseId: z.string() },
    async ({ courseId }) => ({
        content: [{ type: "text", text: getCourseStatusTool(courseId) }]
    })
);

tool(
    "codevideo_export_course",
    "Export the full course (ICourse with snapshots) to a JSON file under ~/.codevideo/exports and return its path. The course itself isn't returned, so it doesn't fill your context.",
    { courseId: z.string() },
    async ({ courseId }) => ({
        content: [{ type: "text", text: exportCourseTool(courseId) }]
    })
);

// ===== Phase 2: previews + video render (gated behind validate_course) =====

tool(
    "codevideo_generate_lesson_preview",
    "Generate a server-side HTML preview of a single lesson (open in a browser to eyeball it). Cheap; no video.",
    { courseId: z.string(), lessonId: z.string() },
    async ({ courseId, lessonId }) => ({
        content: [{ type: "text", text: await generateLessonPreviewTool(courseId, lessonId) }]
    })
);

tool(
    "codevideo_generate_course_previews",
    "Generate HTML previews for every lesson — GATED: only works once codevideo_validate_course returns done. Use for human review before rendering video.",
    { courseId: z.string() },
    async ({ courseId }) => ({
        content: [{ type: "text", text: await generateCoursePreviewsTool(courseId) }]
    })
);

tool(
    "codevideo_render_lesson_video",
    "Render ONE lesson of a stored course to video: queues a background render job and returns its jobId. GATED: refuses until codevideo_validate_course returns done.",
    { courseId: z.string(), lessonId: z.string(), options: RenderOptionsParam, open: openParam(true) },
    async ({ courseId, lessonId, options, open }) => {
        try {
            return { content: [{ type: "text", text: await renderLessonVideoTool(courseId, lessonId, (options ?? {}) as RenderOptions, open ?? true) }] };
        } catch (error) {
            return errorReply("Couldn't queue the video", error);
        }
    }
);

tool(
    "codevideo_render_course_videos",
    "Render every lesson of a stored course to video: queues one background render job per lesson, run one at a time in lesson order. GATED: refuses until codevideo_validate_course returns done. Run only after a human approves the previews.",
    { courseId: z.string(), options: RenderOptionsParam, open: openParam(false) },
    async ({ courseId, options, open }) => {
        try {
            return { content: [{ type: "text", text: await renderCourseVideosTool(courseId, (options ?? {}) as RenderOptions, open ?? false) }] };
        } catch (error) {
            return errorReply("Couldn't queue the videos", error);
        }
    }
);

// ===== Render jobs =====

tool(
    "codevideo_get_render_job",
    "Status of one render job: queued (with how many jobs are ahead), running (with the latest progress line), succeeded (the video exists at outputPath), failed (with the CLI's error), cancelled or interrupted. Includes the last lines of the CLI's log.",
    { jobId: z.string() },
    async ({ jobId }) => {
        const job = describeJobById(jobId, true);
        return job
            ? { content: [{ type: "text", text: JSON.stringify(job, null, 2) }] }
            : { isError: true, content: [{ type: "text", text: `No render job ${jobId}.` }] };
    }
);

tool(
    "codevideo_list_render_jobs",
    "Recent render jobs, newest first (default 20), optionally for one course or in one status.",
    {
        courseId: z.string().optional(),
        status: z.enum(["queued", "running", "succeeded", "failed", "cancelled", "interrupted"]).optional(),
        limit: z.number().int().min(1).max(100).optional(),
    },
    async ({ courseId, status, limit }) => ({
        content: [{ type: "text", text: JSON.stringify(listJobs({ courseId, status, limit }).map((job) => describeJob(job)), null, 2) }]
    })
);

tool(
    "codevideo_cancel_render_job",
    "Cancel one render job, or every unfinished render job of a course. Queued jobs are dropped; a running one is stopped along with its browser.",
    { jobId: z.string().optional(), courseId: z.string().optional() },
    async ({ jobId, courseId }) => {
        if (!jobId === !courseId) {
            return { isError: true, content: [{ type: "text", text: "Pass exactly one of jobId or courseId." }] };
        }
        const { cancelled, stopping } = requestCancel({ jobId, courseId });
        return {
            content: [{
                type: "text",
                text: JSON.stringify({ cancelled, stopping, message: stopping > 0 ? "Stopping the running job; it shows as cancelled within a few seconds." : "Done." }, null, 2)
            }]
        };
    }
);

}

// start the server when running directly
const invokedPath = process.argv[1];
const isDirectExecution = invokedPath !== undefined
    && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(invokedPath);
if (isDirectExecution && process.argv.includes("--render-worker")) {
    // The background render worker (src/render/worker.ts), started by the server.
    runWorker().then(
        () => process.exit(0),
        (error) => {
            console.error(error);
            process.exit(1);
        }
    );
} else if (isDirectExecution) {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    (async () => {
        await server.connect(transport);
    })();
}
