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
import { makeVideoFromActions } from "./tools/make_video_from_actions";
import { makeVideoFromLesson } from "./tools/make_video_from_lesson";
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
} from "./tools/courseTools";

// phase 2: previews + gated video render
import {
    generateLessonPreviewTool,
    generateCoursePreviewsTool,
    renderLessonVideoTool,
    renderCourseVideosTool,
} from "./tools/renderTools";

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
    {
        additionalContext: z.string()
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
    {
        additionalContext: z.string()
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
    {
        additionalContext: z.string()
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
    {
        keyword: z.string()
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
    {
        keyword: z.string()
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
    "Generate a video from CodeVideo actions. Pass actions array OR use previously stored actions from codevideo_set_current_actions (recommended workflow).",
    {
        actions: z.array(ActionSchema).optional().describe("Array of CodeVideo actions. Optional if actions were previously stored with codevideo_set_current_actions")
    },
    async ({ actions }) => {
        // Cast the actions to IAction if provided
        const typedActions = actions as IAction[] | undefined;

        try {
            const result = await makeVideoFromActions(typedActions);
            return {
                isError: !!result.error,
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        outputPath: result.outputPath,
                        stdout: result.stdout,
                        stderr: result.stderr
                    }, null, 2)
                }]
            };
        } catch (error: any) {
            console.error('Error making video:', error);
            // If the error has the VideoResult structure
            if (error && typeof error === 'object' && 'stdout' in error && 'stderr' in error) {
                return {
                    content: [{
                        type: "text",
                        text: `Error creating video: ${error.error?.message || String(error.error)}\nstdout: ${error.stdout}\nstderr: ${error.stderr}`
                    }]
                };
            }
            // Fall back to simple error message
            return {
                content: [{
                    type: "text",
                    text: `Error creating video: ${error?.message || String(error)}`
                }]
            };
        }
    }
);

tool(
    "codevideo_make_video_from_lesson",
    "Generate a video from a complete lesson object. Pass a lesson object OR use previously stored lesson from lesson management tools. This is useful when you have a full lesson with snapshots rather than just actions.",
    {
        lesson: LessonSchema.optional().describe("Complete lesson object with snapshots. Optional if lesson was previously stored with lesson management tools")
    },
    async ({ lesson }) => {
        // Cast the lesson to ILesson if provided
        const typedLesson = lesson as ILesson | undefined;

        try {
            const result = await makeVideoFromLesson(typedLesson);
            return {
                isError: !!result.error,
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        outputPath: result.outputPath,
                        stdout: result.stdout,
                        stderr: result.stderr
                    }, null, 2)
                }]
            };
        } catch (error: any) {
            console.error('Error making video from lesson:', error);
            // If the error has the VideoResult structure
            if (error && typeof error === 'object' && 'stdout' in error && 'stderr' in error) {
                return {
                    content: [{
                        type: "text",
                        text: `Error creating video from lesson: ${error.error?.message || String(error.error)}\nstdout: ${error.stdout}\nstderr: ${error.stderr}`
                    }]
                };
            }
            // Fall back to simple error message
            return {
                content: [{
                    type: "text",
                    text: `Error creating video from lesson: ${error?.message || String(error)}`
                }]
            };
        }
    }
);

tool(
    "codevideo_validate_actions",
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
    "Store actions in local SQLite database for reuse across multiple tool calls. Once set, other tools can be called without re-specifying actions.",
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
    "Retrieve the currently stored actions from local database. Use this to inspect what actions were previously set with codevideo_set_current_actions.",
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
    "Store a complete lesson object in local SQLite database for reuse across multiple tool calls. Once set, other tools can be called without re-specifying the lesson.",
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
    "Retrieve the currently stored lesson from local database. Use this to inspect what lesson was previously set with codevideo_set_current_lesson.",
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
    "Add a lesson to a course. By default it continues from the previous lesson's final state (chained server-side). Set mustCompile:false for slideshow/discussion/half-refactor lessons.",
    {
        courseId: z.string(),
        name: z.string(),
        description: z.string().optional(),
        mustCompile: z.boolean().optional(),
        continuesFromPrevious: z.boolean().optional()
    },
    async ({ courseId, name, description, mustCompile, continuesFromPrevious }) => ({
        content: [{ type: "text", text: addLessonTool(courseId, { name, description, mustCompile, continuesFromPrevious }) }]
    })
);

tool(
    "codevideo_set_lesson_actions",
    "Store a lesson's actions. The server recomputes the lesson's final snapshot and re-chains following lessons. Returns only a small ack (no snapshot).",
    {
        courseId: z.string(),
        lessonId: z.string(),
        actions: z.array(StrictActionSchema)
    },
    async ({ courseId, lessonId, actions }) => ({
        content: [{ type: "text", text: setLessonActionsTool(courseId, lessonId, actions as IAction[]) }]
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
    "Compile the code at the end of a lesson and return only the structured errors. Use this to check a lesson builds before moving on.",
    { courseId: z.string(), lessonId: z.string() },
    async ({ courseId, lessonId }) => ({
        content: [{ type: "text", text: await compileLessonTool(courseId, lessonId) }]
    })
);

tool(
    "codevideo_validate_course",
    "Validate the whole course: per-lesson action validity, snapshot continuity, and compilation (for mustCompile lessons + the final lesson). Returns done:true when the course is complete.",
    { courseId: z.string() },
    async ({ courseId }) => ({
        content: [{ type: "text", text: await validateCourseTool(courseId) }]
    })
);

tool(
    "codevideo_get_course_status",
    "Resumable checkpoint view of a course: lessons, action counts, flags — without pulling any snapshot.",
    { courseId: z.string() },
    async ({ courseId }) => ({
        content: [{ type: "text", text: getCourseStatusTool(courseId) }]
    })
);

tool(
    "codevideo_export_course",
    "Export the full course JSON (ICourse with snapshots). Only use when you actually need the whole object, e.g. to render after validation passes.",
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
    "Render ONE lesson to video via codevideo-cli (background). GATED: refuses until codevideo_validate_course returns done.",
    { courseId: z.string(), lessonId: z.string() },
    async ({ courseId, lessonId }) => ({
        content: [{ type: "text", text: await renderLessonVideoTool(courseId, lessonId) }]
    })
);

tool(
    "codevideo_render_course_videos",
    "Render every lesson to video via codevideo-cli (one background job per lesson). GATED: refuses until codevideo_validate_course returns done. Run only after a human approves the previews.",
    { courseId: z.string() },
    async ({ courseId }) => ({
        content: [{ type: "text", text: await renderCourseVideosTool(courseId) }]
    })
);

}

// start the server when running directly
const invokedPath = process.argv[1];
const isDirectExecution = invokedPath !== undefined
    && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(invokedPath);
if (isDirectExecution) {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    (async () => {
        await server.connect(transport);
    })();
}
