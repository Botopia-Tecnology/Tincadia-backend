import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('profiles')
export class Profile {
    @PrimaryColumn('uuid')
    id: string;

    @Column({ name: 'document_number', nullable: true })
    documentNumber: string;

    @Column({ nullable: true })
    phone: string;

    @Column({ name: 'first_name', nullable: true })
    firstName: string;

    @Column({ name: 'last_name', nullable: true })
    lastName: string;
}
