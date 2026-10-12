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
    this.worker = new Worker(EXPORT_QUEUE, async (job) => {
      console.log(`[export] Job ${job.id} started for project ${job.data.projectId}`);
      return this.process(job.data.projectId);
    }, {
      connection: this.connection,
      concurrency: 1,
      lockDuration: 10 * 60 * 1000,
    });
    this.worker.on('ready', () => console.log('[export] Worker ready and listening for jobs.'));
    this.worker.on('active', (job) => console.log(`[export] Job ${job.id} is active.`));
    this.worker.on('completed', (job) => console.log(`[export] Job ${job.id} completed.`));
    this.worker.on('failed', (job, error) => console.error(`[export] Job ${job?.id ?? 'unknown'} failed:`, error));
    this.worker.on('error', (error) => console.error('[export] Worker error:', error));
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.connection?.quit();
  }

  private async process(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error(`Export project not found: ${projectId}`);
    if (project.status !== 'READY') {
      throw new Error(`Cannot export project while processing status is ${project.status}; expected READY.`);
    }
    const tempDir = join(process.cwd(), '.tmp', 'exports', projectId + '-' + randomUUID());
    const outputPath = join(tempDir, 'captions.mp4');
    try {
      await this.prisma.project.update({ where: { id: projectId }, data: { exportStatus: 'PROCESSING', errorMessage: null } });
      await fs.mkdir(tempDir, { recursive: true });
      console.log(`[export] ${projectId}: creating signed source URL.`);
      const src = await this.storage.createSignedUrl(project.videoKey, 3600);
      if (!bundlePromise) {
        bundlePromise = bundle({
          entryPoint: join(__dirname, '..', '..', '..', 'web', 'src', 'remotion-entry.tsx'),
          outDir: join(process.cwd(), '.tmp', 'remotion-bundle'),
        }).catch((error) => {
          bundlePromise = null;
          throw error;
        });
      }
      console.log(`[export] ${projectId}: bundling Remotion composition (cached after first run).`);
      const serveUrl = await bundlePromise;
      console.log(`[export] ${projectId}: bundle ready; preparing composition.`);
      const captions = (Array.isArray(project.captions) ? project.captions : []) as unknown as Caption[];
      const inputProps = { src, captions, templateId: project.templateId };
      const fps = project.fps && project.fps > 0 ? Math.round(project.fps) : 30;
      const durationInFrames = Math.max(1, Math.ceil((project.durationSec ?? 30) * fps));
      const composition = await selectComposition({
        serveUrl, id: 'CaptionsVideo',
        inputProps,
      });
      const finalComposition = { ...composition, fps, durationInFrames };
      console.log(`[export] ${projectId}: rendering ${durationInFrames} frames at ${fps} fps.`);
      let lastProgressLog = 0;
      await renderMedia({
        composition: finalComposition,
        serveUrl,
        codec: 'h264',
        outputLocation: outputPath,
        inputProps,
        logLevel: 'error',
        concurrency: 2,
        crf: 23,
        x264Preset: 'veryfast',
        onProgress: ({ progress }) => {
          const percent = Math.floor(progress * 100);
          if (percent === 100 || percent >= lastProgressLog + 10) {
            lastProgressLog = percent;
            console.log(`[export] ${projectId}: render ${percent}%`);
          }
        },
      });
      const exportKey = `projects/${projectId}/exports/captions-${Date.now()}.mp4`;
      console.log(`[export] ${projectId}: render finished; uploading MP4 to Supabase.`);
      await this.storage.upload(exportKey, outputPath, 'video/mp4');
      await this.prisma.project.update({
        where: { id: projectId }, data: { exportKey, exportStatus: 'READY', errorMessage: null },
      });
      console.log(`[export] ${projectId}: export READY.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Video export failed.';
      console.error(`[export] ${projectId}: export failed:`, error);
      await this.prisma.project.update({
        where: { id: projectId }, data: { exportStatus: 'FAILED', errorMessage: message.slice(0, 1000) },
      });
      throw error;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}
