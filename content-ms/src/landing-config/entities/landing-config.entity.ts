import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('landing_page_config')
export class LandingPageConfig {
    @PrimaryColumn()
    key: string;

    @Column()
    value: string;

    @Column({ nullable: true })
    description: string;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
