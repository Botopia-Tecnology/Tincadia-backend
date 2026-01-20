import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LandingPageConfig } from './entities/landing-config.entity';
import { Testimonial } from './entities/testimonial.entity';
import { FAQ } from './entities/faq.entity';
import { UpdateLandingConfigDto } from './dto/update-landing-config.dto';
import { CreateTestimonialDto, UpdateTestimonialDto } from './dto/testimonial.dto';
import { CreateFaqDto, UpdateFaqDto } from './dto/faq.dto';

@Injectable()
export class LandingConfigService {
    constructor(
        @InjectRepository(LandingPageConfig)
        private readonly landingConfigRepository: Repository<LandingPageConfig>,
        @InjectRepository(Testimonial)
        private readonly testimonialRepository: Repository<Testimonial>,
        @InjectRepository(FAQ)
        private readonly faqRepository: Repository<FAQ>,
    ) { }

    // ============ Landing Config Methods ============
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

        let config = await this.landingConfigRepository.findOne({ where: { key } });

        if (config) {
            config.value = value;
            if (description) config.description = description;
        } else {
            config = this.landingConfigRepository.create({
                key,
                value,
                description
            });
        }

        return this.landingConfigRepository.save(config);
    }

    async delete(key: string) {
        const config = await this.landingConfigRepository.findOne({ where: { key } });
        if (!config) {
            throw new NotFoundException(`Config with key ${key} not found`);
        }
        await this.landingConfigRepository.remove(config);
        return { deleted: true, key };
    }

    // ============ Testimonial Methods ============
    async findAllTestimonials() {
        return this.testimonialRepository.find({
            order: { order: 'ASC' }
        });
    }

    async findOneTestimonial(id: string) {
        const testimonial = await this.testimonialRepository.findOne({ where: { id } });
        if (!testimonial) {
            throw new NotFoundException(`Testimonial with id ${id} not found`);
        }
        return testimonial;
    }

    async createTestimonial(createTestimonialDto: CreateTestimonialDto) {
        const testimonial = this.testimonialRepository.create(createTestimonialDto);
        return this.testimonialRepository.save(testimonial);
    }

    async updateTestimonial(updateTestimonialDto: UpdateTestimonialDto) {
        const { id, ...updateData } = updateTestimonialDto;
        const testimonial = await this.findOneTestimonial(id);
        Object.assign(testimonial, updateData);
        return this.testimonialRepository.save(testimonial);
    }

    async deleteTestimonial(id: string) {
        const testimonial = await this.findOneTestimonial(id);
        await this.testimonialRepository.remove(testimonial);
        return { deleted: true, id };
    }

    // ============ FAQ Methods ============
    async findAllFaqs() {
        return this.faqRepository.find({
            order: { order: 'ASC' }
        });
    }

    async findOneFaq(id: string) {
        const faq = await this.faqRepository.findOne({ where: { id } });
        if (!faq) {
            throw new NotFoundException(`FAQ with id ${id} not found`);
        }
        return faq;
    }

    async createFaq(createFaqDto: CreateFaqDto) {
        const faq = this.faqRepository.create(createFaqDto);
        return this.faqRepository.save(faq);
    }

    async updateFaq(updateFaqDto: UpdateFaqDto) {
        const { id, ...updateData } = updateFaqDto;
        const faq = await this.findOneFaq(id);
        Object.assign(faq, updateData);
        return this.faqRepository.save(faq);
    }

    async deleteFaq(id: string) {
        const faq = await this.findOneFaq(id);
        await this.faqRepository.remove(faq);
        return { deleted: true, id };
    }
}
