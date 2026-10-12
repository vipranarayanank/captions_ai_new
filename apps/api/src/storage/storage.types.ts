import { Readable } from 'node:stream';

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

export interface StorageService {
  upload(key: string, localPath: string, contentType: string): Promise<void>;
  downloadToFile(key: string, destinationPath: string): Promise<void>;
  createReadStream(key: string, range?: { start: number; end?: number }): Promise<Readable>;
  delete(key: string): Promise<void>;
}
