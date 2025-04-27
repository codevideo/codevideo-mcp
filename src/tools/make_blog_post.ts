import { IAction } from "@fullstackcraftllc/codevideo-types";
import { generateMarkdownStringFromActions } from '@fullstackcraftllc/codevideo-exporters';

// calls the markdown generator from the codevideo-exporters package
export const makeBlogPost = (actions: Array<IAction>): string => {
    return generateMarkdownStringFromActions(actions);
}