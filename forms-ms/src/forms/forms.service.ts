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

  async findAllSubmissions() {
    // Optimization: Fetch only necessary fields for the dashboard list
    // Crucial: EXCLUDE the 'data' column which contains heavy JSON
    return await this.submissionRepository.find({
      select: {
        id: true,
        formId: true,
        profileId: true,
        submittedBy: true,
        documentNumber: true,
        email: true,
        phone: true,
        fullName: true,
        createdAt: true,
        data: true,
        // If userStatus isn't in entity, I should confirm. In 'submit' method I saw 'userStatus' returned but it was calculated.

        form: {
          id: true,
          title: true,
          type: true
        }
      },
      relations: {
        form: true
      },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteSubmission(id: string) {
    const submission = await this.submissionRepository.findOneBy({ id });
    if (!submission) {
      throw new Error(`Submission with ID ${id} not found`);
    }
    return await this.submissionRepository.remove(submission);
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
    try {
      console.log('📝 [Forms Service] Submit method called');
      const { formId, data, submittedBy } = submissionDto;

      console.log('📝 [Forms Service] Submitting form:', { formId, submittedBy, dataKeys: Object.keys(data) });

      // Check if form exists
      const form = await this.findOne(formId);
      console.log('✅ Form found:', form.id, form.type);

      // Check if user exists by document number (assuming it's in the data)
      const documentNumber = data['documentNumber'] || data['document_number'] || data['documentoIdentidad'];
      let profile: Profile | null = null;
      let userStatus = 'unknown';

      if (documentNumber) {
        console.log('🔍 Looking for profile with documentNumber:', documentNumber);
        try {
          profile = await this.profileRepository.findOneBy({ documentNumber });
          if (profile) {
            userStatus = 'registered';
            console.log('✅ Profile found:', profile.id);
          } else {
            userStatus = 'not_registered';
            console.log('ℹ️ Profile not found for this document');
          }
        } catch (profileError) {
          console.error('❌ Error finding profile:', profileError);
          // Continue without profile
        }
      }

      console.log('📦 Creating submission object...');

      // Create submission using direct field assignment to avoid TypeORM relation issues
      const submissionData: any = {
        formId: form.id,
        data,
        submittedBy: submittedBy || undefined,
        profileId: profile ? profile.id : undefined,
        documentNumber: documentNumber || undefined,
        email: data['email'] || data['correoElectronico'] || undefined,
        phone: data['phone'] || data['telefono'] || data['telefonoWhatsapp'] || undefined,
        fullName: data['fullName'] || data['full_name'] || data['nombreCompleto'] || undefined,
      };

      // Remove undefined values
      Object.keys(submissionData).forEach(key => {
        if (submissionData[key] === undefined) {
          delete submissionData[key];
        }
      });

      const submission = this.submissionRepository.create(submissionData);

      // TypeORM create can return array or single object, ensure we have a single object
      const submissionObj = Array.isArray(submission) ? submission[0] : submission;

      console.log('📦 Submission created:', {
        formId: (submissionObj as any).formId,
        profileId: (submissionObj as any).profileId,
        submittedBy: (submissionObj as any).submittedBy,
        hasData: !!(submissionObj as any).data,
      });

      console.log('💾 Saving submission...');
      let savedSubmission;
      try {
        savedSubmission = await this.submissionRepository.save(submissionObj);
        console.log('✅ Submission saved:', savedSubmission.id);
      } catch (saveError) {
        console.error('❌ Error saving submission:', saveError);
        console.error('❌ Save error details:', {
          message: saveError?.message,
          code: saveError?.code,
          detail: saveError?.detail,
          constraint: saveError?.constraint,
          stack: saveError?.stack,
        });
        throw saveError;
      }

      // Return a clean response without circular references
      const response = {
        message: 'Form submitted successfully',
        submission: {
          id: savedSubmission.id,
          formId: savedSubmission.formId,
          profileId: (savedSubmission as any).profileId || null,
          submittedBy: savedSubmission.submittedBy,
          documentNumber: savedSubmission.documentNumber,
          email: savedSubmission.email,
          phone: savedSubmission.phone,
          fullName: savedSubmission.fullName,
          createdAt: savedSubmission.createdAt,
        },
        userStatus,
        action: userStatus === 'not_registered' ? 'redirect_to_register' : 'none',
      };

      console.log('✅ Returning response:', {
        submissionId: response.submission.id,
        userStatus: response.userStatus
      });

      return response;
    } catch (error) {
      console.error('❌ Error in submit method:', error);
      console.error('❌ Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      });
      throw error;
    }
  }

  async findByUser(userId?: string, email?: string, documentNumber?: string) {
    console.log('🔍 [Forms Service] Finding submissions for:', { userId, email, documentNumber });

    const conditions: any[] = [];
    if (userId) conditions.push({ submittedBy: userId });
    if (email) conditions.push({ email });
    if (documentNumber) conditions.push({ documentNumber });

    if (conditions.length === 0) {
      return [];
    }

    return await this.submissionRepository.find({
      where: conditions,
      relations: { form: true },
      order: { createdAt: 'DESC' },
    });
  }
  async updateSubmission(id: string, updateData: any) {
    console.log('📝 [Forms Service] updateSubmission called');
    console.log('📝 [Forms Service] Submission ID:', id);
    console.log('📝 [Forms Service] Update data received:', JSON.stringify(updateData, null, 2));

    const submission = await this.submissionRepository.findOneBy({ id });
    if (!submission) {
      console.error('❌ [Forms Service] Submission not found:', id);
      throw new NotFoundException(`Submission with ID ${id} not found`);
    }

    console.log('📝 [Forms Service] Existing submission data keys:', Object.keys(submission.data || {}));

    // Merge data - we want to update top-level fields in the JSONB column
    if (updateData.data) {
      console.log('📝 [Forms Service] New data keys:', Object.keys(updateData.data));

      submission.data = {
        ...submission.data,
        ...updateData.data
      };

      console.log('📝 [Forms Service] Merged data keys:', Object.keys(submission.data));

      // Also update flat columns if they are present in the new data
      const data = submission.data;
      if (data['email'] || data['correoElectronico']) submission.email = data['email'] || data['correoElectronico'];
      if (data['phone'] || data['telefono'] || data['telefonoWhatsapp']) submission.phone = data['phone'] || data['telefono'] || data['telefonoWhatsapp'];
      if (data['fullName'] || data['nombreCompleto']) submission.fullName = data['fullName'] || data['nombreCompleto'];
      if (data['documentNumber'] || data['documentoIdentidad']) submission.documentNumber = data['documentNumber'] || data['documentoIdentidad'];
    } else {
      console.warn('⚠️ [Forms Service] updateData.data is undefined or null! No changes will be made.');
    }

    console.log('💾 [Forms Service] Saving submission...');
    const saved = await this.submissionRepository.save(submission);
    console.log('✅ [Forms Service] Submission saved successfully. ID:', saved.id);

    return saved;
  }
}
