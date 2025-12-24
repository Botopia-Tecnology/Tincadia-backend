import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { lastValueFrom } from 'rxjs';
import { StartContactsSyncDto } from './dto/start-contacts-sync.dto';
import { ContactsSyncChunkDto } from './dto/contacts-sync-chunk.dto';
import { CompleteContactsSyncDto } from './dto/complete-contacts-sync.dto';

@ApiTags('Contacts')
@Controller('contacts/sync')
export class ContactsController {
  constructor(
    @Inject('CONTACTS_SERVICE') private readonly contactsClient: ClientProxy,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  private async getUserIdFromAuthHeader(authHeader?: string): Promise<string> {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is required');
    }
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      throw new UnauthorizedException('Token is required');
    }

    const res = await lastValueFrom(this.authClient.send('verify_token', { token }));
    const userId = res?.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return userId;
  }

  @Get('state')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consultar estado de sincronización de contactos' })
  @ApiResponse({ status: 200, description: 'Estado actual de sync' })
  getState(@Headers('authorization') authHeader: string) {
    return (async () => {
      const userId = await this.getUserIdFromAuthHeader(authHeader);
      return lastValueFrom(this.contactsClient.send('contacts_sync_get_state', { userId }));
    })();
  }

  @Post('start')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Iniciar sincronización (full o delta)' })
  @ApiResponse({ status: 200, description: 'Batch iniciado' })
  start(@Headers('authorization') authHeader: string, @Body() dto: StartContactsSyncDto) {
    return (async () => {
      const userId = await this.getUserIdFromAuthHeader(authHeader);
      return lastValueFrom(this.contactsClient.send('contacts_sync_start', { userId, ...dto }));
    })();
  }

  @Post('chunk')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enviar chunk para verificación' })
  @ApiResponse({ status: 200, description: 'Resultado de matching del chunk' })
  chunk(@Headers('authorization') authHeader: string, @Body() dto: ContactsSyncChunkDto) {
    return (async () => {
      const userId = await this.getUserIdFromAuthHeader(authHeader);
      return lastValueFrom(this.contactsClient.send('contacts_sync_chunk', { userId, ...dto }));
    })();
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Finalizar sincronización' })
  @ApiResponse({ status: 200, description: 'Sync completada' })
  complete(@Headers('authorization') authHeader: string, @Body() dto: CompleteContactsSyncDto) {
    return (async () => {
      const userId = await this.getUserIdFromAuthHeader(authHeader);
      return lastValueFrom(this.contactsClient.send('contacts_sync_complete', { userId, ...dto }));
    })();
  }

  @Post('pause')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pausar sincronización' })
  pause(@Headers('authorization') authHeader: string, @Body() body: { batchId: string }) {
    return (async () => {
      const userId = await this.getUserIdFromAuthHeader(authHeader);
      return lastValueFrom(this.contactsClient.send('contacts_sync_pause', { userId, ...body }));
    })();
  }

  @Post('resume')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reanudar sincronización' })
  resume(@Headers('authorization') authHeader: string, @Body() body: { batchId: string }) {
    return (async () => {
      const userId = await this.getUserIdFromAuthHeader(authHeader);
      return lastValueFrom(this.contactsClient.send('contacts_sync_resume', { userId, ...body }));
    })();
  }
}









