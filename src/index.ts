import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { getActionNames } from "./resources/get_action_names";
import { makeVideo } from "./tools/make_video";
import { validateActions } from "./tools/validate_actions";
import { getExampleLesson } from "./resources/get_example_lesson";
import { IAction, ICourse, ILesson } from "@fullstackcraftllc/codevideo-types";
import * as packageJson from '../package.json';
import { makeBlogPost } from "./tools/make_blog_post";
import { instructionsToCreateLessonActions } from "./prompts/instructions_to_create_lesson_actions";
import { getFinalLessonSnapshot } from "./tools/get_final_lesson_snapshot";
import { getInitialLessonStateFromLocalCodebase } from "./tools/get_initial_lesson_state_from_local_repo";
import { isRepeatable } from "./tools/is_repeatable_action";
import { instructionsToCreateACourse } from "./prompts/instructions_to_create_a_course";
import { createCourseWithInitialMetadata } from "./tools/create_course_with_initial_metadata";
import { addLessonToCourse } from "./tools/add_lesson_to_course";
import { addActionsToLesson } from "./tools/add_actions_to_lesson";
import { getEmptyLessonSnapshot } from "./tools/get_empty_lesson_snapshot";

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

const server = new McpServer({
    name: "codevideo-mcp",
    version: packageJson.version,
});

// Commenting out prompts and resources that aren't showing up
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
    {
        actions: z.array(ActionSchema)
    },
    async ({ actions }) => {
        // Cast the actions to IAction
        const typedActions = actions as IAction[];

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
    "codevideo_get_example_lesson",
    {
        keyword: z.string()
    },
    async ({ keyword }) => {
        return {
            content: [{
                type: "text",
                text: getExampleLesson(keyword)
            }]
        };
    }
);

server.tool(
    "codevideo_get_initial_lesson_state_from_local_repo",
    {
        repoLocation: z.string()
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
    "codevideo_make_blog_post",
    {
        actions: z.array(ActionSchema)
    },
    async ({ actions }) => {
        // Cast the actions to IAction
        const typedActions = actions as IAction[];

        return {
            content: [{
                type: "text",
                text: makeBlogPost(typedActions)
            }]
        };
    }
);

server.tool(
    "codevideo_make_video",
    {
        actions: z.array(ActionSchema)
    },
    async ({ actions }) => {
        // Cast the actions to IAction
        const typedActions = actions as IAction[];

        return {
            content: [{
                type: "text",
                text: makeVideo(typedActions)
            }]
        };
    }
);

server.tool(
    "codevideo_validate_actions",
    {
        actions: z.array(ActionSchema)
    },
    async ({ actions }) => {
        // Cast the actions to IAction
        const typedActions = actions as IAction[];

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

// start the server
const transport = new StdioServerTransport();
(async () => {
    await server.connect(transport);
})();