import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { ExportsQueue } from './exports.queue';

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
    private readonly queue: ExportsQueue,
  ) {}

  async start(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found.');
    if (project.status !== 'READY') throw new BadRequestException('Wait until captions are ready before exporting.');
    await this.prisma.project.update({ where: { id: projectId }, data: { exportStatus: 'QUEUED', exportKey: null } });
    await this.queue.enqueue(projectId);
    return { status: 'QUEUED' };
  }

  async status(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found.');
    const downloadUrl = project.exportStatus === 'READY' && project.exportKey
      ? await this.storage.createSignedUrl(project.exportKey, 3600)
      : null;
    return { status: project.exportStatus ?? 'NOT_STARTED', downloadUrl, errorMessage: project.exportStatus === 'FAILED' ? project.errorMessage : null };
  }
}
