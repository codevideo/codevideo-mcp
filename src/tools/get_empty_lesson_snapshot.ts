import { ICourseSnapshot } from "@fullstackcraftllc/codevideo-types"

export const getEmptyLessonSnapshot = (): string => {
    const snapshot: ICourseSnapshot = {
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
            fileStructure: {
            },
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
    }

    // return the snapshot as a string
    return JSON.stringify(snapshot, null, 2);
}