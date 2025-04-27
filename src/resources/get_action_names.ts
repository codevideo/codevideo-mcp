import { AllActionStrings } from '@fullstackcraftllc/codevideo-types';

/**
 * Returns all action names exported by the codevideo-types package, joined by commas.
 */
export const getActionNames = (): string => {
    return AllActionStrings.join(", ");
}