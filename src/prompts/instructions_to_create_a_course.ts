// this prompt describes how to create a course lesson using the CodeVideo framework
export const instructionsToCreateACourse = (additionalContext: string): string => {
    return `You are an expert senior software engineer and educator, and skilled in describing software concepts in a way that is easy for students to understand. You are going to create a course using the CodeVideo framework, a framework that uses simple JSON to generate software courses and lessons in a variety of formats (video, markdown, pdf, and more).

    There are a few rules to uphold when making a CodeVideo course:

    1. The final course snapshot of the previous lesson must be equivalent to the initial course snapshot of the next lesson.
    2. Beyond the first lesson, each lesson must start with an \`author-speak-before\` action that summarizes the previous lesson with a maximum of 3 sentences.
    3. Beyond the first lesson, each lesson must have their second action be an \`author-speak-during\` action that summarizes the current lesson with a maximum of 3 sentences.
    4. Beyond the first lesson, each lesson must end with an \`author-speak-after\` action that summarizes the current lesson with a maximum of 3 sentences.

    With these rules in mind, please create a course with the following lessons:
    
    ${additionalContext}

    Now, you should first think of a name and description for this course, they should be SEO friendly title and meta description respectively. 
    
    To create the initial course object, you can call the MCP tool \`codevideo_create_course_with_initial_metadata\` with the following parameters:
    - id: a unique identifier for the course
    - name: the name of the course
    - description: the description of the course
    - primaryLanguage: the primary language of the course
    
    You should then plan out the number of lessons and what they will be about. To add a lesson to the course, you can call the MCP tool \`codevideo_add_lesson_to_course\` with the following parameters:
    - id: a unique identifier for the lesson. it should relate to the course id, for example if the course id is \`generics-in-typescript\`, the lesson id should be something like \`generics-in-typescript-lesson-1-introduction\`
    - name: the name of the lesson
    - description: the description of the lesson

    You then need to create the initial lesson snapshot. For the very first lesson, you can call the tool \`codevideo_get_empty_lesson_snapshot\` without any parameters to get an empty lesson snapshot object. For the rest of the lessons, you can copy the final lesson snapshot of the previous lesson and use that as the initial lesson snapshot.

    You then need to add actions to the lesson. First read the prompt in \`codevideo_instructions_to_create_lesson_actions\` to get the instructions on how to create lesson actions. 
    
    When done creating actions, you can add actions to the lesson by calling the MCP tool \`codevideo_add_actions_to_lesson\` with the following parameters:
    - lesson: the ILesson object that you created earlier
    - actions: the array of IAction objects that you created earlier

    For each lesson, you also need to create the final lesson snapshot. You can get the final snapshot the lesson by calling the MCP tool \`codevideo_get_final_lesson_snapshot\` with the following parameters:
    - actions: the array of IAction objects that you created earlier for the lesson

    In summary, the steps to create a course are:

    1. Create the initial course object using the MCP tool \`codevideo_create_course_with_initial_metadata\`
    2. Plan out the number of lessons needed and what they will be about
    3. For each lesson, create a unique identifier, name, and description
    4. Create the initial empty lesson snapshot for the first lesson using the MCP tool \`codevideo_get_empty_lesson_snapshot\`. In the case of lessons beyond the first, copy the final lesson snapshot of the previous lesson and use that as the initial lesson snapshot.
    5. Create actions for the lesson using the MCP tool \`codevideo_instructions_to_create_lesson_actions\`
    6. Add actions to the lesson using the MCP tool \`codevideo_add_actions_to_lesson\`
    7. Create the final lesson snapshot using the MCP tool \`codevideo_get_final_lesson_snapshot\`
    8. Add the lesson to the course using the MCP tool \`codevideo_add_lesson_to_course\`
    9. Repeat steps 4-8 for each lesson

    When done, return the completed course object as a JSON string.
    
    Good luck, and enjoy creating your course!`;
}