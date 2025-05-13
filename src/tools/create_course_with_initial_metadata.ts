import { ICourse } from "@fullstackcraftllc/codevideo-types"

export const createCourseWithInitialMetadata = (id: string, name: string, description: string, primaryLanguage: string): string => {
    const course: ICourse = {
            id,
            name,
            description,
            primaryLanguage,
            lessons: []
    };
    return JSON.stringify(course, null, 2);
}