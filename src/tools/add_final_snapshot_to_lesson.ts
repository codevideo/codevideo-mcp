import { ICourseSnapshot, ILesson } from "@fullstackcraftllc/codevideo-types";

export const addFinalSnapshotToLesson = (lesson: ILesson, finalSnapshot: ICourseSnapshot): string => {
    lesson.finalSnapshot = finalSnapshot;
    return JSON.stringify(lesson, null, 2);
}

