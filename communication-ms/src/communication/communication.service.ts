import { Injectable } from '@nestjs/common';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@Injectable()
export class CommunicationService {
  send(data: SendMessageDto) {
    return { message: 'Send message', data };
  }

  findAll() {
    return { message: 'Find all messages', data: [] };
  }

  findOne(id: string) {
    return { message: 'Find one message', id };
  }

  update(id: string, data: UpdateMessageDto) {
    return { message: 'Update message', id, data };
  }

  remove(id: string) {
    return { message: 'Delete message', id };
  }
}

