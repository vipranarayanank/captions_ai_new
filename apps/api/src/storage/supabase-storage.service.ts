import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { promises as fs, createWriteStream } from 'node:fs';
import { dirname } from 'node:path';
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
    const fileInfo = await fs.stat(localPath);
    const safeKey = key.split('/').map((part) => encodeURIComponent(part)).join('/');
    const response = await fetch(`${this.baseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${safeKey}`, {
      method: 'POST',
      headers: {
        apikey: this.secretKey,
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': contentType,
        'Content-Length': String(fileInfo.size),
        'x-upsert': 'false',
      },
      body: createReadStream(localPath) as any,
      duplex: 'half',
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new InternalServerErrorException(`Storage upload failed (HTTP ${response.status}): ${detail.slice(0, 300)}`);
    }
  }

  async downloadToFile(key: string, destinationPath: string): Promise<void> {
    const response = await this.fetchObject(key);
    if (!response.ok || !response.body) throw new Error(`Storage download failed: HTTP ${response.status}`);
    await fs.mkdir(dirname(destinationPath), { recursive: true });
    await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream), createWriteStream(destinationPath));
  }

  async createReadStream(key: string, range?: { start: number; end?: number }): Promise<Readable> {
    const response = await this.fetchObject(key, range);
    if (!response.ok || !response.body) throw new Error(`Storage stream failed: HTTP ${response.status}`);
    return Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);
  }

  async createSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUrl(key, expiresInSeconds);
    if (error || !data?.signedUrl) throw new Error(`Could not create media link: ${error?.message ?? 'empty signed URL'}`);
    return data.signedUrl;
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
