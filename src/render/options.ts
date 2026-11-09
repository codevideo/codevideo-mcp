import { z } from "zod";

/**
 * Options every render tool accepts. The IDE and layout names match
 * codevideo-api's ICreateVideoOptions, so a request reads the same in both.
 * Resolution is missing on purpose: 4K needs a prop the render page doesn't
 * take yet, so the CLI would record 4K frames of a 1080p layout.
 */
export const RenderOptionsSchema = z
    .object({
        orientation: z.enum(["landscape", "portrait"]).optional()
            .describe("Video orientation; portrait renders 1080x1920. For portrait, usually also set isFileExplorerVisible, isEditorTabsVisible, isMinimapVisible and isMouseVisible to false."),
        theme: z.enum(["light", "dark"]).optional(),
        withCaptions: z.boolean().optional(),
        fontSizePx: z.number().positive().optional(),
        fileExplorerWidth: z.number().positive().optional(),
        terminalHeight: z.number().positive().optional(),
        mouseColor: z.string().min(1).optional(),
        isFileExplorerVisible: z.boolean().optional(),
        isTerminalVisible: z.boolean().optional(),
        isEditorTabsVisible: z.boolean().optional(),
        isMinimapVisible: z.boolean().optional(),
        isMouseVisible: z.boolean().optional()
            .describe("Draw the mouse cursor. Mouse actions keep their timing and effects when it's hidden."),
        isDiagnosticsVisible: z.boolean().optional()
            .describe("Show TypeScript squiggles (red errors, yellow warnings) for the whole video. editor-show-diagnostics / editor-hide-diagnostics actions switch them for part of a lesson instead."),
        wordWrap: z.enum(["on", "off"]).optional(),
        keyboardTypingPauseMs: z.number().int().positive().optional(),
        standardPauseMs: z.number().int().positive().optional(),
        longPauseMs: z.number().int().positive().optional(),
        defaultLanguage: z.string().min(1).optional(),
        voiceId: z.string().min(1).optional().describe("ElevenLabs voice ID for the narration."),
        ttsProvider: z.enum(["elevenlabs", "kokoro"]).optional(),
        renderMode: z.enum(["realtime", "deterministic"]).optional()
            .describe("realtime (default) records the browser as it plays; deterministic renders frame by frame."),
        renderSeed: z.string().min(1).optional().describe("Deterministic renders only: a seed for reproducible output."),
        renderWorkers: z.number().int().min(1).max(32).optional().describe("Deterministic renders only: browser workers, 1-32."),
    })
    .strict()
    .refine((o) => (o.renderSeed === undefined && o.renderWorkers === undefined) || o.renderMode === "deterministic", {
        message: "renderSeed and renderWorkers need renderMode: \"deterministic\"",
    });

export type RenderOptions = z.infer<typeof RenderOptionsSchema>;

/** The options that become the CLI's -c config file (CodeVideoIDE props). */
export const IDE_PROP_KEYS = [
    "theme",
    "withCaptions",
    "fontSizePx",
    "fileExplorerWidth",
    "terminalHeight",
    "mouseColor",
    "isFileExplorerVisible",
    "isTerminalVisible",
    "isEditorTabsVisible",
    "isMinimapVisible",
    "isMouseVisible",
    "isDiagnosticsVisible",
    "wordWrap",
    "keyboardTypingPauseMs",
    "standardPauseMs",
    "longPauseMs",
    "defaultLanguage",
] as const satisfies readonly (keyof RenderOptions)[];

/**
 * The pauses the CLI's render page plays actions with unless the options say
 * otherwise (codevideo-ide-react example/src/pages/v3.tsx). Estimates use them.
 */
export const RENDER_PAGE_PAUSES = { keyboardTypingPauseMs: 40, standardPauseMs: 200 } as const;

export const estimatePauses = (options: RenderOptions = {}) => ({
    keyboardTypingPauseMs: options.keyboardTypingPauseMs ?? RENDER_PAGE_PAUSES.keyboardTypingPauseMs,
    standardPauseMs: options.standardPauseMs ?? RENDER_PAGE_PAUSES.standardPauseMs,
});
