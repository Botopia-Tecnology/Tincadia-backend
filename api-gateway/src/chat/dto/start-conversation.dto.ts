import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartConversationDto {
    @ApiProperty({ description: 'ID del usuario actual' })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({ description: 'ID del otro usuario' })
    @IsString()
    @IsNotEmpty()
    otherUserId: string;
}
