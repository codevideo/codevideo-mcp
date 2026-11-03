import { IAction, isValidAction } from "@fullstackcraftllc/codevideo-types";
import { getCurrentActionsOrThrow } from "./get_current_actions";
import { describeRejected, rejectedActionsIn, valueHint } from "../validation/rejectedActions";

/**
 * Validates the actions so the LLM can correct any mistakes it makes
 *
 */
export const validateActions = (actions?: Array<IAction>): string => {
    // Use provided actions or retrieve from storage
    const actionsToUse = actions || getCurrentActionsOrThrow();

    // loop over all actions and call the isValidAction function from the types package
    const errorMessages: string[] = [];
    for (var i = 0; i < actionsToUse.length; i++) {
        const action = actionsToUse[i];
        const hint = valueHint(action.name);
        // codevideo-types package should cover all action types - normal and repeatable!
        if (!isValidAction(action)) {
            errorMessages.push(hint
                ? `Invalid action at action index ${i}: ${JSON.stringify(action)}. Its value should be: ${hint}`
                : `Invalid action at action index ${i}: ${JSON.stringify(action)}. Unknown action name; codevideo_get_action_names lists them all.`);
        }
    }

    // Valid actions that lessons still can't use, with what to do instead.
    const rejected = rejectedActionsIn(actionsToUse);
    if (rejected.length > 0) {
        errorMessages.push(`Actions lessons can't use: ${describeRejected(rejected)}.`);
    }

    if (errorMessages.length > 0) {
        return JSON.stringify({ isError: true, errorMessages });
    }

    return JSON.stringify({ isError: false, errorMessages: [] });
}
