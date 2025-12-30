import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ContactsSyncChunkDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  batchId: string;

  @IsInt()
  @Min(0)
  chunkIndex: number;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(1000)
  contacts: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  cursorAfterChunk?: number;
}










