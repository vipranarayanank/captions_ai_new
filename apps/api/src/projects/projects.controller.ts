import {
  BadRequestException, Controller, Delete, Get, Headers, Param, Patch, Post, Put,
  Body, Res, UploadedFile, UseInterceptors, Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { promises as fs } from 'node:fs';
import { Response } from 'express';
import { ProjectsService } from './projects.service';
import { Caption } from './project.types';

@Controller()
export class ProjectsController {
  private readonly uploadDir: string;
  private readonly maxBytes: number;

  constructor(private readonly projects: ProjectsService, config: ConfigService) {
    this.uploadDir = config.get<string>('UPLOAD_TEMP_DIR') ?? '.tmp/uploads';
    this.maxBytes = Number(config.get('MAX_UPLOAD_MB') ?? 500) * 1024 * 1024;
  }

  @Post('projects')
  @UseInterceptors(FileInterceptor('video', {
    storage: diskStorage({
      destination: async (_req, _file, cb) => {
        const dir = join(process.cwd(), '.tmp', 'uploads');
        await fs.mkdir(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => cb(null, randomUUID() + extname(file.originalname).toLowerCase()),
    }),
    limits: { fileSize: 500 * 1024 * 1024 },
  }))
  create(@UploadedFile() file: Express.Multer.File) {
    return this.projects.upload(file);
  }

  @Get('projects')
  list() { return this.projects.list(); }

  @Get('projects/:id')
  get(@Param('id') id: string) { return this.projects.get(id); }

  @Patch('projects/:id')
  update(@Param('id') id: string, @Body() body: { title?: string; templateId?: string }) {
    return this.projects.update(id, body);
  }

  @Put('projects/:id/captions')
  saveCaptions(@Param('id') id: string, @Body() body: { captions?: Caption[] }) {
    if (!Array.isArray(body?.captions)) throw new BadRequestException('captions must be an array.');
    return this.projects.saveCaptions(id, body.captions);
  }

  @Delete('projects/:id')
  delete(@Param('id') id: string) { return this.projects.delete(id); }

  @Get('projects/:id/media')
  async media(@Param('id') id: string, @Headers('range') range: string | undefined, @Res() res: Response) {
    const { stream, project } = await this.projects.media(id, range);
    const size = (project as unknown as { fileSizeBytes?: number }).fileSizeBytes;
    if (range && size) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) { res.status(416).end(); return; }
      const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
      const end = match[2] ? Number(match[2]) : size - 1;
      if (start >= size || end < start) { res.status(416).end(); return; }
      res.status(206).set({
        'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${Math.min(end, size - 1)}/${size}`,
        'Content-Length': String(Math.min(end, size - 1) - start + 1), 'Content-Type': 'video/mp4',
      });
    } else {
      res.set({ 'Accept-Ranges': 'bytes', 'Content-Type': 'application/octet-stream' });
    }
    stream.on('error', () => { if (!res.headersSent) res.status(502); res.end(); });
    stream.pipe(res);
  }
}
