import { IAction } from "@fullstackcraftllc/codevideo-types";
import { CURRENT_ACTIONS_KEY } from "../constants/Constants";
import { setStoredValue } from "../store/keyValueStore";

// sets the current actions to the key value sqlite database
export const setCurrentActions = (actions: IAction[]): string => {
    try {
        const dbPath = setStoredValue(CURRENT_ACTIONS_KEY, JSON.stringify(actions));
        return `Successfully stored ${actions.length} actions in local database at ${dbPath}`;
    } catch (error: any) {
        return `Error storing actions: ${error.message}`;
    }
};
