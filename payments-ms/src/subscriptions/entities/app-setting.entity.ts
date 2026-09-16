import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('app_settings')
export class AppSetting {
    @PrimaryColumn('varchar')
    key: string;

    @Column('jsonb')
    value: any;

    @Column({ type: 'text', nullable: true })
    description: string;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
