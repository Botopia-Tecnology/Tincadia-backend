import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { CommunicationService } from './communication.service';
import { SendMessageDto, UpdateMessageDto } from './dto/send-message.dto';
import { CreateAppNotificationDto, UpdateAppNotificationDto, CreateNotificationCategoryDto, UpdateNotificationCategoryDto, PushTestDto, MarkReadBodyDto } from './dto/app-notification.dto';

@ApiTags('Communication')
@ApiBearerAuth()
@Controller('communication')
export class CommunicationController {
  constructor(
    @Inject('COMMUNICATION_SERVICE') private readonly client: ClientProxy,
    private readonly communicationService: CommunicationService,
  ) { }

  @Post('send')
  @ApiOperation({ summary: 'Enviar un mensaje (Email, SMS, Push, In-App)' })
  @ApiResponse({ status: 201, description: 'Mensaje enviado correctamente' })
  send(@Body() sendDto: SendMessageDto) {
    return this.client.send('send_message', sendDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener historial de mensajes enviados' })
  @ApiResponse({ status: 200, description: 'Lista de mensajes' })
  findAll() {
    return this.client.send('find_all_messages', {});
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un mensaje específico por ID' })
  @ApiParam({ name: 'id', description: 'ID del mensaje' })
  @ApiResponse({ status: 200, description: 'Detalle del mensaje' })
  findOne(@Param('id') id: string) {
    return this.client.send('find_one_message', { id });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un mensaje' })
  @ApiParam({ name: 'id', description: 'ID del mensaje' })
  @ApiResponse({ status: 200, description: 'Mensaje actualizado' })
  update(@Param('id') id: string, @Body() updateDto: UpdateMessageDto) {
    return this.client.send('update_message', { id, updateData: updateDto });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un mensaje del historial' })
  @ApiParam({ name: 'id', description: 'ID del mensaje' })
  @ApiResponse({ status: 200, description: 'Mensaje eliminado' })
  remove(@Param('id') id: string) {
    return this.client.send('delete_message', { id });
  }
}

// ==================== App Notifications Controller ====================

@ApiTags('App Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class AppNotificationsController {
  constructor(
    @Inject('COMMUNICATION_SERVICE') private readonly client: ClientProxy,
  ) { }

  @Get()
  @ApiOperation({ summary: 'Obtener notificaciones activas' })
  @ApiQuery({ name: 'userId', required: false, description: 'User ID para obtener estado de lectura' })
  @ApiResponse({ status: 200, description: 'Lista de notificaciones activas' })
  getNotifications(@Query('userId') userId?: string) {
    return this.client.send('get_app_notifications', { userId });
  }

  @Get('unread-count/:userId')
  @ApiOperation({ summary: 'Obtener cantidad de notificaciones no leídas' })
  @ApiParam({ name: 'userId', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Cantidad de no leídas', schema: { example: { count: 5 } } })
  getUnreadCount(@Param('userId') userId: string) {
    return this.client.send('get_unread_count', { userId });
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Marcar notificación como leída' })
  @ApiParam({ name: 'id', description: 'ID de la notificación' })
  @ApiResponse({ status: 200, description: 'Marcada como leída' })
  markAsRead(@Param('id') notificationId: string, @Body() body: MarkReadBodyDto) {
    return this.client.send('mark_notification_read', { userId: body.userId, notificationId });
  }

  @Post('mark-all-read/:userId')
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
  @ApiParam({ name: 'userId', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Todas marcadas como leídas' })
  markAllAsRead(@Param('userId') userId: string) {
    return this.client.send('mark_all_notifications_read', { userId });
  }

  // ==================== Admin Endpoints ====================

  @Get('admin/all')
  @ApiOperation({ summary: '[Admin] Obtener todas las notificaciones' })
  @ApiResponse({ status: 200, description: 'Lista completa de notificaciones' })
  getAllNotifications() {
    return this.client.send('get_all_app_notifications', {});
  }

  @Post()
  @ApiOperation({ summary: '[Admin] Crear nueva notificación' })
  @ApiResponse({ status: 201, description: 'Notificación creada' })
  createNotification(@Body() dto: CreateAppNotificationDto) {
    return this.client.send('create_app_notification', dto);
  }

  @Put(':id')
  @ApiOperation({ summary: '[Admin] Actualizar notificación' })
  @ApiParam({ name: 'id', description: 'ID de la notificación' })
  @ApiResponse({ status: 200, description: 'Notificación actualizada' })
  updateNotification(@Param('id') id: string, @Body() dto: UpdateAppNotificationDto) {
    return this.client.send('update_app_notification', { id, dto });
  }

  @Delete(':id')
  @ApiOperation({ summary: '[Admin] Eliminar notificación' })
  @ApiParam({ name: 'id', description: 'ID de la notificación' })
  @ApiResponse({ status: 200, description: 'Notificación eliminada' })
  deleteNotification(@Param('id') id: string) {
    return this.client.send('delete_app_notification', { id });
  }

  // ==================== Categories ====================

  @Get('categories/all')
  @ApiOperation({ summary: 'Obtener todas las categorías de notificación' })
  @ApiResponse({ status: 200, description: 'Lista de categorías' })
  getCategories() {
    return this.client.send('get_notification_categories', {});
  }

  @Post('categories')
  @ApiOperation({ summary: '[Admin] Crear categoría de notificación' })
  @ApiResponse({ status: 201, description: 'Categoría creada' })
  createCategory(@Body() dto: CreateNotificationCategoryDto) {
    return this.client.send('create_notification_category', dto);
  }

  @Put('categories/:id')
  @ApiOperation({ summary: '[Admin] Actualizar categoría' })
  @ApiParam({ name: 'id', description: 'ID de la categoría' })
  @ApiResponse({ status: 200, description: 'Categoría actualizada' })
  updateCategory(@Param('id') id: string, @Body() dto: UpdateNotificationCategoryDto) {
    return this.client.send('update_notification_category', { id, dto });
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: '[Admin] Eliminar categoría' })
  @ApiParam({ name: 'id', description: 'ID de la categoría' })
  @ApiResponse({ status: 200, description: 'Categoría eliminada' })
  deleteCategory(@Param('id') id: string) {
    return this.client.send('delete_notification_category', { id });
  }

  // ==================== Push Notification Test ====================

  @Post('push-test')
  @ApiOperation({ summary: 'Enviar notificación push de prueba' })
  @ApiResponse({ status: 200, description: 'Notificación enviada' })
  sendPushTest(@Body() body: PushTestDto) {
    return this.client.send('send_push_notification', {
      to: body.token,
      title: 'Prueba Tincadia',
      body: 'Esta es una notificación de prueba desde tu perfil 🚀',
      data: { type: 'test' }
    });
  }
}
