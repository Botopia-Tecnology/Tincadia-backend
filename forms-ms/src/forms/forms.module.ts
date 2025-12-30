import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';
import { UploadService } from './upload.service';
import { Form } from './entities/form.entity';
import { FormSubmission } from './entities/form-submission.entity';
import { Profile } from './entities/profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Form, FormSubmission, Profile]),
  ],
  controllers: [FormsController],
  providers: [FormsService, UploadService],
})
export class FormsModule { }
