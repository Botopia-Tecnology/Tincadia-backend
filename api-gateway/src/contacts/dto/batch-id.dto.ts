import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BatchIdDto {
    @ApiProperty({ example: 'batch-uuid-123', description: 'ID del lote de sincronización' })
    @IsString()
    @IsNotEmpty()
    batchId: string;
}
