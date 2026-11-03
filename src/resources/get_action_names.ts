import { actionReference } from '../prompts/actionReference';

/**
 * Returns every action from the codevideo-types package with what it does and
 * what its value takes, one per line.
 */
export const getActionNames = (): string => {
    return actionReference();
}
