import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FormsService } from './forms.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { FormSubmissionDto } from './dto/form-submission.dto';

@Controller()
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @MessagePattern('create_form')
  create(@Payload() data: CreateFormDto) {
    return this.formsService.create(data);
  }

  @MessagePattern('find_all_forms')
  findAll() {
    return this.formsService.findAll();
  }

  @MessagePattern('find_one_form')
  findOne(@Payload() data: { id: string }) {
    return this.formsService.findOne(data.id);
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
  submit(@Payload() data: FormSubmissionDto) {
    return this.formsService.submit(data);
  }
}

