import {
    resolveCodeVideoCliRuntime,
    type CodeVideoCliRuntime,
} from "@fullstackcraftllc/codevideo-cli";

export function getCodeVideoCliRuntime(): CodeVideoCliRuntime {
    return resolveCodeVideoCliRuntime();
}

export function getBinaryPath(): string {
    return getCodeVideoCliRuntime().binaryPath;
}
