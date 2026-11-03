import { AUTHORING_RULES } from "./authoringRules";

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
      - description is required: one sentence on what the lesson teaches. The next lesson's opening recap is written from it, and the reply gives you the previous lesson's.
      - Set mustCompile: false for pure slideshow/discussion lessons or deliberate half-refactors where the code is NOT expected to compile yet.
      - Set mustCompile: true (the default) for any lesson that ends with working code.
      - The FINAL lesson must be mustCompile: true — all code must work by the end of the course.
   b. Author the actions array for this lesson. Build on the previous lesson's ending state (it is already the starting state of this lesson — you don't pass it in). If you need to know what exists, use codevideo_get_lesson_file_tree, and codevideo_get_lesson_file for a specific file's current contents — never dump everything.
   c. codevideo_set_lesson_actions(courseId, lessonId, actions). The server recomputes the lesson's final state.
   d. If this lesson is mustCompile, codevideo_compile_lesson(courseId, lessonId). If there are errors, fix just the actions involved with codevideo_edit_lesson_actions (find indices with codevideo_get_lesson_actions; don't re-send the whole lesson) and repeat (d) until it compiles clean. (If the compile tool reports "pending", continue — compilation will be enforced once available.)
4. When all lessons are authored: codevideo_validate_course(courseId). It returns "done": true only when every lesson's actions are valid, every lesson follows cleanly from the last, every mustCompile lesson compiles, and the final lesson compiles clean. If "done" is false, read "reasons" and the per-lesson results, fix, and re-validate.
5. Use codevideo_get_course_status(courseId) at any time to see what's authored without pulling snapshots.

HARD RULE — NO VIDEO DURING AUTHORING:
For a full course, do NOT generate any video until codevideo_validate_course returns done: true. Rendering is the expensive final step. After validation passes, previews (codevideo_generate_course_previews: an HTML page per lesson) and the final videos (codevideo_render_course_videos: background render jobs, one lesson at a time; follow them with codevideo_list_render_jobs) are a separate, human-approved step — do not interleave them with authoring.

${AUTHORING_RULES}

Now build the course described here:

${additionalContext}
`;
}
