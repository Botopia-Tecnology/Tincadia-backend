export class RemoveParticipantDto {
    conversationId: string;
    adminId: string;
    userIdToRemove: string;
}

export class PromoteToAdminDto {
    conversationId: string;
    adminId: string;
    userIdToPromote: string;
}

export class LeaveGroupDto {
    conversationId: string;
    userId: string;
}

export class UpdateGroupDto {
    conversationId: string;
    adminId: string;
    title?: string;
    imageUrl?: string;
    description?: string;
}
