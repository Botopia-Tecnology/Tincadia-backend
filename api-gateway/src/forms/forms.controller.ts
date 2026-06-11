import { Controller, Get, Post, Put, Delete, Body, Param, UseInterceptors, UploadedFile, HttpException, HttpStatus, Query } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FormsService } from './forms.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto, SubmitFormDto, UpdateSubmissionDto } from './dto/forms.dto';

@ApiTags('Forms')
@ApiBearerAuth()
@Controller('forms')
export class FormsController {
  constructor(
    @Inject('FORMS_SERVICE') private readonly client: ClientProxy,
    private readonly formsService: FormsService,
  ) { }

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo formulario' })
  @ApiResponse({ status: 201, description: 'Formulario creado exitosamente' })
  create(@Body() createFormDto: CreateFormDto) {
    return this.client.send('create_form', createFormDto) ;
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los formularios' })
  @ApiResponse({ status: 200, description: 'Lista de formularios' })
  findAll() {
    return this.client.send('find_all_forms', {});
  }

  @Get('submissions')
  @ApiOperation({ summary: 'Obtener todas las respuestas de formularios' })
  @ApiResponse({ status: 200, description: 'Lista de respuestas' })
  async findAllSubmissions() {
    try {
      return await this.client.send('find_all_submissions', {}).toPromise();
    } catch (error) {
      const status = error?.status || error?.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error?.message || 'Error interno al obtener las respuestas';
      throw new HttpException({ status, message, timestamp: new Date().toISOString() }, status);
    }
  }

  @Get('my-applications')
  @ApiOperation({ summary: 'Obtener mis solicitudes (respuestas de formularios)' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'email', required: false })
  @ApiQuery({ name: 'documentNumber', required: false })
  @ApiResponse({ status: 200, description: 'Lista de solicitudes del usuario' })
  async findMyApplications(
    @Query('userId') userId?: string,
    @Query('email') email?: string,
    @Query('documentNumber') documentNumber?: string
  ) {
    try {
      if (!userId && !email && !documentNumber) {
        throw new HttpException('Se requiere al menos uno de los siguientes: userId, email o documentNumber', HttpStatus.BAD_REQUEST);
      }
      return await this.client.send('find_submissions_by_user', { userId, email, documentNumber }).toPromise();
    } catch (error) {
      const status = error?.status || error?.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error?.message || 'Error interno al obtener las solicitudes del usuario';
      throw new HttpException({ status, message }, status);
    }
  }

  @Delete('submissions/:id')
  @ApiOperation({ summary: 'Eliminar una respuesta de formulario' })
  @ApiParam({ name: 'id', description: 'ID de la respuesta' })
  @ApiResponse({ status: 200, description: 'Respuesta eliminada' })
  async deleteSubmission(@Param('id') id: string) {
    try {
      return await this.client.send('delete_submission', { id }).toPromise();
    } catch (error) {
      const status = error?.status || error?.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error?.message || 'Error interno al eliminar la respuesta';
      throw new HttpException({ status, message }, status);
    }
  }

  @Put('submissions/:id')
  @ApiOperation({ summary: 'Actualizar una respuesta de formulario' })
  @ApiParam({ name: 'id', description: 'ID de la respuesta' })
  @ApiResponse({ status: 200, description: 'Respuesta actualizada' })
  async updateSubmission(@Param('id') id: string, @Body() dto: UpdateSubmissionDto) {
    try {
      return await this.client.send('update_submission', { id, updateData: dto.updateData }).toPromise();
    } catch (error) {
      const status = error?.status || error?.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error?.message || 'Error interno al actualizar la respuesta';
      throw new HttpException({ status, message }, status);
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un formulario por ID' })
  @ApiParam({ name: 'id', description: 'ID del formulario' })
  @ApiResponse({ status: 200, description: 'Detalle del formulario' })
  findOne(@Param('id') id: string) {
    return this.client.send('find_one_form', { id });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un formulario' })
  @ApiParam({ name: 'id', description: 'ID del formulario' })
  @ApiResponse({ status: 200, description: 'Formulario actualizado' })
  update(@Param('id') id: string, @Body() updateFormDto: UpdateFormDto) {
    return this.client.send('update_form', { id, updateData: updateFormDto });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un formulario' })
  @ApiParam({ name: 'id', description: 'ID del formulario' })
  @ApiResponse({ status: 200, description: 'Formulario eliminado' })
  remove(@Param('id') id: string) {
    return this.client.send('delete_form', { id });
  }

  @Get('type/:type')
  @ApiOperation({ summary: 'Obtener un formulario por su código de tipo' })
  @ApiParam({ name: 'type', description: 'Código del tipo (ej: voluntariado, interprete)' })
  @ApiResponse({ status: 200, description: 'Formulario encontrado' })
  async findByType(@Param('type') type: string) {
    try {
      return await this.client.send('find_form_by_type', { type }).toPromise();
    } catch (error: any) {
      const status = error?.status || error?.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error?.message || 'Error interno al buscar el formulario';
      throw new HttpException(message, status);
    }
  }

  @Post('submit')
  @ApiOperation({ summary: 'Enviar respuesta de un formulario' })
  @ApiResponse({ status: 201, description: 'Respuesta enviada exitosamente' })
  async submit(@Body() submissionDto: SubmitFormDto) {
    try {
      return await Promise.race([
        this.client.send('submit_form', submissionDto).toPromise(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Tiempo de espera agotado (30s)')), 30000)
        ),
      ]) as any;
    } catch (error) {
      throw error;
    }
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir un archivo adjunto para un formulario' })
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('No se subió ningún archivo', HttpStatus.BAD_REQUEST);
    }

    const fileBase64 = file.buffer.toString('base64');

    return this.client.send('upload_file', {
      fileBase64,
      fileName: file.originalname,
      mimeType: file.mimetype,
    });
  }
}
