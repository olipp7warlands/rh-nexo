import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageProvider } from './storage.provider';

const SIGNED_URL_TTL_SECONDS = 300; // 5 minutos

/** Bucket privado + URL firmada bajo demanda (ver storage.module.ts). Producción (Railway). */
@Injectable()
export class SupabaseStorageProvider implements StorageProvider {
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        'Faltan SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY para STORAGE_PROVIDER=supabase.',
      );
    }
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'nucleo-docs';
    this.client = createClient(url, key, { auth: { persistSession: false } });
  }

  async upload(path: string, buffer: Buffer, mimeType: string): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(path, buffer, { contentType: mimeType, upsert: true });
    if (error) throw new Error(`Error subiendo a Supabase Storage: ${error.message}`);
  }

  async getDownloadUrl(path: string): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error) throw new Error(`Error generando URL firmada: ${error.message}`);
    return data.signedUrl;
  }
}
