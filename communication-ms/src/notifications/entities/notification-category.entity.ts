import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('notification_categories')
export class NotificationCategory {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    name: string; // Machine name (e.g., 'urgent_alert')

    @Column()
    label: string; // Display name (e.g., 'Aviso Urgente')

    @Column()
    color: string; // UI Color (hex or tailwind class)

    @Column({ default: 'Bell' })
    icon: string; // Icon name (Lucide)

    @Column({ name: 'is_active', default: true })
    isActive: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
