import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseService } from './supabase.service';

/**
 * Módulo global de Supabase
 * Importar una vez en AppModule y estará disponible en toda la aplicación
 */
@Global()
@Module({
    imports: [ConfigModule],
    providers: [SupabaseService],
    exports: [SupabaseService],
})
export class SupabaseModule { }
