import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ContactsService } from './contacts.service';
import { StartContactsSyncDto } from './dto/start-contacts-sync.dto';
import { ContactsSyncChunkDto } from './dto/contacts-sync-chunk.dto';
import { CompleteContactsSyncDto } from './dto/complete-contacts-sync.dto';
import { PauseResumeDto } from './dto/pause-resume.dto';

@Controller()
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @MessagePattern('contacts_sync_get_state')
  getState(@Payload() data: { userId: string }) {
    return this.contactsService.getState(data.userId);
  }

  @MessagePattern('contacts_sync_start')
  start(@Payload() data: StartContactsSyncDto) {
    return this.contactsService.start(data);
  }

  @MessagePattern('contacts_sync_chunk')
  chunk(@Payload() data: ContactsSyncChunkDto) {
    return this.contactsService.processChunk(data);
  }

  @MessagePattern('contacts_sync_complete')
  complete(@Payload() data: CompleteContactsSyncDto) {
    return this.contactsService.complete(data);
  }

  @MessagePattern('contacts_sync_pause')
  pause(@Payload() data: PauseResumeDto) {
    return this.contactsService.pause(data);
  }

  @MessagePattern('contacts_sync_resume')
  resume(@Payload() data: PauseResumeDto) {
    return this.contactsService.resume(data);
  }
}




