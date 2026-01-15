import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Profile entity for contacts-ms
 * Read-only view of profiles table for contact matching
 */
@Entity('profiles')
export class Profile {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'first_name', nullable: true })
  firstName: string;

  @Column({ name: 'last_name', nullable: true })
  lastName: string;

  @Column({ name: 'document_type_id', nullable: true })
  documentTypeId: number;

  @Column({ name: 'document_number', nullable: true })
  documentNumber: string;

  @Column({ unique: true, nullable: true })
  phone: string;

  @Column({ name: 'push_token', nullable: true })
  pushToken: string;

  @Column({ name: 'read_receipts_enabled', default: true })
  readReceiptsEnabled: boolean;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl: string;

  @Column({ default: 'User' })
  role: string;

  @Column({ name: 'is_busy', default: false })
  isBusy: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp without time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp without time zone' })
  updatedAt: Date;
}
