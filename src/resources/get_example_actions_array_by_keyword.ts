import { IAction } from "@fullstackcraftllc/codevideo-types";

const keywordsToExampleActionsMap: Array<{ keywords: string[], actions: Array<IAction> }> = [
    {
        keywords: ["console log", "javascript", "js", "log"],
        actions: [
            {
                name: "author-speak-before",
                value: "Today we're going to learn about console.log in JavaScript. Console.log is a function that allows you to print messages to the console, which is useful for debugging and understanding your code better.",
            },
            {
                name: "author-speak-before",
                value: "Let's first create an index.js file where we will write our code.",
            },
            {
                name: "mouse-move-file-explorer",
                value: "1",
            },
            {
                name: "mouse-right-click",
                value: "1",
            },
            {
                name: "mouse-move-file-explorer-context-menu-new-file",
                value: "1",
            },
            {
                name: "mouse-left-click",
                value: "1",
            }
        ]
    },
    {
        keywords: ["golang", "go", "golang console log", "golang log"],
        actions: [
            {
                "name": "author-speak-before",
                "value": "Let's learn how to use the fmt.Println function in Go!"
            },
            {
                "name": "author-speak-before",
                "value": "Let's first make a main.go file."
            },
            {
                "name": "mouse-move-file-explorer",
                "value": "1"
            },
            {
                "name": "mouse-right-click",
                "value": "1"
            },
            {
                "name": "mouse-move-file-explorer-context-menu-new-file",
                "value": "1"
            },
            {
                "name": "mouse-left-click",
                "value": "1"
            },
            {
                "name": "file-explorer-type-new-file-input",
                "value": "main.go"
            },
            {
                "name": "file-explorer-enter-new-file-input",
                "value": "1"
            },
            {
                "name": "author-speak-before",
                "value": "First, we'll need to declare the main package, and then the main function."
            },
            {
                "name": "editor-type",
                "value": "package main"
            },
            {
                "name": "editor-enter",
                "value": "2"
            },
            {
                "name": "author-speak-before",
                "value": "And we'll need the fmt package to use the Println function."
            },
            {
                "name": "editor-type",
                "value": 'import "fmt"'
            },
            {
                "name": "editor-enter",
                "value": "1"
            },
            {
                "name": "editor-type",
                "value": "func main() {"
            },
            {
                "name": "editor-enter",
                "value": "1"
            },
            {
                "name": "author-speak-before",
                "value": "and let's just print 'Hello world!' to the console."
            },
            {
                "name": "editor-type",
                "value": '    fmt.Println("Hello, world!")'
            },
            {
                "name": "editor-enter",
                "value": "1"
            },
            {
                "name": "editor-type",
                "value": "}"
            },
            {
                "name": "editor-arrow-up",
                "value": "1"
            },
            {
                "name": "editor-command-right",
                "value": "1"
            },
            {
                "name": "author-speak-before",
                "value": "and if I wanted to write the value of some variable to the console, I could do that like so:"
            },
            {
                "name": "editor-backspace",
                "value": "32"
            },
            {
                "name": "editor-type",
                "value": "    myVariable := 5"
            },
            {
                "name": "editor-enter",
                "value": "1"
            },
            {
                "name": "editor-type",
                "value": "    fmt.Println(myVariable)"
            },
            {
                "name": "author-speak-before",
                "value": "Now, when I run this code, I would expect the value of 'myVariable' to be printed to the console. Something like:"
            },
            {
                "name": "editor-enter",
                "value": "1"
            },
            {
                "name": "editor-type",
                "value": "    // 5"
            },
            {
                "name": "author-speak-before",
                "value": "Console logging is simple, yet powerful and very useful!"
            }
        ]
    },
    {
        keywords: ["python", "python console log", "python log"],
        actions: [
            {
                "name": "author-speak-before",
                "value": "Let's learn how to use the print function in Python!"
            },
            {
                "name": "author-speak-before",
                "value": "First, let's make a main.py Python file."
            },
            {
                "name": "mouse-move-file-explorer",
                "value": "1"
            },
            {
                "name": "mouse-right-click",
                "value": "1"
            },
            {
                "name": "mouse-move-file-explorer-context-menu-new-file",
                "value": "1"
            },
            {
                "name": "mouse-left-click",
                "value": "1"
            },
            {
                "name": "file-explorer-type-new-file-input",
                "value": "main.py"
            },
            {
                "name": "file-explorer-enter-new-file-input",
                "value": "1"
            },
            {
                "name": "author-speak-before",
                "value": "and let's print 'Hello world!' to the console."
            },
            {
                "name": "editor-type",
                "value": "print('Hello, world!')"
            },
            {
                "name": "author-speak-before",
                "value": "and if I wanted to write the value of some variable to the console, I could do that like so:"
            },
            {
                "name": "editor-backspace",
                "value": "22"
            },
            {
                "name": "editor-type",
                "value": "my_variable = 5"
            },
            {
                "name": "editor-enter",
                "value": "1"
            },
            {
                "name": "editor-type",
                "value": "print(my_variable)"
            },
            {
                "name": "author-speak-before",
                "value": "Now, when I run this code, I would expect the value of 'my_variable' to be printed to the console. Something like:"
            },
            {
                "name": "editor-enter",
                "value": "1"
            },
            {
                "name": "editor-type",
                "value": "# 5"
            },
            {
                "name": "author-speak-before",
                "value": "Console logging is simple, yet powerful and very useful!"
            },
            {
                "name": "author-speak-before",
                "value": "Well done, lets save our file."
            },
            {
                "name": "editor-save",
                "value": "main.py"
            },
            {
                "name": "author-speak-before",
                "value": "Saved!"
            },
            {
                "name": "author-speak-before",
                "value": "Oh... and I've just realized... this file looks a bit strange... let's add the python shebang to the top of the file."
            },
            {
                "name": "editor-arrow-up",
                "value": "4"
            },
            {
                "name": "editor-command-left",
                "value": "1"
            },
            {
                "name": "editor-enter",
                "value": "1"
            },
            {
                "name": "editor-arrow-up",
                "value": "1"
            },
            {
                "name": "editor-type",
                "value": "#!/usr/bin/env python"
            },
            {
                "name": "editor-enter",
                "value": "1"
            },
            {
                "name": "author-speak-before",
                "value": "Ah...much better!"
            },
            {
                "name": "author-speak-before",
                "value": "Let's save the file again."
            },
            {
                "name": "editor-save",
                "value": "main.py"
            },
            {
                "name": "author-speak-before",
                "value": "Saved!"
            },
            {
                "name": "author-speak-before",
                "value": "Now, let's open a terminal and run this file..."
            },
            {
                "name": "terminal-open",
                "value": "1"
            },
            {
                "name": "terminal-type",
                "value": "python main.py"
            },
            {
                "name": "terminal-set-output",
                "value": "5"
            },
            {
                "name": "terminal-enter",
                "value": "1"
            },
            {
                "name": "author-speak-before",
                "value": "Perfect, our code is working as expected! I hope you enjoyed this lesson!"
            }
        ]
    },
]

// returns a JSON representation of an example lesson based on keywords
// the LLM can use this to learn real example lessons created by humans
export const getExampleActionsArrayByKeyword = (keyword: string | string[]): string => {
    const exampleJSONs: string[] = [];

    if (Array.isArray(keyword)) {
        // if the keyword is an array, loop over all keywords and get the example lesson for each one
        for (var i = 0; i < keyword.length; i++) {
            const exampleJSON = getExampleActionsArrayByKeyword(keyword[i]);
            exampleJSONs.push(exampleJSON);
        }
        return exampleJSONs.join(", ");
    } else {
        // if the keyword is a string, get the example lesson for that keyword
        const exampleJSON = getSingleExampleActionsArray(keyword);
        if (exampleJSON) {
            return exampleJSON;
        }
    }
    // if no keywords match, return an empty string
    return "";
}

const getSingleExampleActionsArray = (keyword: string): string => {
    // loop over all keywords and find the first one that matches
    for (var i = 0; i < keywordsToExampleActionsMap.length; i++) {
        const keywordMap = keywordsToExampleActionsMap[i];
        if (keywordMap.keywords.includes(keyword)) {
            return JSON.stringify(keywordMap.actions);
        }
    }

    // if no keywords match, return an empty string
    return "";
}