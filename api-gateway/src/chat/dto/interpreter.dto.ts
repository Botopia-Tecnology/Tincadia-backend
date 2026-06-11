import { IsString, IsNotEmpty, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteInterpretersDto {
  @ApiProperty({ example: 'sala-123', description: 'Nombre de la sala de llamada' })
  @IsString()
  @IsNotEmpty()
  roomName: string;

  @ApiProperty({ example: 'uuid-456', description: 'ID del usuario que solicita el intérprete' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 'Juan Pérez', description: 'Nombre de usuario que aparece en la invitación' })
  @IsString()
  @IsNotEmpty()
  username: string;
}

export class SetInterpreterStatusDto {
  @ApiProperty({ example: 'uuid-789', description: 'ID del intérprete' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: false, description: 'true si el intérprete está ocupado, false si está disponible' })
  @IsBoolean()
  isBusy: boolean;
}

export class ClaimInterpreterInviteDto {
  @ApiProperty({ example: 'invite-uuid-123', description: 'ID de la invitación a reclamar' })
  @IsString()
  @IsNotEmpty()
  inviteId: string;

  @ApiProperty({ example: 'uuid-789', description: 'ID del intérprete que reclama la invitación' })
  @IsString()
  @IsNotEmpty()
  userId: string;
}
