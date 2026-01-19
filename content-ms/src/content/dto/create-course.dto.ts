export class CreateCourseDto {
    title: string;
    description: string;
    thumbnailUrl?: string; // Optional initially
    categoryId: string;
    accessScope?: 'course' | 'module' | 'lesson';
    isPaid?: boolean;
    previewLimit?: number | null;
    priceInCents?: number;
}
