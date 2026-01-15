import {
    Entity,
    PrimaryColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { DocumentType } from './document-type.entity';

@Entity('profiles')
export class Profile {
    @PrimaryColumn('uuid')
    id: string;

    @Column({ name: 'first_name', length: 100, nullable: true })
    firstName: string;

    @Column({ name: 'last_name', length: 100, nullable: true })
    lastName: string;

    @ManyToOne(() => DocumentType)
    @JoinColumn({ name: 'document_type_id' })
    documentType: DocumentType;

    @Column({ name: 'document_type_id', nullable: true })
    documentTypeId: number;

    @Column({ name: 'document_number', length: 20, nullable: true })
    documentNumber: string;

    @Column({ length: 30, unique: true, nullable: true })
    phone: string;

    @Column({ name: 'push_token', length: 255, nullable: true })
    pushToken: string;

    @Column({ name: 'read_receipts_enabled', default: true })
    readReceiptsEnabled: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @Column({ type: 'text', name: 'avatar_url', nullable: true })
    avatarUrl: string | null;

    @Column({ default: 'User', length: 50 })
    role: string;

    @Column({ name: 'is_busy', default: false })
    isBusy: boolean;
}
