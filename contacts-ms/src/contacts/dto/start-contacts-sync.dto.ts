import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class StartContactsSyncDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsIn(['full', 'delta'])
  syncMode: 'full' | 'delta';

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedTotal?: number;
}










