#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { getActionNames } from "./resources/get_action_names";
import { makeVideo } from "./tools/make_video";
import { validateActions } from "./tools/validate_actions";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp";
import { getExampleLesson } from "./resources/get_example_lesson";
import { z } from "zod";
import { IAction } from "@fullstackcraftllc/codevideo-types";
import * as packageJson from '../package.json';
import { makeBlogPost } from "./tools/make_blog_post";
import { createLesson } from "./prompts/create_lesson";

const SimpleActionSchema = z.object({
    name: z.string(),
    value: z.string()
});

const server = new McpServer({
    name: "codevideo-mcp",
    version: packageJson.version,
});

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

// add tools

server.tool(
    "codevideo_make_blog_post",
    {
        actions: z.array(SimpleActionSchema)
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
)

server.tool(
    "codevideo_make_video",
    {
        actions: z.array(SimpleActionSchema)
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
)

server.tool(
    "codevideo_validate_actions",
    {
        actions: z.array(SimpleActionSchema)
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

// start the server

const transport = new StdioServerTransport();
(async () => {
    await server.connect(transport);
})();