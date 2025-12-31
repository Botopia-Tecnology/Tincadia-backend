import { Controller, Get, Post, Put, Delete, Body, Param, UseInterceptors, UploadedFile, HttpException, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FormsService } from './forms.service';
import { CreateFormDto } from './dto/create-form.dto';

@Controller('forms')
export class FormsController {
  constructor(
    @Inject('FORMS_SERVICE') private readonly client: ClientProxy,
    private readonly formsService: FormsService,
  ) { }

  @Post()
  create(@Body() createFormDto: CreateFormDto) {
    return this.client.send('create_form', createFormDto);
  }

  @Get()
  findAll() {
    return this.client.send('find_all_forms', {});
  }

  @Get('submissions')
  async findAllSubmissions() {
    try {
      console.log('📝 [API Gateway] Fetching all submissions');
      const result = await this.client.send('find_all_submissions', {}).toPromise();
      console.log(`✅ [API Gateway] Received ${Array.isArray(result) ? result.length : 'invalid'} submissions`);
      return result;
    } catch (error) {
      console.error('❌ [API Gateway] Error fetching submissions:', error);

      const status = error?.status || error?.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error?.message || 'Internal server error fetching submissions';

      throw new HttpException({
        status,
        message,
        timestamp: new Date().toISOString(),
      }, status);
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.client.send('find_one_form', { id });
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateFormDto: any) {
    return this.client.send('update_form', { id, updateData: updateFormDto });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.client.send('delete_form', { id });
  }

  @Get('type/:type')
  async findByType(@Param('type') type: string) {
    try {
      console.log('📝 [API Gateway] Finding form by type:', type);
      const result = await this.client.send('find_form_by_type', { type }).toPromise();
      console.log('✅ [API Gateway] Form found:', result?.id);
      return result;
    } catch (error: any) {
      console.error('❌ [API Gateway] Error fetching form by type:', error);
      console.error('❌ [API Gateway] Error details:', {
        message: error?.message,
        status: error?.status,
        statusCode: error?.statusCode,
      });

      // Convert RpcException to HttpException
      const status = error?.status || error?.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error?.message || 'Internal server error';

      throw new HttpException(message, status);
    }
  }

  @Post('submit')
  async submit(@Body() submissionDto: any) {
    try {
      console.log('📝 [API Gateway] Received form submission:', {
        formId: submissionDto.formId,
        submittedBy: submissionDto.submittedBy,
        hasData: !!submissionDto.data,
        dataSize: JSON.stringify(submissionDto.data || {}).length,
      });

      // Add timeout to prevent hanging
      const result = await Promise.race([
        this.client.send('submit_form', submissionDto).toPromise(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout after 30s')), 30000)
        ),
      ]) as any;

      console.log('✅ [API Gateway] Form submission successful:', {
        submissionId: result?.submission?.id,
        userStatus: result?.userStatus,
      });

      return result;
    } catch (error) {
      console.error('❌ [API Gateway] Error in form submission:', error);
      console.error('❌ [API Gateway] Error details:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        code: error?.code,
      });
      throw error;
    }
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    // Convert file buffer to base64 for TCP transport
    const fileBase64 = file.buffer.toString('base64');

    return this.client.send('upload_file', {
      fileBase64,
      fileName: file.originalname,
      mimeType: file.mimetype,
    });
  }
}
