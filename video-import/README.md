# video-import (pilot)

Turns a recorded VS Code lesson (MP4 plus its caption VTT) into a CodeVideo lesson. The narration is the caption text, word for word. The code changes come from reading the screen at each caption cue. Piloted on Advanced TypeScript lessons 3 and 4. These scripts sit outside `src/`, so the MCP build doesn't include them yet.

## Steps

Run from `codevideo-mcp/`. `<lessonDir>` is a working folder for one lesson.

1. `npx tsx video-import/frames.ts <video.mp4> <captions.vtt> <lessonDir>`
   Saves one editor crop per caption cue in `frames/`, plus `frames.json` and `cues.json`.
2. Read every frame in `<lessonDir>/frames/` and write `<lessonDir>/observations.txt` (format below). This step needs a model that can see images. In the pilot, Claude Code read the PNGs with its Read tool, so no API key was needed.
3. If the lesson starts from existing code, write `<lessonDir>/initial-files.json` as `{ "path": "content" }`. Usually that's the repo branch of the previous lesson.
4. `npx tsx video-import/track.ts <lessonDir>`
   Merges the observations into full file states: `states.json`.
5. Write `<lessonDir>/convert-config.json` (fields below), then run
   `npx tsx video-import/convert.ts <lessonDir> <repoDirAtLessonStart> <lessonDir>/convert-config.json`.
   This writes `lesson.json` and `convert-report.json`. Each generated action is applied to a VirtualIDE straight away. The run stops if a caret or edit doesn't land where the observed state needs it, or if a replay of the finished lesson doesn't end on the video's last state.
6. `npx tsx video-import/check.ts <lessonDir>/lesson.json`
   Runs the MCP's action validators and checks that every squiggle hover lands on a squiggle.
7. Render it like any other lesson, with `-p "$(cat lesson.json)"` and a `-c` config that has `theme` and `defaultLanguage`. The CLI renders in realtime mode unless `CODEVIDEO_RENDER_MODE=deterministic` is set. To render with an unreleased renderer, run `codevideo-ide-react/scripts/golden/embed-local.sh` first, and restore `codevideo-cli/cli/staticserver/public` afterwards.

## observations.txt

```
# frame 6 t=34.9 file=src/generics/generics.ts first=50 eof=yes
! IntelliSense popup under line 64
62|sortByKey<IFooBar>(fooBars, "cat")
63|
64|class Ani
65?
```

- **Header, one per frame:** the frame index and time from `frames.json`, the active file, the first visible line, and whether the end of the file is on screen (`eof=yes|no`).
- **`N|text`:** line N exactly as shown. Gutter numbers are absolute.
- **`N?`:** line N is hidden behind a popup, so it keeps its previous text.
- **`! no change`:** the frame matches the previous state.
- **`! hover <TS code> <text>`:** the video hovers that squiggle here, as in `! hover 2345 "cat"`. The converter adds a `mouse-move-editor-diagnostic`.
- **Any other `! …` line:** a note for people.

Write down file states, not keystrokes. Keep what the screen shows, including VS Code's auto-closed brackets (`if (a.)`) and the author's typos (`reu`). Leave out IntelliSense popups, hover tooltips and CodeMetrics lines.

## convert-config.json

- **`id`, `name`, `description`:** the lesson's metadata.
- **`openEditors`, `activeEditor`, `editorCarets`:** the IDE at the start. `editorCarets` maps a path to `{ "row", "col" }`.
- **`expandedFolders`, `extraFolders`, `blankFiles`, `extraFiles`:** file-tree details a repo export doesn't carry, such as `node_modules`, binary files and gitignored files.
- **`showDiagnostics`:** turns TypeScript squiggles on after the first narration.

## Known gaps

- **Pastes are typed out.** `editor-command-c` and `editor-command-v` are declared in codevideo-types, but nothing implements them, so a pasted block plays at typing speed.
- **Only single-file lessons are tested.** Switching between files, terminal segments and browser segments haven't been tried yet.
- **The narration is never rewritten.** Where the captions and Whisper disagree, list the spots for the author to check instead of editing the text.
