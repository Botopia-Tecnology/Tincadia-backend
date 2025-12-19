import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class CompleteContactsSyncDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  batchId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  finalCursor?: number;
}




