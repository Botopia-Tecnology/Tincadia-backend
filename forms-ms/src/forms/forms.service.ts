import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { FormSubmissionDto } from './dto/form-submission.dto';
import { Form } from './entities/form.entity';
import { FormSubmission } from './entities/form-submission.entity';
import { Profile } from './entities/profile.entity';

@Injectable()
export class FormsService {
  constructor(
    @InjectRepository(Form)
    private readonly formRepository: Repository<Form>,
    @InjectRepository(FormSubmission)
    private readonly submissionRepository: Repository<FormSubmission>,
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
  ) { }

  async create(data: CreateFormDto) {
    const form = this.formRepository.create({
      title: data.title,
      description: data.description,
      type: data.type,
      fields: data.fields,
      userId: data.userId,
    });
    return await this.formRepository.save(form);
  }

  async findAll() {
    return await this.formRepository.find();
  }

  async findOne(id: string) {
    const form = await this.formRepository.findOneBy({ id });
    if (!form) {
      throw new NotFoundException(`Form with ID ${id} not found`);
    }
    return form;
  }

  async findByType(type: string) {
    const form = await this.formRepository.findOneBy({ type });
    if (!form) {
      throw new NotFoundException(`Form with type ${type} not found`);
    }
    return form;
  }

  async update(id: string, data: UpdateFormDto) {
    await this.formRepository.update(id, data as any);
    return this.findOne(id);
  }

  async remove(id: string) {
    const form = await this.findOne(id);
    return await this.formRepository.remove(form);
  }

  async submit(submissionDto: FormSubmissionDto) {
    const { formId, data, submittedBy } = submissionDto;

    // Check if form exists
    const form = await this.findOne(formId);

    // Check if user exists by document number (assuming it's in the data)
    // The field name might vary, we check 'documentNumber' or 'document_number'
    const documentNumber = data['documentNumber'] || data['document_number'];
    let profile: Profile | null = null;
    let userStatus = 'unknown';

    if (documentNumber) {
      profile = await this.profileRepository.findOneBy({ documentNumber });
      if (profile) {
        userStatus = 'registered';
      } else {
        userStatus = 'not_registered';
      }
    }

    const submission = this.submissionRepository.create({
      form,
      data,
      submittedBy,
      profile: profile || undefined, // Handle null vs undefined for TypeORM
      profileId: profile ? profile.id : null,
      // Map common fields from the dynamic data
      documentNumber: data['documentNumber'] || data['document_number'] || data['documentoIdentidad'],
      email: data['email'] || data['correoElectronico'],
      phone: data['phone'] || data['telefono'] || data['telefonoWhatsapp'],
      fullName: data['fullName'] || data['full_name'] || data['nombreCompleto'],
    } as any); // Cast to any to avoid strict DeepPartial mismatches specific to relations

    const savedSubmission = await this.submissionRepository.save(submission);

    return {
      message: 'Form submitted successfully',
      submission: savedSubmission,
      userStatus,
      action: userStatus === 'not_registered' ? 'redirect_to_register' : 'none',
    };
  }
}

