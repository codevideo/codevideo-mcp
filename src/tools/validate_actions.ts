import { IAction, isValidAction } from "@fullstackcraftllc/codevideo-types";

/**
 * Validates the actions so the LLM can correct any mistakes it makes
 * 
 */
export const validateActions = (actions: Array<IAction>): string => {
    // loop over all actions and call the isValidAction function from the types package
    const errorMessages: string[] = [];
    for (var i = 0; i < actions.length; i++) {
        const action = actions[i];
        if (!isValidAction(action)) {
            errorMessages.push(`Invalid action at action index ${i}: ${JSON.stringify(action)}`);
        }
    }

    if (errorMessages.length > 0) {
        return JSON.stringify({ isError: true, errorMessages });
    }

    return JSON.stringify({ isError: false, errorMessages: [] });
} 