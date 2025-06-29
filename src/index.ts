import dotenv from 'dotenv';
import * as packageJson from '../package.json';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { IAction, ICourse, ILesson } from "@fullstackcraftllc/codevideo-types";

// prompts
import { instructionsToCreateACourse } from "./prompts/instructions_to_create_a_course";
import { instructionsToCreateLessonActions } from "./prompts/instructions_to_create_lesson_actions";
import { instructionsToCreateLessonVideo } from './prompts/instructions_to_create_lesson_video';
import { instructionsToTranslateActions } from './prompts/instructions_to_translate_actions';

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

const CourseSnapshotSchema = z.object({

});

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

export function createMcpServer(): McpServer {
    const server = new McpServer({
        name: "codevideo-mcp",
        version: packageJson.version,
        env: {
            // preserve existing environment variables
            ...Object.fromEntries(
                Object.entries(process.env)
                    .filter(([, value]) => value !== undefined)
                    .map(([key, value]) => [key, value as string])
            ),
            MCP_TIMEOUT: String(1200000), // 20 min - needed for video creation waiting
        }
    });

    setupMcpServerTools(server);
    return server;
}

function setupMcpServerTools(server: McpServer): void {

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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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



server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

}

// start the server when running directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    (async () => {
        await server.connect(transport);
    })();
}