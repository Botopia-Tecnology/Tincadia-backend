import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { ContactMatchCache, ContactSyncChunkResult, ContactSyncState, Profile } from '../entities';

@Module({
  imports: [TypeOrmModule.forFeature([Profile, ContactSyncState, ContactMatchCache, ContactSyncChunkResult])],
  controllers: [ContactsController],
  providers: [ContactsService],
})
export class ContactsModule {}




