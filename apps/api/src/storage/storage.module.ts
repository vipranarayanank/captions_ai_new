import { Global, Module } from '@nestjs/common';
import { SupabaseStorageService } from './supabase-storage.service';
import { STORAGE_SERVICE } from './storage.types';

@Global()
@Module({
  providers: [
    SupabaseStorageService,
    { provide: STORAGE_SERVICE, useExisting: SupabaseStorageService },
  ],
  exports: [SupabaseStorageService, STORAGE_SERVICE],
})
export class StorageModule {}
