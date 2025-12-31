import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export enum FormType {
    CONTACT = 'contact',
    APPOINTMENT = 'appointment',
    FEEDBACK = 'feedback',
    REGISTRATION = 'registration',
}

@Entity('forms')
export class Form {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @Column('text')
    description: string;

    @Column({
        type: 'varchar',
        enum: FormType
    })
    type: string;

    @Column('jsonb', { default: [] })
    fields: any[];

    @Column({ name: 'user_id' })
    userId: string; // The creator ID

    @CreateDateColumn({ name: 'created_at', type: 'timestamp without time zone' })
    createdAt: Date;

    @Column({ name: 'updated_at', type: 'timestamp without time zone', default: () => 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}
