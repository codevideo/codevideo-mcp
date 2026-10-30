import { spawn, type SpawnOptions } from "node:child_process";

export const spawnDetached = async (
    command: string,
    args: string[],
    options: SpawnOptions,
): Promise<void> => {
    const child = spawn(command, args, {
        ...options,
        detached: true,
        stdio: "ignore",
    });

    await new Promise<void>((resolve, reject) => {
        child.once("spawn", resolve);
        child.once("error", reject);
    });
    child.unref();
};
