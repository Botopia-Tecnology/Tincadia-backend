import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('contact_match_cache')
@Index(['userId', 'contactKey'], { unique: true })
export class ContactMatchCache {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', name: 'contact_key' })
  contactKey: string;

  @Column({ type: 'uuid', name: 'matched_user_id', nullable: true })
  matchedUserId?: string | null;

  @Column({ type: 'bool', default: false })
  matched: boolean;

  @Column({ type: 'timestamptz', name: 'checked_at', nullable: true })
  checkedAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}










