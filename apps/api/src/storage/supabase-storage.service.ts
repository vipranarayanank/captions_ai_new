import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { promises as fs, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { StorageService } from './storage.types';

@Injectable()
export class SupabaseStorageService implements StorageService {
  private readonly client: SupabaseClient;
  private readonly baseUrl: string;
  private readonly secretKey: string;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const url = config.get<string>('SUPABASE_URL');
    const key = config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    this.baseUrl = url.replace(/\/$/, '');
    this.secretKey = key;
    this.bucket = config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'captions-media';
    this.client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async upload(key: string, localPath: string, contentType: string): Promise<void> {
    const body = await fs.readFile(localPath);
    const { error } = await this.client.storage.from(this.bucket).upload(key, body, {
      contentType, upsert: false,
    });
    if (error) throw new InternalServerErrorException(`Storage upload failed: ${error.message}`);
  }

  async downloadToFile(key: string, destinationPath: string): Promise<void> {
    const response = await this.fetchObject(key);
    if (!response.ok || !response.body) throw new Error(`Storage download failed: HTTP ${response.status}`);
    await fs.mkdir(destinationPath.slice(0, destinationPath.lastIndexOf('/')) || '.', { recursive: true });
    await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream), createWriteStream(destinationPath));
  }

  async createReadStream(key: string, range?: { start: number; end?: number }): Promise<Readable> {
    const response = await this.fetchObject(key, range);
    if (!response.ok || !response.body) throw new Error(`Storage stream failed: HTTP ${response.status}`);
    return Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);
  }

  async delete(key: string): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).remove([key]);
    if (error) throw new Error(`Storage delete failed: ${error.message}`);
  }

  private fetchObject(key: string, range?: { start: number; end?: number }) {
    const safeKey = key.split('/').map((part) => encodeURIComponent(part)).join('/');
    const headers: Record<string, string> = {
      apikey: this.secretKey,
      Authorization: `Bearer ${this.secretKey}`,
    };
    if (range) headers.Range = `bytes=${range.start}-${range.end ?? ''}`;
    return fetch(`${this.baseUrl}/storage/v1/object/authenticated/${encodeURIComponent(this.bucket)}/${safeKey}`, {
      method: 'GET', headers,
    });
  }
}
