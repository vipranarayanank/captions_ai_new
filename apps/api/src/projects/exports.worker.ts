import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { PrismaService } from '../database/prisma.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { EXPORT_QUEUE } from './exports.queue';
import { Caption } from './project.types';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

let bundlePromise: Promise<string> | null = null;

@Injectable()
export class ExportsWorker implements OnModuleInit, OnModuleDestroy {
  private connection!: IORedis;
  private worker!: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.connection = new IORedis(this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
    this.worker = new Worker(EXPORT_QUEUE, async (job) => this.process(job.data.projectId), {
      connection: this.connection, concurrency: 1,
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.connection?.quit();
  }

  private async process(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.status !== 'READY') return;
    const tempDir = join(process.cwd(), '.tmp', 'exports', projectId + '-' + randomUUID());
    await fs.mkdir(tempDir, { recursive: true });
    const outputPath = join(tempDir, 'captions.mp4');
    try {
      await this.prisma.project.update({ where: { id: projectId }, data: { exportStatus: 'PROCESSING', errorMessage: null } });
      const src = await this.storage.createSignedUrl(project.videoKey, 3600);
      if (!bundlePromise) {
        bundlePromise = bundle({
          entryPoint: join(process.cwd(), 'apps', 'web', 'src', 'remotion-entry.tsx'),
          outDir: join(process.cwd(), '.tmp', 'remotion-bundle'),
        });
      }
      const serveUrl = await bundlePromise;
      const captions = (Array.isArray(project.captions) ? project.captions : []) as unknown as Caption[];
      const inputProps = { src, captions, templateId: project.templateId };
      const fps = project.fps && project.fps > 0 ? Math.round(project.fps) : 30;
      const durationInFrames = Math.max(1, Math.ceil((project.durationSec ?? 30) * fps));
      const composition = await selectComposition({
        serveUrl, id: 'CaptionsVideo',
        inputProps,
      });
      const finalComposition = { ...composition, fps, durationInFrames };
      await renderMedia({
        composition: finalComposition,
        serveUrl,
        codec: 'h264',
        outputLocation: outputPath,
        inputProps,
        logLevel: 'error',
      });
      const exportKey = `projects/${projectId}/exports/captions-${Date.now()}.mp4`;
      await this.storage.upload(exportKey, outputPath, 'video/mp4');
      await this.prisma.project.update({
        where: { id: projectId }, data: { exportKey, exportStatus: 'READY', errorMessage: null },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Video export failed.';
      await this.prisma.project.update({
        where: { id: projectId }, data: { exportStatus: 'FAILED', errorMessage: message.slice(0, 1000) },
      });
      throw error;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}
