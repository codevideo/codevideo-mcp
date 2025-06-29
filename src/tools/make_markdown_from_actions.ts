import { IAction } from "@fullstackcraftllc/codevideo-types";
import { generateMarkdownStringFromActions } from '@fullstackcraftllc/codevideo-exporters';
import { getCurrentActionsOrThrow } from "./get_current_actions";

// calls the markdown generator from the codevideo-exporters package
export const makeMarkdownFromActions = (actions?: Array<IAction>): string => {
    // Use provided actions or retrieve from storage
    const actionsToUse = actions || getCurrentActionsOrThrow();
    return generateMarkdownStringFromActions(actionsToUse);
}