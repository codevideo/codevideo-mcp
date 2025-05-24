import { IAction, isValidAction } from "@fullstackcraftllc/codevideo-types";
import { getCurrentActionsOrThrow } from "./get_current_actions";

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
        // codevideo-types package should cover all action types - normal and repeatable!
        if (!isValidAction(action)) {
            errorMessages.push(`Invalid action at action index ${i}: ${JSON.stringify(action)}. Hint: if this action 'name' is a repeatable action, the 'value' property must be a number. To repeat once, simply use the string "1".`);
        }
    }

    if (errorMessages.length > 0) {
        return JSON.stringify({ isError: true, errorMessages });
    }

    return JSON.stringify({ isError: false, errorMessages: [] });
} 