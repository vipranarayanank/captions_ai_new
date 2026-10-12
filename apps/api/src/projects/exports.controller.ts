import { Controller, Get, Param, Post } from '@nestjs/common';
import { ExportsService } from './exports.service';

@Controller('projects/:id/export')
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  @Post()
  start(@Param('id') id: string) {
    return this.exports.start(id);
  }

  @Get()
  status(@Param('id') id: string) {
    return this.exports.status(id);
  }
}
