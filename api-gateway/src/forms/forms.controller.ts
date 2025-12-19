import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
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
  findByType(@Param('type') type: string) {
    return this.client.send('find_form_by_type', { type });
  }

  @Post('submit')
  submit(@Body() submissionDto: any) {
    return this.client.send('submit_form', submissionDto);
  }
}

