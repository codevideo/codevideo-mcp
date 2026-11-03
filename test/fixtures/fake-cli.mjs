#!/usr/bin/env node
// A stand-in for codevideo-cli 0.0.13 in the render tests. It prints what the
// CLI prints when stderr isn't a terminal and writes the -o file. What it does
// depends on a marker in the -p project JSON:
//   (none)       succeed after a short pause
//   fake:fail    fail the way a missing Chrome does
//   fake:hang    write a partial -o file, start a child process, record both
//                PIDs, and wait to be killed
// Each run appends {pid, args, path, start, end} to FAKE_CLI_LOG when it's set.
import fs from "node:fs";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const value = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
};
const project = value("-p") ?? "";
const output = value("-o");
const start = Date.now();
const record = (extra = {}) => {
    if (process.env.FAKE_CLI_LOG) {
        fs.appendFileSync(process.env.FAKE_CLI_LOG, JSON.stringify({ pid: process.pid, args, path: process.env.PATH, start, end: Date.now(), ...extra }) + "\n");
    }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

console.error("Detected project type: Actions");
console.error("/> CodeVideo generation in progress...");
console.error("[  4%] Starting browser · 0:00 / 0:10");

if (project.includes("fake:fail")) {
    await sleep(100);
    console.error("error: recording failed: exit status 1: CODEVIDEO_CHROME_PATH is not an executable file: /nonexistent/chrome");
    console.error("See the log for details: /tmp/codevideo.log");
    record();
    process.exit(1);
}

if (project.includes("fake:hang")) {
    // The child behaves like the recorder's Puppeteer: SIGTERM only closes the
    // browser and keeps the process alive; SIGINT exits.
    const child = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { stdio: "ignore" });
    fs.writeFileSync(output, "partial mp4");
    if (process.env.FAKE_CLI_PIDS) {
        fs.writeFileSync(process.env.FAKE_CLI_PIDS, JSON.stringify({ pid: process.pid, childPid: child.pid }));
    }
    console.error("[ 52%] Recording · action 1/1 · 0:02 / 0:05");
    setInterval(() => {}, 1000);
} else {
    await sleep(Number(process.env.FAKE_CLI_MS ?? 300));
    console.error("[ 52%] Recording · action 1/1 · 0:01 / 0:03");
    console.error("[100%] Done · 0:01");
    fs.writeFileSync(output, "fake mp4");
    console.log(`✅ CodeVideo successfully generated and saved to ${output}`);
    record();
}
