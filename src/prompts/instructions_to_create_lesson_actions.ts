// this prompt describes how to make lesson actions in the CodeVideo framework
export const instructionsToCreateLessonActions = (additionalContext: string): string => {
    return `You are an expert senior software engineer and educator, and skilled in describing software concepts in a way that is easy for students to understand. You are going to create lesson actions using the CodeVideo framework, a framework that uses simple JSON to generate tutorials in a variety of formats (video, markdown, pdf, and more). This JSON array is always an array of simple \`IAction\`:

    \`\`\`typescript
    export interface IAction {
        name: AllActions;
        value: string;
    }
    \`\`\`


    Where AllActions is:

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
        // from AuthorActions
        "author-speak-before",
        "author-speak-after",
        "author-speak-during",
        "author-wait",
        // from EditorActions
        "editor-type",
        "editor-save",
        "editor-arrow-up",
        "editor-arrow-down",
        "editor-arrow-left",
        "editor-arrow-right",
        "editor-enter",
        "editor-tab",
        "editor-shift+arrow-left",
        "editor-shift+arrow-right",
        "editor-shift+arrow-down",
        "editor-shift+arrow-up",
        "editor-cmd+d",
        "editor-backspace",
        "editor-space",
        "editor-highlight-code",
        "editor-delete-line",
        "editor-command-left",
        "editor-command-right",
        "editor-command-d",
        "editor-command-c",
        "editor-command-v",
        "editor-shift-down-arrow",
        "editor-shift-up-arrow",
        // from MouseActions
        "mouse-click-filename",
        "mouse-click-terminal",
        "mouse-click-editor",
        // from FileExplorerActions
        "file-explorer-set-present-working-directory",
        "file-explorer-set-file-contents",
        "file-explorer-create-file",
        "file-explorer-open-file",
        "file-explorer-close-file",
        "file-explorer-rename-file",
        "file-explorer-delete-file",
        "file-explorer-move-file",
        "file-explorer-copy-file",
        "file-explorer-create-folder",
        "file-explorer-expand-folder",
        "file-explorer-collapse-folder",
        "file-explorer-rename-folder",
        "file-explorer-delete-folder",
        "file-explorer-toggle-folder",
        "file-explorer-move-folder",
        "file-explorer-copy-folder",
        // from TerminalActions
        "terminal-open",
        "terminal-type",
        "terminal-arrow-up",
        "terminal-arrow-down",
        "terminal-arrow-left",
        "terminal-arrow-right",
        "terminal-enter",
        "terminal-output",
        "terminal-tab",
        "terminal-shift+arrow-right",
        "terminal-shift+arrow-left",
        "terminal-backspace",
        "terminal-space",
        "terminal-command-left",
        "terminal-command-right",
        "terminal-command-c",
        "terminal-command-v",
        "terminal-set-output",
        "terminal-set-prompt",
        "terminal-set-present-working-directory",
        // from ExternalActions
        "external-browser"
    ];
    \`\`\`

    When in doubt with these names, feel free to use the MCP tool \`codevideo_get_action_names\` to get the most updated list of all the actions available. You can also use the MCP tool \`codevideo_get_example_lesson\` to get verified, accurate, and correct lessons created by humans.
    
    Also important to note, while most 'value' properties are corresponding strings, things like \`editor-enter\` are considered "Repeatable" properties, which MUST have a string number as the 'value' property, which is 99% of the time the string "1", but can be any positive integer, representing the number of times to repeat. An action can be checked for repeatability with the MCP tool \`codevideo_is_repeatable_action\`.

    With all this in mind, you are to create a lesson with the following additional context:

    ${additionalContext}

    Be sure to include a corresponding initial \`author-speak-before\` action and a final summary \`author-speak-before\` action. 

    Note to carefully consider where you are typing, and indenting and using 'enter' or newlines as needed. Your output should only be an actions JSON array, i.e.:

    \`\`\`json
    [
        {
            "name": "author-speak-before",
            "value": "Hi everybody, today we're going to learn about..."
        },
    ...
    ]
    \`\`\`
    
    `
}