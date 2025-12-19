import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('contact_sync_chunk_results')
@Index(['userId', 'batchId', 'chunkIndex'], { unique: true })
export class ContactSyncChunkResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'batch_id' })
  batchId: string;

  @Column({ type: 'int', name: 'chunk_index' })
  chunkIndex: number;

  @Column({ type: 'jsonb' })
  response: any;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}




