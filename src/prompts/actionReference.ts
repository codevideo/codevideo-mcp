import { AllActionDescriptions } from "@fullstackcraftllc/codevideo-types";

/**
 * Every action with what it does and what its value takes, one per line. It
 * comes straight from codevideo-types, so the tools never restate the
 * vocabulary themselves and a new or reworded action reaches the model as is.
 */
export const actionReference = (): string =>
    AllActionDescriptions.map((action) => `${action.name}: ${action.description} Value: ${action.valueDescription}`).join("\n");
