import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CommunicationService } from './communication.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@Controller()
export class CommunicationController {
  constructor(private readonly communicationService: CommunicationService) {}

  @MessagePattern('send_message')
  send(@Payload() data: SendMessageDto) {
    return this.communicationService.send(data);
  }

  @MessagePattern('find_all_messages')
  findAll() {
    return this.communicationService.findAll();
  }

  @MessagePattern('find_one_message')
  findOne(@Payload() data: { id: string }) {
    return this.communicationService.findOne(data.id);
  }

  @MessagePattern('update_message')
  update(@Payload() data: { id: string; updateData: UpdateMessageDto }) {
    return this.communicationService.update(data.id, data.updateData);
  }

  @MessagePattern('delete_message')
  remove(@Payload() data: { id: string }) {
    return this.communicationService.remove(data.id);
  }
}

