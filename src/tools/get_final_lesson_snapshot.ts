import { IAction } from "@fullstackcraftllc/codevideo-types";
import { VirtualIDE } from "@fullstackcraftllc/codevideo-virtual-ide";

export const getFinalLessonSnapshot = (actions: Array<IAction>): string => {
    // create a new instance of codevideo virtual ide
    const virtualIDE = new VirtualIDE();

    // apply all actions to the virtual IDE
    virtualIDE.applyActions(actions);

    // get the final snapshot of the virtual IDE
    const finalSnapshot = virtualIDE.getCourseSnapshot();
    
    // return the final snapshot as a string
    return JSON.stringify(finalSnapshot, null, 2);
}