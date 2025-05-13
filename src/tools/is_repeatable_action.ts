import { IAction, isRepeatableAction } from "@fullstackcraftllc/codevideo-types";


export const isRepeatable = (action: IAction): string => {
    return isRepeatableAction(action) ? "true" : "false";
}