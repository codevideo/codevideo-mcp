import { ICourse, ILesson } from "@fullstackcraftllc/codevideo-types"

export const addLessonToCourse = (course: ICourse, id: string, name: string, description: string): string => {
    const lesson: ILesson = {
        id,
        name,
        description,
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
    };

    // Add the lesson to the course
    course.lessons.push(lesson);

    // Return the updated course object
    return JSON.stringify(course, null, 2);
}