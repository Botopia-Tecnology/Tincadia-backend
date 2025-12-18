import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Form } from './form.entity';
import { Profile } from './profile.entity';

@Entity('form_submissions')
export class FormSubmission {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'form_id' })
    formId: string;

    @ManyToOne(() => Form)
    @JoinColumn({ name: 'form_id' })
    form: Form;

    @Column('jsonb', { default: {} })
    data: Record<string, any>;

    // Explicit columns for critical search/linking fields
    @Column({ name: 'document_number', nullable: true })
    documentNumber: string;

    @Column({ nullable: true })
    email: string;

    @Column({ nullable: true })
    phone: string;

    @Column({ name: 'full_name', nullable: true })
    fullName: string;

    @Column({ name: 'submitted_by', nullable: true })
    submittedBy: string;

    @Column({ name: 'profile_id', nullable: true })
    profileId: string;

    @ManyToOne(() => Profile, { nullable: true })
    @JoinColumn({ name: 'profile_id' })
    profile: Profile;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
