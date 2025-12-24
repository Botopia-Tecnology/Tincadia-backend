import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

// Note: DocumentType is not used in contacts-ms, but the column exists in DB
// We define it as a simple number to avoid schema conflicts

@Entity('profiles')
export class Profile {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'first_name', length: 100, nullable: true })
  firstName: string;

  @Column({ name: 'last_name', length: 100, nullable: true })
  lastName: string;

  @Column({ name: 'document_type_id', nullable: true })
  documentTypeId: number;

  @Column({ name: 'document_number', length: 20, nullable: true })
  documentNumber: string;

  @Column({ length: 30, unique: true, nullable: true })
  phone: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
