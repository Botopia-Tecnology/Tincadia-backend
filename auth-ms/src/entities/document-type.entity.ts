import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('document_types')
export class DocumentType {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 50 })
    name: string;
}
