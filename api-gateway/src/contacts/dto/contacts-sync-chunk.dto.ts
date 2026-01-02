import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ArrayMaxSize } from 'class-validator';

export class ContactsSyncChunkDto {
  @IsUUID()
  batchId: string;

  @IsInt()
  @Min(0)
  chunkIndex: number;

  @IsArray()
  @IsString({ each: true })
  // límite defensivo; el MS también valida con el chunkSize configurado
  @ArrayMaxSize(500)
  contacts: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  cursorAfterChunk?: number;
}











