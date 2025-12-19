import { IsUUID } from 'class-validator';

export class PauseResumeDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  batchId: string;
}




