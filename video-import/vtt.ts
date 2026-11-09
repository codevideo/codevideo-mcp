// Minimal WebVTT reader for the course caption files (Udemy auto-captions).
export interface Cue {
    start: number; // seconds
    end: number;
    text: string;  // verbatim cue text, lines joined with a space
}

const toSeconds = (stamp: string): number => {
    const parts = stamp.split(":").map(Number);
    return parts.reduce((total, part) => total * 60 + part, 0);
};

export const parseVtt = (vtt: string): Cue[] => {
    const cues: Cue[] = [];
    for (const block of vtt.replace(/\r/g, "").split(/\n\n+/)) {
        const lines = block.split("\n");
        const timingIndex = lines.findIndex(line => line.includes("-->"));
        if (timingIndex === -1) continue;
        const [start, end] = lines[timingIndex].split("-->").map(s => s.trim().split(/\s+/)[0]);
        const text = lines.slice(timingIndex + 1).join(" ").trim();
        if (text) cues.push({ start: toSeconds(start), end: toSeconds(end), text });
    }
    return cues;
};
