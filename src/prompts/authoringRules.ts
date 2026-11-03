// How to write CodeVideo actions. Every prompt that asks for actions includes
// these rules, so an agent gets the same guidance whichever tool it starts from.
export const AUTHORING_RULES = `ACTION STYLE AND PACING (this is what makes lessons clear):
- This JSON array is always an array of simple IAction objects: { name: AllActions, value: string }. codevideo_get_action_names lists every action with what it does and what its value takes, so check the rows for the actions you use; codevideo_get_example_actions_array_by_keyword / codevideo_get_example_lessons_by_keyword give verified human-made examples.
- The "value" of any action is NEVER empty. Repeatable actions (e.g. editor-enter) take a numeric STRING value, usually "1"; check with codevideo_is_repeatable_action.
- Interleave speech with typing — no long silent blocks of code. Narrate the WHY before you write, and keep individual speak actions to 2-3 sentences; break longer narration into multiple author-speak-before actions.
- Mind the flow of time: speak about saving BEFORE the editor-save; speak about opening a terminal BEFORE terminal-open. REGARDLESS OF ORDER, only ever use the author-speak-before speaking action.
- Show every new file being made, one of two ways:
  - The mouse (the default): mouse-move-file-explorer "1" -> mouse-right-click "1" -> mouse-move-file-explorer-context-menu-new-file "1" -> mouse-left-click "1" -> file-explorer-type-new-file-input "<filename>" -> file-explorer-enter-new-file-input "1". For a file inside a folder, start with mouse-move-file-explorer-folder "<folder>" and use mouse-move-file-explorer-folder-context-menu-new-file instead.
  - The terminal, for more technical lessons: terminal-open "1" (if the terminal isn't open yet) -> terminal-type "touch <path>" -> terminal-enter "1".
  Folders the same way: mouse-move-file-explorer-context-menu-new-folder with file-explorer-type-new-folder-input / file-explorer-enter-new-folder-input, or terminal-type "mkdir <path>".
- Never use file-explorer-create-file, file-explorer-create-folder or file-explorer-set-file-contents: they change files with nothing on screen causing it, so things just appear. Don't use the composite-* actions or editor-highlight-code either: they aren't supported yet and do nothing. codevideo_validate_course rejects lessons that use any of these.
- A file you just created with the mouse is ALREADY open in the editor — type into it immediately with editor-type; do NOT reopen it. A file made with touch is not open yet: open it as below. When a lesson continues from the previous one, the file you last edited is already the active editor.
- To open a DIFFERENT existing file: mouse-move-file-explorer-file "<filename>" -> file-explorer-open-file "<filename>". IMPORTANT: file-explorer-open-file's value is the FILENAME, not "1" — using "1" opens a stray editor and your typing is lost.
- Save with editor-save once a file's typing is done (narrating it first): compile checks and file reads see saved contents only.
- editor-type's value is the literal text to insert (including newlines).

NARRATION:
- Every lesson opens with an author-speak-before (codevideo_validate_course checks this). The first lesson frames what the course builds. Every lesson after the first opens with one sentence recapping the previous lesson (codevideo_add_lesson returns its name and description), e.g. "In the last lesson, we built an add function." Vary the wording from lesson to lesson. If the lesson starts something new, bridge instead: "Last time we built X; now we start Y."
- After the recap sentence you may show what it refers to: at most two stops, each an action followed by the sentence about what's now on screen. Bring an open file forward with mouse-move-editor-tab "<path>" + mouse-left-click, or open one with mouse-move-file-explorer-file "<path>" + file-explorer-open-file "<path>"; codevideo_add_lesson lists the previous lesson's files and whether they're open. Pick what this lesson builds on. Don't select code in a recap: the next editor-type would replace the selection.
- Use the inclusive "we" for what happens on screen: "Now we export the function." Switch to "you" for options, advice, caveats and things to try: "You can also write this as an arrow function." Never "I".
- End each lesson with a short summary, after its final save.
- Write file and code names as they appear on screen (math.ts, useState): captions show your exact words.`;
