import { Injectable } from '@nestjs/common';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { FormSubmissionDto } from './dto/form-submission.dto';

@Injectable()
export class FormsService {
  create(data: CreateFormDto) {
    return { message: 'Create form', data };
  }

  findAll() {
    return { message: 'Find all forms', data: [] };
  }

  findOne(id: string) {
    return { message: 'Find one form', id };
  }

  update(id: string, data: UpdateFormDto) {
    return { message: 'Update form', id, data };
  }

  remove(id: string) {
    return { message: 'Delete form', id };
  }

  submit(data: FormSubmissionDto) {
    return { message: 'Form submitted', data };
  }
}

