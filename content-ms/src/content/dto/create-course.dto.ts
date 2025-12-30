export class CreateCourseDto {
    title: string;
    description: string;
    thumbnailUrl?: string; // Optional initially
    categoryId: string;
}
