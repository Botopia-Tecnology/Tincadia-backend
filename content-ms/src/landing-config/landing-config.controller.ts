import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { LandingConfigService } from './landing-config.service';
import { UpdateLandingConfigDto } from './dto/update-landing-config.dto';
import { CreateTestimonialDto, UpdateTestimonialDto } from './dto/testimonial.dto';
import { CreateFaqDto, UpdateFaqDto } from './dto/faq.dto';

@Controller()
export class LandingConfigController {
    constructor(private readonly landingConfigService: LandingConfigService) { }

    // ============ Landing Config Endpoints ============
    @MessagePattern('get_landing_config')
    findAll() {
        return this.landingConfigService.findAll();
    }

    @MessagePattern('get_landing_config_by_key')
    findOne(@Payload() data: { key: string }) {
        return this.landingConfigService.findOne(data.key);
    }

    @MessagePattern('update_landing_config')
    update(@Payload() updateLandingConfigDto: UpdateLandingConfigDto) {
        return this.landingConfigService.update(updateLandingConfigDto);
    }

    @MessagePattern('delete_landing_config')
    delete(@Payload() data: { key: string }) {
        return this.landingConfigService.delete(data.key);
    }

    // ============ Testimonial Endpoints ============
    @MessagePattern('get_testimonials')
    findAllTestimonials() {
        return this.landingConfigService.findAllTestimonials();
    }

    @MessagePattern('get_testimonial')
    findOneTestimonial(@Payload() data: { id: string }) {
        return this.landingConfigService.findOneTestimonial(data.id);
    }

    @MessagePattern('create_testimonial')
    createTestimonial(@Payload() createTestimonialDto: CreateTestimonialDto) {
        return this.landingConfigService.createTestimonial(createTestimonialDto);
    }

    @MessagePattern('update_testimonial')
    updateTestimonial(@Payload() updateTestimonialDto: UpdateTestimonialDto) {
        return this.landingConfigService.updateTestimonial(updateTestimonialDto);
    }

    @MessagePattern('delete_testimonial')
    deleteTestimonial(@Payload() data: { id: string }) {
        return this.landingConfigService.deleteTestimonial(data.id);
    }

    // ============ FAQ Endpoints ============
    @MessagePattern('get_faqs')
    findAllFaqs() {
        return this.landingConfigService.findAllFaqs();
    }

    @MessagePattern('get_faq')
    findOneFaq(@Payload() data: { id: string }) {
        return this.landingConfigService.findOneFaq(data.id);
    }

    @MessagePattern('create_faq')
    createFaq(@Payload() createFaqDto: CreateFaqDto) {
        return this.landingConfigService.createFaq(createFaqDto);
    }

    @MessagePattern('update_faq')
    updateFaq(@Payload() updateFaqDto: UpdateFaqDto) {
        return this.landingConfigService.updateFaq(updateFaqDto);
    }

    @MessagePattern('delete_faq')
    deleteFaq(@Payload() data: { id: string }) {
        return this.landingConfigService.deleteFaq(data.id);
    }
}
