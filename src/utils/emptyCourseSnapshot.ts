import { ICourseSnapshot } from "@fullstackcraftllc/codevideo-types";

/**
 * Factory for a fresh, empty CodeVideo course snapshot — the starting state for a
 * lesson that does NOT continue from a previous lesson (i.e. a from-scratch lesson 1).
 *
 * Single source of truth: both `get_empty_lesson_snapshot` and the course store use this
 * so the empty-state shape can never drift between them.
 */
export const emptyCourseSnapshot = (): ICourseSnapshot => ({
    isUnsavedChangesDialogOpen: false,
    unsavedFileName: '',
    fileExplorerSnapshot: {
        isFileExplorerContextMenuOpen: false,
        isFileContextMenuOpen: false,
        isFolderContextMenuOpen: false,
        isNewFileInputVisible: false,
        isNewFolderInputVisible: false,
        isRenameFileInputVisible: false,
        isRenameFolderInputVisible: false,
        newFileInputValue: '',
        newFolderInputValue: '',
        renameFileInputValue: '',
        renameFolderInputValue: '',
        originalFileBeingRenamed: '',
        originalFolderBeingRenamed: '',
        newFileParentPath: '',
        newFolderParentPath: '',
        fileStructure: {},
    },
    editorSnapshot: {
        isEditorContextMenuOpen: false,
        editors: []
    },
    terminalSnapshot: {
        terminals: []
    },
    mouseSnapshot: {
        location: 'editor',
        currentHoveredFileName: '',
        currentHoveredFolderName: '',
        currentHoveredEditorTabFileName: '',
        x: 0,
        y: 0,
        timestamp: 0,
        type: 'move',
        buttonStates: {
            left: false,
            right: false,
            middle: false,
        },
        scrollPosition: {
            x: 0,
            y: 0
        },
    },
    authorSnapshot: {
        authors: [
            { currentSpeechCaption: '' }
        ]
    }
});
