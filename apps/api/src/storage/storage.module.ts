import { Global, Module } from '@nestjs/common';
import { STORAGE_PROVIDER } from './storage.provider';
import { LocalStorageProvider } from './local-storage.provider';
import { SupabaseStorageProvider } from './supabase-storage.provider';
import { LocalStorageController } from './local-storage.controller';

/**
 * STORAGE_PROVIDER=supabase → bucket privado real; cualquier otro valor (o vacío, como en
 * local por defecto) → disco local servido por LocalStorageController.
 */
@Global()
@Module({
  controllers: [LocalStorageController],
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useClass: process.env.STORAGE_PROVIDER === 'supabase' ? SupabaseStorageProvider : LocalStorageProvider,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
