import { IAction } from "@fullstackcraftllc/codevideo-types";
import { CURRENT_ACTIONS_KEY } from "../constants/Constants";
import { getStoredValue } from "../store/keyValueStore";

// retrieves the current actions from the key value sqlite database
export const getCurrentActions = (): IAction[] | null => {
    try {
        const value = getStoredValue(CURRENT_ACTIONS_KEY);
        return value ? (JSON.parse(value) as IAction[]) : null;
    } catch (error: any) {
        console.error('Error retrieving actions:', error);
        return null;
    }
};

// Helper function that returns actions or throws descriptive error
export const getCurrentActionsOrThrow = (): IAction[] => {
    const actions = getCurrentActions();
    if (!actions) {
        throw new Error('No actions found in storage. Please use codevideo_set_current_actions first to store actions, then try again.');
    }
    return actions;
};
