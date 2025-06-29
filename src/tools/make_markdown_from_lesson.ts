import { ILesson } from "@fullstackcraftllc/codevideo-types";
import { generateMarkdownStringFromActions } from '@fullstackcraftllc/codevideo-exporters';
import { getCurrentLesson } from "./get_current_lesson";

// calls the markdown generator from the codevideo-exporters package using a lesson's actions
export const makeMarkdownFromLesson = (lesson?: ILesson): string => {
    // Use provided lesson or retrieve from storage
    const lessonToUse = lesson || getCurrentLesson();
    
    if (!lessonToUse) {
        throw new Error("No lesson provided and no current lesson found in storage");
    }
    
    return generateMarkdownStringFromActions(lessonToUse.actions);
}
