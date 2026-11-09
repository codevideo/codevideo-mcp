// Pulls one editor screenshot per narration cue from a course video, so the
// code on screen can be read back and turned into CodeVideo actions.
//
// Each frame is taken just before the NEXT cue starts: it shows the code after
// this cue's narration plus anything typed in the pause after it. Frames that
// look the same as the previous one (a blinking caret aside) are skipped.
//
// usage: npx tsx video-import/frames.ts <video.mp4> <captions.vtt> <outDir>
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseVtt, Cue } from "./vtt";

// VS Code layout in these recordings (1920x1080): tabs + breadcrumb + editor,
// right of the explorer and above the terminal panel.
const EDITOR_CROP = { w: 1380, h: 648, x: 405, y: 0 };
const READ_SCALE_WIDTH = 966; // ~595 visual tokens per frame, still legible at this zoom
const THUMB = { w: 345, h: 162 };
// A blinking caret changes a handful of thumbnail pixels; a typed character more.
const CHANGED_PIXEL_THRESHOLD = 40;
const SAME_FRAME_MAX_CHANGED = 30;

export interface FrameRecord {
    index: number;        // frame number in time order
    t: number;            // seconds into the video
    afterCue: number;     // -1 = before the first cue
    file: string | null;  // image to read, null when skipped as a duplicate
    sameAs: number | null; // index of the earlier frame this one duplicates
    changedPixels: number; // vs the last kept frame
}

const ffprobeDuration = (video: string): number =>
    parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", video]).toString());

const crop = `crop=${EDITOR_CROP.w}:${EDITOR_CROP.h}:${EDITOR_CROP.x}:${EDITOR_CROP.y}`;

const grabThumb = (video: string, t: number): Buffer =>
    execFileSync("ffmpeg", ["-v", "error", "-ss", t.toFixed(3), "-i", video, "-frames:v", "1",
        "-vf", `${crop},scale=${THUMB.w}:${THUMB.h},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 24 });

const grabFrame = (video: string, t: number, out: string) =>
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", t.toFixed(3), "-i", video, "-frames:v", "1",
        "-vf", `${crop},scale=${READ_SCALE_WIDTH}:-2`, out]);

const countChanged = (a: Buffer, b: Buffer): number => {
    let n = 0;
    for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > CHANGED_PIXEL_THRESHOLD) n++;
    return n;
};

export const sampleTimes = (cues: Cue[], duration: number): Array<{ t: number; afterCue: number }> => {
    const times = [{ t: Math.max(0.2, (cues[0]?.start ?? 0.5) - 0.1), afterCue: -1 }];
    cues.forEach((cue, i) => {
        const next = cues[i + 1];
        const t = next ? Math.max(cue.end, next.start - 0.1) : duration - 0.5;
        times.push({ t, afterCue: i });
    });
    return times;
};

const main = () => {
    const [video, vtt, outDir] = process.argv.slice(2);
    if (!video || !vtt || !outDir) throw new Error("usage: frames.ts <video.mp4> <captions.vtt> <outDir>");
    fs.mkdirSync(path.join(outDir, "frames"), { recursive: true });
    const cues = parseVtt(fs.readFileSync(vtt, "utf8"));
    const duration = ffprobeDuration(video);
    const records: FrameRecord[] = [];
    let lastKept: { index: number; thumb: Buffer } | null = null;
    sampleTimes(cues, duration).forEach(({ t, afterCue }, index) => {
        const thumb = grabThumb(video, t);
        const changedPixels = lastKept ? countChanged(lastKept.thumb, thumb) : Number.POSITIVE_INFINITY;
        if (lastKept && changedPixels <= SAME_FRAME_MAX_CHANGED) {
            records.push({ index, t, afterCue, file: null, sameAs: lastKept.index, changedPixels });
            return;
        }
        const file = path.join("frames", `f${String(index).padStart(3, "0")}_${t.toFixed(1)}s.png`);
        grabFrame(video, t, path.join(outDir, file));
        records.push({ index, t, afterCue, file, sameAs: null, changedPixels });
        lastKept = { index, thumb };
    });
    fs.writeFileSync(path.join(outDir, "cues.json"), JSON.stringify(cues, null, 2));
    fs.writeFileSync(path.join(outDir, "frames.json"), JSON.stringify(records, null, 2));
    const kept = records.filter(r => r.file).length;
    console.log(`${cues.length} cues, ${records.length} sample points, ${kept} distinct frames -> ${outDir}`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
