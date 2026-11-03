import { ILesson } from "@fullstackcraftllc/codevideo-types";
import { CURRENT_LESSON_KEY } from "../constants/Constants";
import { setStoredValue } from "../store/keyValueStore";

// sets the current lesson to the key value sqlite database
export const setCurrentLesson = (lesson: ILesson): string => {
    try {
        const dbPath = setStoredValue(CURRENT_LESSON_KEY, JSON.stringify(lesson));
        return `Successfully stored lesson "${lesson.name}" (ID: ${lesson.id}) in local database at ${dbPath}`;
    } catch (error: any) {
        return `Error storing lesson: ${error.message}`;
    }
};
