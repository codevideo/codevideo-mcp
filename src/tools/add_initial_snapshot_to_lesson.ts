import { ICourseSnapshot, ILesson } from "@fullstackcraftllc/codevideo-types";

export const addInitialSnapshotToLesson = (lesson: ILesson, initialSnapshot: ICourseSnapshot): string => {
    lesson.initialSnapshot = initialSnapshot;
    return JSON.stringify(lesson, null, 2);
}

