import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PaymentsModule } from './payments/payments.module';
import { FormsModule } from './forms/forms.module';
import { CommunicationModule } from './communication/communication.module';
import { ChatModule } from './chat/chat.module';
import { ContactsModule } from './contacts/contacts.module';
import { CallsModule } from './calls/calls.module';
import { ContentModule } from './content/content.module';
import { EmergencyModule } from './emergency/emergency.module';
import { ModelModule } from './Model-ms/model.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: process.env.THROTTLE_LIMIT ? parseInt(process.env.THROTTLE_LIMIT, 10) : 1000,
    }]),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
    AuthModule,
    PaymentsModule,
    FormsModule,
    CommunicationModule,
    ChatModule,
    ContactsModule,
    CallsModule,
    ContentModule,
    EmergencyModule,
    ModelModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule { }

