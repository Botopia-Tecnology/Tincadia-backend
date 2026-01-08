import { ApiProperty } from '@nestjs/swagger';

export class RemoveParticipantDto {
    @ApiProperty()
    conversationId: string;

    @ApiProperty()
    adminId: string;

    @ApiProperty()
    userIdToRemove: string;
}

export class PromoteToAdminDto {
    @ApiProperty()
    conversationId: string;

    @ApiProperty()
    adminId: string;

    @ApiProperty()
    userIdToPromote: string;
}

export class LeaveGroupDto {
    @ApiProperty()
    conversationId: string;

    @ApiProperty()
    userId: string;
}

export class UpdateGroupDto {
    @ApiProperty()
    conversationId: string;

    @ApiProperty()
    adminId: string;

    @ApiProperty({ required: false })
    title?: string;

    @ApiProperty({ required: false })
    imageUrl?: string;

    @ApiProperty({ required: false })
    description?: string;
}
