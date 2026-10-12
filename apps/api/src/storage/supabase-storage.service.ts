import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createReadStream, promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import { StorageService } from './storage.types';

@Injectable()
export class SupabaseStorageService implements StorageService {
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const url = config.get<string>('SUPABASE_URL');
    const key = config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    this.bucket = config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'captions-media';
    this.client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async upload(key: string, localPath: string, contentType: string): Promise<void> {
    const body = await fs.readFile(localPath);
    const { error } = await this.client.storage.from(this.bucket).upload(key, body, {
      contentType,
      upsert: false,
    });
    if (error) throw new InternalServerErrorException(`Storage upload failed: ${error.message}`);
  }

  async downloadToFile(key: string, destinationPath: string): Promise<void> {
    const { data, error } = await this.client.storage.from(this.bucket).download(key);
    if (error || !data) throw new Error(`Storage download failed: ${error?.message ?? 'empty response'}`);
    await fs.writeFile(destinationPath, Buffer.from(await data.arrayBuffer()));
  }

  async createReadStream(key: string, range?: { start: number; end?: number }): Promise<Readable> {
    const { data, error } = await this.client.storage.from(this.bucket).download(key);
    if (error || !data) throw new Error(`Storage download failed: ${error?.message ?? 'empty response'}`);
    const buffer = Buffer.from(await data.arrayBuffer());
    if (!range) return Readable.from(buffer);
    const start = Math.max(0, range.start);
    const end = Math.min(range.end ?? buffer.length - 1, buffer.length - 1);
    return Readable.from(buffer.subarray(start, end + 1));
  }

  async delete(key: string): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).remove([key]);
    if (error) throw new Error(`Storage delete failed: ${error.message}`);
  }

  async getLocalReadStream(path: string): Promise<Readable> {
    return createReadStream(path);
  }
}
