import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Project } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { extname } from 'node:path';
import { PrismaService } from '../database/prisma.service';
import { StorageService, STORAGE_SERVICE } from '../storage/storage.types';
import { Caption } from './project.types';
import { ProjectsQueue } from './projects.queue';
import { validateCaptions } from '../captions/caption-utils';

const allowedExtensions = new Set(['.mp4', '.mov', '.webm', '.mkv']);
const allowedMimeTypes = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'application/octet-stream']);

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly queue: ProjectsQueue,
    private readonly config: ConfigService,
  ) {}

  async upload(file: Express.Multer.File, languages: { sourceLanguage?: string; captionStyle?: string } = {}) {
    if (!file) throw new BadRequestException('Choose a video file.');
    const ext = extname(file.originalname).toLowerCase();
    const maxBytes = Number(this.config.get('MAX_UPLOAD_MB') ?? 500) * 1024 * 1024;
    if (!allowedExtensions.has(ext) || !allowedMimeTypes.has(file.mimetype)) {
      await fs.rm(file.path, { force: true });
      throw new BadRequestException('Supported video types: MP4, MOV, WebM, and MKV.');
    }
    if (file.size > maxBytes) {
      await fs.rm(file.path, { force: true });
      throw new BadRequestException(`Video exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB upload limit.`);
    }
    const id = randomUUID();
    const videoKey = `projects/${id}/source${ext}`;
    try {
      await this.storage.upload(videoKey, file.path, file.mimetype);
      const project = await this.prisma.project.create({
        data: {
          id,
          title: file.originalname.replace(/\.[^.]+$/, '').slice(0, 120) || 'Untitled video',
          videoKey,
          fileSizeBytes: file.size,
          status: 'UPLOADED',
          sourceLanguage: this.normalizeLanguage(languages.sourceLanguage),
          captionStyle: this.normalizeCaptionStyle(languages.sourceLanguage, languages.captionStyle),
        },
      });
      await this.queue.enqueue(project.id);
      return this.toDto(project);
    } catch (error) {
      try { await this.storage.delete(videoKey); } catch {}
      throw error;
    } finally {
      await fs.rm(file.path, { force: true });
    }
  }

  async list() {
    return (await this.prisma.project.findMany({ orderBy: { updatedAt: 'desc' } })).map((p) => this.toDto(p));
  }

  async get(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found.');
    return this.toDto(project);
  }

  async update(id: string, data: { title?: string; templateId?: string }) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found.');
    const update: Prisma.ProjectUpdateInput = {};
    if (typeof data.title === 'string') {
      const title = data.title.trim();
      if (!title || title.length > 120) throw new BadRequestException('Title must be between 1 and 120 characters.');
      update.title = title;
    }
    if (typeof data.templateId === 'string') {
      const allowedTemplateIds = new Set(["mrbeast-classic","solo","no-caption","master","typo-simple","podcast","discipline","kinetic","impact-glow","clean","red-wipe","punch","slam","cook","scatter","creator","creator-2","estate-1","estate","estate-2","estate-3","story","cyber","creator-3","creator-4","crazy","crazy-2","spark","gamer","cursive-highlight","popular","word-highlight","perfect","focus","open","hind","karaoke-classic","boxed","notification","mint-punch","dynamic-sliding-highlight","popup-chat-bubble","popup-chat-bubble-left","glowly-1","shine-1","fusion-1","triple","smooth","smooth-fusion","girly-sparkle","bubble-pop","spotlight","sticker","ransom","ransom-animate","torn-paper","glow-word","gilded","oneword-pill","dyn-estate","dyn-classic","dyn-creator","dyn-simple","dyn-doctor","dyn-luxe","classic","karaoke","pop","neon","subtle","highlight-run","stack","typewriter","glow","marker","bounce","cinematic"]);
      if (!allowedTemplateIds.has(data.templateId)) throw new BadRequestException('Unknown caption template.');
      update.templateId = data.templateId;
    }
    return this.toDto(await this.prisma.project.update({ where: { id }, data: update }));
  }

  async saveCaptions(id: string, captions: Caption[]) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found.');
    if (captions.some((caption) => !caption || typeof caption.text !== 'string' ||
      !Number.isFinite(caption.startMs) || !Number.isFinite(caption.endMs) ||
      (caption.words !== undefined && !Array.isArray(caption.words)))) {
      throw new BadRequestException('Each caption must include text and numeric start/end times.');
    }
    const problem = validateCaptions(captions);
    if (problem) throw new BadRequestException(problem);
    const safe = captions.map((caption) => ({
      id: caption.id || randomUUID(),
      startMs: Math.round(caption.startMs),
      endMs: Math.round(caption.endMs),
      text: caption.text.trim(),
      words: (caption.words ?? []).map((word) => ({
        text: String(word.text), startMs: Math.round(word.startMs), endMs: Math.round(word.endMs),
      })),
    }));
    const updated = await this.prisma.project.update({
      where: { id }, data: { captions: safe as unknown as Prisma.InputJsonValue },
    });
    return this.toDto(updated);
  }

  async delete(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found.');
    await this.prisma.project.delete({ where: { id } });
    for (const key of [project.videoKey, project.audioKey, project.exportKey].filter(Boolean) as string[]) {
      try { await this.storage.delete(key); } catch {}
    }
    return { deleted: true };
  }

  async media(id: string, rangeHeader?: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found.');
    const range = rangeHeader ? this.parseRange(rangeHeader, project.fileSizeBytes) : undefined;
    const stream = await this.storage.createReadStream(project.videoKey, range);
    return { stream, project, range };
  }

  private parseRange(header: string, size: number) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(header);
    if (!match || size <= 0) throw new BadRequestException('Invalid byte range.');
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= size || end < start) {
      throw new BadRequestException('Requested byte range is not satisfiable.');
    }
    return { start, end };
  }

  private normalizeLanguage(value?: string) {
    const supported = new Set(['en','ta','hi','te','ml','kn','bn','mr','gu','pa','ur','es','fr','de','pt','it','ja','ko','zh','ar','id','ru','tr','vi','th']);
    return value && supported.has(value) ? value : 'en';
  }

  private normalizeCaptionStyle(language?: string, style?: string) {
    if (!language || language === 'en') return 'native';
    return style === 'roman' || style === 'english' ? style : 'native';
  }

  private toDto(project: Project) {
    return {
      ...project,
      captions: Array.isArray(project.captions) ? project.captions : [],
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }
}
