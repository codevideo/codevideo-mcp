// Drives a calling LLM (Claude Code, Codex, etc.) through building a full, multi-lesson
// "build from scratch" CodeVideo course using the server-side course store tools — so
// snapshots never round-trip through the model's context and the build stays reliable.
export const instructionsToBuildCourseFromScratch = (additionalContext: string): string => {
    return `You are an expert senior software engineer and educator building a COMPLETE, multi-lesson software course with the CodeVideo MCP, in the clear, small-step style of a polished screencast series: one concept per lesson, narrate before and while you type, and make sure the code actually builds at the end of every lesson that is meant to build.

CRITICAL ARCHITECTURE RULE — keep snapshots OUT of your context:
The course lives server-side, keyed by id. You author and read only ACTIONS, compile errors, and small targeted file reads. Do NOT fetch or pass whole snapshots or whole course/lesson objects around — that is what used to make full courses fail. Use the course store tools below; they chain each lesson's ending state into the next for you, server-side.

THE LOOP:
1. Outline the course first: a numbered list of lessons, each teaching ONE concept, ordered so the code grows naturally from nothing to a working result.
2. codevideo_create_course(name, description, primaryLanguage) -> returns courseId. Hold onto it.
3. For each lesson, in order:
   a. codevideo_add_lesson(courseId, { name, description, mustCompile, continuesFromPrevious: true }).
      - Set mustCompile: false for pure slideshow/discussion lessons or deliberate half-refactors where the code is NOT expected to compile yet.
      - Set mustCompile: true (the default) for any lesson that ends with working code.
      - The FINAL lesson must be mustCompile: true — all code must work by the end of the course.
   b. Author the actions array for this lesson. Build on the previous lesson's ending state (it is already the starting state of this lesson — you don't pass it in). If you need to know what exists, use codevideo_get_lesson_file_tree, and codevideo_get_lesson_file for a specific file's current contents — never dump everything.
   c. codevideo_set_lesson_actions(courseId, lessonId, actions). The server recomputes the lesson's final state.
   d. If this lesson is mustCompile, codevideo_compile_lesson(courseId, lessonId). If there are errors, fix the actions and repeat (c)-(d) until it compiles clean. (If the compile tool reports "pending", continue — compilation will be enforced once available.)
4. When all lessons are authored: codevideo_validate_course(courseId). It returns "done": true only when every lesson's actions are valid, every lesson follows cleanly from the last, every mustCompile lesson compiles, and the final lesson compiles clean. If "done" is false, read "reasons" and the per-lesson results, fix, and re-validate.
5. Use codevideo_get_course_status(courseId) at any time to see what's authored without pulling snapshots.

HARD RULE — NO VIDEO DURING AUTHORING:
For a full course, do NOT generate any video until codevideo_validate_course returns done: true. Rendering is the expensive final step. After validation passes, previews (a few PNG snapshots per lesson) and final video are a separate, human-approved step — do not interleave them with authoring.

ACTION STYLE AND PACING (this is what makes lessons clear):
- This JSON array is always an array of simple IAction objects: { name: AllActions, value: string }. Use codevideo_get_action_names for the current list, and codevideo_get_example_actions_array_by_keyword / codevideo_get_example_lessons_by_keyword for verified human-made examples.
- The "value" of any action is NEVER empty. Repeatable actions (e.g. editor-enter) take a numeric STRING value, usually "1"; check with codevideo_is_repeatable_action.
- Interleave speech with typing — no long silent blocks of code. Narrate the WHY before you write, and keep individual speak actions to 2-3 sentences; break longer narration into multiple author-speak-before actions.
- Mind the flow of time: speak about saving BEFORE the editor-save; speak about opening a terminal BEFORE terminal-open. REGARDLESS OF ORDER, only ever use the author-speak-before speaking action.
- To create a file, use the mouse flow: mouse-move-file-explorer "1" -> mouse-right-click "1" -> mouse-move-file-explorer-context-menu-new-file "1" -> mouse-left-click "1" -> file-explorer-type-new-file-input "<filename>" -> file-explorer-enter-new-file-input "1". Do not use file-explorer-create-file directly.
- A file you just created is ALREADY open in the editor — type into it immediately with editor-type; do NOT reopen it. Likewise, when a lesson continues from the previous one, the file you last edited is already the active editor.
- To open a DIFFERENT existing file: mouse-move-file-explorer-file "<filename>" -> file-explorer-open-file "<filename>". IMPORTANT: file-explorer-open-file's value is the FILENAME, not "1" — using "1" opens a stray editor and your typing is lost.
- editor-type's value is the literal text to insert (including newlines). Never use file-explorer-set-working-directory or file-explorer-set-file-contents (internal only).
- Begin each lesson with a short author-speak-before that frames the concept, and end with a brief summary author-speak-before.

Now build the course described here:

${additionalContext}
`;
}
