import { ILesson } from "@fullstackcraftllc/codevideo-types";
import { buildFileStructureFromRootFolder } from "@fullstackcraftllc/codevideo-adapters";

export const getInitialLessonStateFromLocalCodebase = async (repoLocation: string): Promise<string> => {
    // build file structure from files and content from the file system adapter
    const fileStructure = await buildFileStructureFromRootFolder(repoLocation);

    // build the project using the file structure
    const project: ILesson = {
        id: "",
        name: "",
        description: "",
        actions: [],
        initialSnapshot: {
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
                fileStructure,
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
    };

    // return the project as a string
    return JSON.stringify(project);
}