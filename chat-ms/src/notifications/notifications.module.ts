import { Module, Global } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Global()
@Module({
    imports: [SupabaseModule],
    providers: [NotificationsService],
    exports: [NotificationsService],
})
export class NotificationsModule { }
