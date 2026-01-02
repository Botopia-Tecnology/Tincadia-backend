import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type ContactSyncStatus = 'idle' | 'syncing' | 'paused' | 'completed' | 'failed';
export type ContactSyncMode = 'full' | 'delta';

@Entity('contact_sync_state')
export class ContactSyncState {
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 20, default: 'idle' })
  status: ContactSyncStatus;

  @Column({ type: 'int', name: 'sync_version', default: 1 })
  syncVersion: number;

  @Column({ type: 'timestamptz', name: 'last_full_sync_at', nullable: true })
  lastFullSyncAt?: Date | null;

  @Column({ type: 'timestamptz', name: 'last_delta_sync_at', nullable: true })
  lastDeltaSyncAt?: Date | null;

  @Column({ type: 'int', nullable: true })
  cursor?: number | null;

  @Column({ type: 'varchar', name: 'device_id', nullable: true })
  deviceId?: string | null;

  @Column({ type: 'uuid', name: 'last_batch_id', nullable: true })
  lastBatchId?: string | null;

  @Column({ type: 'varchar', name: 'last_sync_mode', length: 10, nullable: true })
  lastSyncMode?: ContactSyncMode | null;

  @Column({ type: 'timestamptz', name: 'last_chunk_at', nullable: true })
  lastChunkAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}











