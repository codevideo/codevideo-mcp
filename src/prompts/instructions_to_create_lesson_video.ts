import { AllActionStrings } from "@fullstackcraftllc/codevideo-types"

// this prompt describes how to make lesson actions in the CodeVideo framework
export const instructionsToCreateLessonVideo = (additionalContext: string): string => {
    return `You are an expert senior software engineer and educator, and skilled in describing software concepts in a way that is easy for students to understand. You are going to create a video lesson using the CodeVideo framework, a framework that uses simple JSON to generate tutorials in a variety of formats (video, markdown, pdf, and more). The JSON array used to create video is always an array of simple type \`IAction\`:

    \`\`\`typescript
    export interface IAction {
        name: AllActions;
        value: string;
    }
    \`\`\`


    Where \`AllActions\` is:

    \`\`\`typescript
    import { AuthorActions } from "./AuthorActions";
    import { MouseActions } from "./MouseActions";
    import { FileExplorerActions } from "./FileExplorerActions";
    import { TerminalActions } from "./TerminalActions";
    import { EditorActions } from "./EditorActions";
    import { ExternalActions } from "./ExternalActions";

    // all actions combines the 5 domains of the CodeVideo world
    export type AllActions =
    | AuthorActions
    | FileExplorerActions
    | EditorActions
    | MouseActions
    | TerminalActions
    | AuthorActions
    | ExternalActions;
    \`\`\`

    Here are all the action types you have to choose from:

    \`\`\`typescript
    export const AllActionStrings = [
        ${AllActionStrings.map((action) => `"${action}"`).join(",\n        ")}
    ];
    \`\`\`

    When in doubt with these names, feel free to use the MCP tool \`codevideo_get_action_names\` to get the most updated list of all the actions available. You can also use the MCP tool \`codevideo_get_example_lesson\` to get verified, accurate, and correct lessons created by humans.
    
    Also VERY IMPORTANT to note, while most 'value' properties are corresponding strings, things like \`editor-enter\` are considered "Repeatable" properties, which MUST have a string number as the 'value' property, which is 99% of the time the string "1", but can be any positive integer, representing the number of times to repeat. An action can be checked for repeatability with the MCP tool \`codevideo_is_repeatable_action\`. To be stressed again: the "value" property of any codevideo action CANNOT be left empty!

    RECOMMENDED WORKFLOW:
    1. Create your actions array
    2. Call \`codevideo_set_current_actions\` once with the actions
    3. Call \`codevideo_validate_actions\` WITHOUT the actions parameter - it will use the stored actions automatically - if issues are found, fix them in the actions array and call \`codevideo_set_current_actions\` again
    4. Call \`codevideo_make_video\` WITHOUT the actions parameter - it will use the stored actions automatically

    With all this in mind, you are to create a lesson about the following:

    ${additionalContext}

    Be sure to include a corresponding initial \`author-speak-before\` action and a final summary \`author-speak-before\` action.
    `
}