import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class StartContactsSyncDto {
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









