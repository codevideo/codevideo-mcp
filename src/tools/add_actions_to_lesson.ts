import { ILesson, IAction } from "@fullstackcraftllc/codevideo-types";

export const addActionsToLesson = (lesson: ILesson, actions: IAction[]): string => {
    lesson.actions = actions;
    return JSON.stringify(lesson, null, 2);
}