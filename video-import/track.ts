// Rebuilds full file contents over time from per-frame observations.
//
// Each observation lists the lines visible in one frame (absolute line
// numbers from the editor gutter). A frame only shows a window of the file,
// so the window is spliced into the previous state: lines above it are kept,
// lines below it are carried over, and lines inside it are replaced. When a
// window shows that lines moved (something above it was deleted off screen),
// the most recently added lines above the window are the ones removed.
//
// usage: npx tsx video-import/track.ts <lessonDir>
//   reads  <lessonDir>/observations.txt, <lessonDir>/frames.json and, when the
//          lesson starts with existing files, <lessonDir>/initial-files.json
//   writes <lessonDir>/states.json
import fs from "node:fs";
import path from "node:path";
import { FrameRecord } from "./frames";

export interface Observation {
    index: number;
    t: number;
    file: string;
    eof: boolean;
    lines: Map<number, string | null>; // null = hidden by a popup
    notes: string[];
}

export interface StatePoint {
    index: number;
    t: number;
    afterCue: number;
    activeFile: string | null;
    files: Record<string, string[]>;
    notes: string[];
}

interface Line { text: string; born: number; }

export const parseObservations = (text: string): Observation[] => {
    const observations: Observation[] = [];
    let current: Observation | null = null;
    for (const raw of text.split("\n")) {
        const header = raw.match(/^# frame (\d+) t=([\d.]+) file=(\S+)(.*)$/);
        if (header) {
            current = {
                index: Number(header[1]),
                t: Number(header[2]),
                file: header[3],
                eof: /\beof=yes\b/.test(header[4]),
                lines: new Map(),
                notes: [],
            };
            observations.push(current);
            continue;
        }
        if (!current || raw.startsWith("#")) continue;
        if (raw.startsWith("! ")) { current.notes.push(raw.slice(2)); continue; }
        const visible = raw.match(/^(\d+)\|(.*)$/);
        if (visible) { current.lines.set(Number(visible[1]), visible[2]); continue; }
        const hidden = raw.match(/^(\d+)\?$/);
        if (hidden) current.lines.set(Number(hidden[1]), null);
    }
    return observations;
};

// Character-level similarity of two lines, 0..1 (longest common subsequence based).
const similarity = (a: string, b: string): number => {
    const x = a.trim(), y = b.trim();
    if (!x.length && !y.length) return 1;
    const dp = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
    for (let i = 1; i <= x.length; i++)
        for (let j = 1; j <= y.length; j++)
            dp[i][j] = x[i - 1] === y[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    return (2 * dp[x.length][y.length]) / (x.length + y.length);
};

// Finds the previous-state index of the first window line that appears there
// verbatim, scanning both in order. Returns [prevIndex, windowIndex] or null.
const firstAnchor = (prev: Line[], window: string[], from: number): [number, number] | null => {
    for (let j = 0; j < window.length; j++) {
        // blank lines and lone brackets ("}", "})") match in too many places to anchor on
        if ((window[j].match(/[A-Za-z0-9]/g) ?? []).length < 3) continue;
        // prefer the occurrence closest to where the line number says it is
        let best = -1;
        for (let i = 0; i < prev.length; i++) {
            if (prev[i].text !== window[j]) continue;
            if (best === -1 || Math.abs(i - (from + j)) < Math.abs(best - (from + j))) best = i;
        }
        if (best !== -1) return [best, j];
    }
    return null;
};

export const applyObservation = (prevState: Line[], obs: Observation, warnings: string[]): Line[] => {
    if (obs.lines.size === 0) return prevState;
    const numbers = [...obs.lines.keys()].sort((a, b) => a - b);
    const first = numbers[0], last = numbers[numbers.length - 1];
    let prev = prevState.map(line => ({ ...line }));

    // Hidden lines: assume they did not change since the last frame.
    const window: string[] = [];
    for (let n = first; n <= last; n++) {
        const seen = obs.lines.get(n);
        window.push(seen === undefined || seen === null ? (prev[n - 1]?.text ?? "") : seen);
    }

    // Lines deleted above the window move everything up; remove the newest ones.
    const anchor = firstAnchor(prev, window, first - 1);
    if (anchor) {
        const shift = anchor[0] - anchor[1] - (first - 1);
        if (shift > 0) {
            const above = prev.slice(0, first - 1 + shift).map((line, i) => ({ ...line, i }));
            const doomed = new Set(above.sort((a, b) => b.born - a.born || b.i - a.i).slice(0, shift).map(l => l.i));
            warnings.push(`frame ${obs.index}: ${shift} line(s) removed above the view: ${[...doomed].map(i => JSON.stringify(prev[i].text)).join(", ")}`);
            prev = prev.filter((_, i) => !doomed.has(i));
        } else if (shift < 0) {
            warnings.push(`frame ${obs.index}: ${-shift} line(s) were added above the view and never seen; state may be incomplete`);
        }
    }

    const prefix = prev.slice(0, first - 1);
    while (prefix.length < first - 1) prefix.push({ text: "", born: obs.index });

    // Map window lines onto the previous lines from line `first` on: equal lines keep
    // their age, similar lines are edits of the same line, the rest are new.
    const rest = prev.slice(first - 1);
    const merged: Line[] = [];
    let p = 0;
    for (const text of window) {
        const lookahead = rest.slice(p, p + 6).findIndex(line => line.text === text && text.trim() !== "");
        if (rest[p] && rest[p].text === text) {
            merged.push(rest[p]); p++;
        } else if (lookahead > 0) {
            // lines in between were deleted
            p += lookahead;
            merged.push(rest[p]); p++;
        } else if (rest[p] && similarity(rest[p].text, text) >= 0.5) {
            merged.push({ text, born: rest[p].born }); p++;
        } else {
            merged.push({ text, born: obs.index });
        }
    }
    const suffix = obs.eof ? [] : rest.slice(p);
    return [...prefix, ...merged, ...suffix];
};

const main = () => {
    const lessonDir = process.argv[2];
    if (!lessonDir) throw new Error("usage: track.ts <lessonDir>");
    const observations = parseObservations(fs.readFileSync(path.join(lessonDir, "observations.txt"), "utf8"));
    const frames: FrameRecord[] = JSON.parse(fs.readFileSync(path.join(lessonDir, "frames.json"), "utf8"));
    const byIndex = new Map(observations.map(o => [o.index, o]));
    const files = new Map<string, Line[]>();
    // Files that already exist when the lesson starts (e.g. from the previous lesson's branch).
    const seedPath = path.join(lessonDir, "initial-files.json");
    if (fs.existsSync(seedPath)) {
        const seed: Record<string, string> = JSON.parse(fs.readFileSync(seedPath, "utf8"));
        for (const [file, content] of Object.entries(seed)) files.set(file, content.split("\n").map(text => ({ text, born: -1 })));
    }
    const warnings: string[] = [];
    const statesByIndex = new Map<number, StatePoint>();
    const points: StatePoint[] = [];

    for (const frame of frames) {
        if (frame.sameAs !== null) {
            const same = statesByIndex.get(frame.sameAs)!;
            points.push({ ...same, index: frame.index, t: frame.t, afterCue: frame.afterCue, notes: [] });
            continue;
        }
        const obs = byIndex.get(frame.index);
        if (!obs) throw new Error(`no observation for frame ${frame.index}`);
        if (obs.lines.size > 0 || !files.has(obs.file)) {
            const prev = files.get(obs.file) ?? [];
            if (obs.lines.size > 0) files.set(obs.file, applyObservation(prev, obs, warnings));
        }
        const point: StatePoint = {
            index: frame.index,
            t: frame.t,
            afterCue: frame.afterCue,
            activeFile: obs.file,
            files: Object.fromEntries([...files].map(([file, lines]) => [file, lines.map(l => l.text)])),
            notes: obs.notes,
        };
        statesByIndex.set(frame.index, point);
        points.push(point);
    }

    fs.writeFileSync(path.join(lessonDir, "states.json"), JSON.stringify(points, null, 2));
    for (const warning of warnings) console.log("note:", warning);
    const final = points[points.length - 1];
    for (const [file, lines] of Object.entries(final.files)) console.log(`final ${file}: ${lines.length} lines`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
