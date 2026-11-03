import { ILesson } from "@fullstackcraftllc/codevideo-types";
import { CURRENT_LESSON_KEY } from "../constants/Constants";
import { getStoredValue } from "../store/keyValueStore";

// retrieves the current lesson from the key value sqlite database
export const getCurrentLesson = (): ILesson | null => {
    try {
        const value = getStoredValue(CURRENT_LESSON_KEY);
        return value ? (JSON.parse(value) as ILesson) : null;
    } catch (error: any) {
        console.error('Error retrieving lesson:', error);
        return null;
    }
};

// Helper function that returns lesson or throws descriptive error
export const getCurrentLessonOrThrow = (): ILesson => {
    const lesson = getCurrentLesson();
    if (!lesson) {
        throw new Error('No lesson found in storage. Please use codevideo_set_current_lesson first to store a lesson, then try again.');
    }
    return lesson;
};
