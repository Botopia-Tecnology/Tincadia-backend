import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('communication')
export class CommunicationController {
  constructor(
    @Inject('COMMUNICATION_SERVICE') private readonly client: ClientProxy,
    private readonly communicationService: CommunicationService,
  ) {}

  @Post('send')
  send(@Body() sendDto: SendMessageDto) {
    return this.client.send('send_message', sendDto);
  }

  @Get()
  findAll() {
    return this.client.send('find_all_messages', {});
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.client.send('find_one_message', { id });
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateDto: any) {
    return this.client.send('update_message', { id, updateData: updateDto });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.client.send('delete_message', { id });
  }
}

