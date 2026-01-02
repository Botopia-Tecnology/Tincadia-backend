import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { FormsService } from './forms.service';
import { UploadService } from './upload.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { FormSubmissionDto } from './dto/form-submission.dto';

@Controller()
export class FormsController {
  constructor(
    private readonly formsService: FormsService,
    private readonly uploadService: UploadService,
  ) { }

  @MessagePattern('create_form')
  create(@Payload() data: CreateFormDto) {
    return this.formsService.create(data);
  }

  @MessagePattern('find_all_forms')
  findAll() {
    return this.formsService.findAll();
  }

  @MessagePattern('find_all_submissions')
  async findAllSubmissions() {
    try {
      console.log('📥 [Forms MS] find_all_submissions handler called');
      const submissions = await this.formsService.findAllSubmissions();
      console.log(`✅ [Forms MS] Found ${submissions?.length || 0} submissions`);
      return submissions;
    } catch (error) {
      console.error('❌ [Forms MS] Error in findAllSubmissions:', error);
      console.error('❌ [Forms MS] Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      });

      throw new RpcException({
        status: 500,
        message: error?.message || 'Failed to fetch submissions',
        error: error?.name || 'InternalServerError',
      });
    }
  }

  @MessagePattern('find_one_form')
  findOne(@Payload() data: { id: string }) {
    return this.formsService.findOne(data.id);
  }

  @MessagePattern('find_form_by_type')
  async findByType(@Payload() data: { type: string }) {
    try {
      console.log('📥 [Forms MS] find_form_by_type handler called:', data.type);
      const form = await this.formsService.findByType(data.type);
      console.log('✅ [Forms MS] Form found:', form.id, form.type);
      return form;
    } catch (error) {
      console.error('❌ [Forms MS] Error in findByType:', error);
      const errorMessage = error?.message || 'Form not found';
      const errorStatus = error?.status || error?.statusCode || 404;

      throw new RpcException({
        status: errorStatus,
        message: errorMessage,
        error: error?.name || 'NotFoundException',
      });
    }
  }

  @MessagePattern('update_form')
  update(@Payload() data: { id: string; updateData: UpdateFormDto }) {
    return this.formsService.update(data.id, data.updateData);
  }

  @MessagePattern('delete_form')
  remove(@Payload() data: { id: string }) {
    return this.formsService.remove(data.id);
  }

  @MessagePattern('submit_form')
  async submit(@Payload() data: FormSubmissionDto) {
    console.log('📥 [Forms MS] submit_form handler called');

    try {
      console.log('📥 [Forms MS] Received submit_form request:', {
        formId: data?.formId,
        submittedBy: data?.submittedBy,
        hasData: !!data?.data,
        dataType: typeof data,
      });

      if (!data || !data.formId) {
        throw new Error('Invalid submission data: formId is required');
      }

      console.log('📥 [Forms MS] Calling formsService.submit...');
      const result = await this.formsService.submit(data);

      console.log('✅ [Forms MS] Submit completed successfully, returning result');
      return result;
    } catch (error) {
      console.error('❌ [Forms MS] Error in submit controller:', error);
      console.error('❌ [Forms MS] Error type:', typeof error);
      console.error('❌ [Forms MS] Error details:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack?.substring(0, 500), // Limit stack trace
        code: error?.code,
        detail: error?.detail,
        constraint: error?.constraint,
        status: error?.status,
        statusCode: error?.statusCode,
      });

      // Ensure we throw a proper RpcException
      const errorMessage = error?.message || 'Internal server error';
      const errorStatus = error?.status || error?.statusCode || 500;

      const rpcError = new RpcException({
        status: errorStatus,
        message: errorMessage,
        error: error?.name || 'InternalServerError',
      });

      console.error('❌ [Forms MS] Throwing RpcException:', {
        status: errorStatus,
        message: errorMessage,
      });

      throw rpcError;
    }
  }

  @MessagePattern('upload_file')
  async uploadFile(@Payload() data: { fileBase64: string; fileName: string; mimeType: string }) {
    const fileBuffer = Buffer.from(data.fileBase64, 'base64');
    return this.uploadService.uploadFile(fileBuffer, data.fileName, data.mimeType);
  }
}
