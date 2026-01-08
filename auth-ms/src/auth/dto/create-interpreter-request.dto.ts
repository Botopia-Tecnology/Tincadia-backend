export class CreateInterpreterRequestDto {
    userId: string;
    first_name: string;
    last_name: string;
    document_type: string;
    document_number: string;
    phone?: string;
    email?: string;
}
