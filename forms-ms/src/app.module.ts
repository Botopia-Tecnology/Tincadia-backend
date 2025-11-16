import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FormsModule } from './forms/forms.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    FormsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

