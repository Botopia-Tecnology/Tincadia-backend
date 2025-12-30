import {
    Entity,
    PrimaryColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { DocumentType } from './document-type.entity';

@Entity('profiles')
export class Profile {
    @PrimaryColumn('uuid')
    id: string;

    @Column({ name: 'first_name', nullable: true })
    firstName: string;

    @Column({ name: 'last_name', nullable: true })
    lastName: string;

    @ManyToOne(() => DocumentType, { nullable: true })
    @JoinColumn({ name: 'document_type_id' })
    documentType: DocumentType | null;

    @Column({ name: 'document_type_id', nullable: true })
    documentTypeId: number;

    @Column({ name: 'document_number', nullable: true })
    documentNumber: string;

    @Column({ nullable: true, unique: true })
    phone: string;

    @Column({ name: 'push_token', nullable: true })
    pushToken: string;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp without time zone' })
    createdAt: Date;

    @Column({ name: 'updated_at', type: 'timestamp without time zone', default: () => 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}
