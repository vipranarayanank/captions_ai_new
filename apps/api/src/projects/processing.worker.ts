import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaService } from '../database/prisma.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { OpenAiWhisperProvider } from '../transcription/openai-whisper.provider';
import { groupWordsIntoCaptions } from '../captions/caption-utils';
import { PROJECT_QUEUE } from './projects.queue';
import { promises as fs } from 'node:fs';
import { join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

@Injectable()
export class ProcessingWorker implements OnModuleInit, OnModuleDestroy {
  private connection!: IORedis;
  private worker!: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
    private readonly whisper: OpenAiWhisperProvider,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.connection = new IORedis(this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
    this.worker = new Worker(PROJECT_QUEUE, async (job) => this.process(job.data.projectId), {
      connection: this.connection,
      concurrency: 2,
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.connection?.quit();
  }

  private async process(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return;
    const tempDir = join(process.cwd(), '.tmp', 'processing', projectId + '-' + randomUUID());
    await fs.mkdir(tempDir, { recursive: true });
    const sourcePath = join(tempDir, 'source' + extname(project.videoKey));
    const audioPath = join(tempDir, 'audio.mp3');
    try {
      await this.prisma.project.update({ where: { id: projectId }, data: { status: 'EXTRACTING_AUDIO', errorMessage: null } });
      await this.storage.downloadToFile(project.videoKey, sourcePath);
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error', '-show_entries', 'format=duration:stream=width,height,r_frame_rate,codec_type',
        '-of', 'json', sourcePath,
      ]);
      const metadata = JSON.parse(stdout) as {
        format?: { duration?: string };
        streams?: Array<{ codec_type?: string; width?: number; height?: number; r_frame_rate?: string }>;
      };
      const video = metadata.streams?.find((stream) => stream.codec_type === 'video');
      const audio = metadata.streams?.some((stream) => stream.codec_type === 'audio');
      if (!audio) throw new Error('This video has no audio track to transcribe.');
      await execFileAsync('ffmpeg', ['-y', '-i', sourcePath, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '48k', audioPath]);
      const stat = await fs.stat(audioPath);
      if (stat.size > 25 * 1024 * 1024) throw new Error('Extracted audio exceeds Whisper 25 MB limit. Shorter videos are supported in this MVP.');
      const audioKey = `projects/${projectId}/audio.mp3`;
      await this.storage.upload(audioKey, audioPath, 'audio/mpeg');
      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          status: 'TRANSCRIBING', audioKey,
          durationSec: Number(metadata.format?.duration ?? 0) || null,
          width: video?.width ?? null, height: video?.height ?? null,
          fps: video?.r_frame_rate && video.r_frame_rate.includes('/') ?
            Number(video.r_frame_rate.split('/')[0]) / Number(video.r_frame_rate.split('/')[1]) : null,
        },
      });
      const result = await this.whisper.transcribe(audioPath);
      if (!result.words.length) throw new Error('No speech was detected in this video.');
      const captions = groupWordsIntoCaptions(result.words);
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'READY', language: result.language ?? null, captions: captions as any, errorMessage: null },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Video processing failed.';
      await this.prisma.project.update({
        where: { id: projectId }, data: { status: 'FAILED', errorMessage: message.slice(0, 1000) },
      });
      throw error;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}
