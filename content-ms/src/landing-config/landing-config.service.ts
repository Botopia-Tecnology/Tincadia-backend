import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LandingPageConfig } from './entities/landing-config.entity';
import { UpdateLandingConfigDto } from './dto/update-landing-config.dto';

@Injectable()
export class LandingConfigService {
    constructor(
        @InjectRepository(LandingPageConfig)
        private readonly landingConfigRepository: Repository<LandingPageConfig>,
    ) { }

    async findAll() {
        return this.landingConfigRepository.find({
            order: { key: 'ASC' }
        });
    }

    async findOne(key: string) {
        const config = await this.landingConfigRepository.findOne({ where: { key } });
        if (!config) {
            throw new NotFoundException(`Config with key ${key} not found`);
        }
        return config;
    }

    async update(updateLandingConfigDto: UpdateLandingConfigDto) {
        const { key, value, description } = updateLandingConfigDto;

        // Check if exists
        let config = await this.landingConfigRepository.findOne({ where: { key } });

        if (config) {
            config.value = value;
            if (description) config.description = description;
        } else {
            // Create new if not exists (upsert-like behavior for admin convenience)
            config = this.landingConfigRepository.create({
                key,
                value,
                description
            });
        }

        return this.landingConfigRepository.save(config);
    }
}
