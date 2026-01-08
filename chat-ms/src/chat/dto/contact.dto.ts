import { IsString, IsOptional, IsUUID, IsNotEmpty, IsDateString } from 'class-validator';

export class AddContactDto {
    @IsUUID()
    @IsNotEmpty()
    ownerId: string;

    @IsString()
    @IsNotEmpty()
    phone: string;

    @IsString()
    @IsOptional()
    alias?: string;

    @IsString()
    @IsOptional()
    customFirstName?: string;

    @IsString()
    @IsOptional()
    customLastName?: string;
}

export class UpdateContactDto {
    @IsUUID()
    @IsNotEmpty()
    ownerId: string;

    @IsUUID()
    @IsNotEmpty()
    contactId: string;

    @IsString()
    @IsOptional()
    alias?: string;

    @IsString()
    @IsOptional()
    customFirstName?: string;

    @IsString()
    @IsOptional()
    customLastName?: string;
}

export class DeleteContactDto {
    @IsUUID()
    @IsNotEmpty()
    ownerId: string;

    @IsUUID()
    @IsNotEmpty()
    contactId: string;
}

export class GetContactsDto {
    @IsUUID()
    @IsNotEmpty()
    ownerId: string;

    @IsDateString()
    @IsOptional()
    since?: string;
}
