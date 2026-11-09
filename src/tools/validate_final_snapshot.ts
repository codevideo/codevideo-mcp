import type { ILesson } from '@fullstackcraftllc/codevideo-types';
import { verifyLesson, LessonVerification } from './verifyLesson';
/** Replay, verify saved end-state files, and report explicit compiler outcomes. */
export const validateFinalCodeOfLesson = (lesson: ILesson): Promise<LessonVerification> => verifyLesson(lesson);
