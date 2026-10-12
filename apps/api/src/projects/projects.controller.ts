import {
  BadRequestException, Controller, Delete, Get, Headers, Param, Patch, Post, Put,
  Body, Res, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { Response } from 'express';
import { ProjectsService } from './projects.service';
import { Caption } from './project.types';

@Controller()
export class ProjectsController {
  @Post('projects')
  @UseInterceptors(FileInterceptor('video', {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const dir = join(process.cwd(), '.tmp', 'uploads');
        mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => cb(null, randomUUID() + extname(file.originalname).toLowerCase()),
    }),
    limits: { fileSize: Number(process.env.MAX_UPLOAD_MB ?? 500) * 1024 * 1024 },
  }))
  create(@UploadedFile() file: Express.Multer.File, @Body() body: { sourceLanguage?: string; captionStyle?: string }) {
    return this.projects.upload(file, body);
  }

  constructor(private readonly projects: ProjectsService) {}

  @Get('projects')
  list() { return this.projects.list(); }

  @Get('projects/:id')
  get(@Param('id') id: string) { return this.projects.get(id); }

  @Patch('projects/:id')
  update(@Param('id') id: string, @Body() body: { title?: string; templateId?: string; backgroundColor?: string; backgroundOnly?: boolean }) {
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
    const result = await this.projects.media(id, range);
    const { stream, project } = result;
    const mime = project.videoKey.endsWith('.webm') ? 'video/webm' :
      project.videoKey.endsWith('.mov') ? 'video/quicktime' :
      project.videoKey.endsWith('.mkv') ? 'video/x-matroska' : 'video/mp4';
    res.set({ 'Accept-Ranges': 'bytes', 'Content-Type': mime });
    if (result.range) {
      res.status(206).set({
        'Content-Range': `bytes ${result.range.start}-${result.range.end}/${project.fileSizeBytes}`,
        'Content-Length': String(result.range.end - result.range.start + 1),
      });
    } else {
      res.set({ 'Content-Length': String(project.fileSizeBytes) });
    }
    stream.on('error', () => { if (!res.headersSent) res.status(502); res.end(); });
    stream.pipe(res);
  }
}
