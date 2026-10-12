import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectsQueue } from './projects.queue';
import { ProcessingWorker } from './processing.worker';
import { GeminiTranscribeProvider } from '../transcription/gemini-transcribe.provider';
import { TRANSCRIPTION_PROVIDER } from '../transcription/transcription-provider';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';
import { ExportsQueue } from './exports.queue';
import { ExportsWorker } from './exports.worker';

@Module({
  controllers: [ProjectsController, ExportsController],
  providers: [
    ProjectsService, ProjectsQueue, ProcessingWorker, GeminiTranscribeProvider,
    { provide: TRANSCRIPTION_PROVIDER, useExisting: GeminiTranscribeProvider },
    ExportsService, ExportsQueue, ExportsWorker,
  ],
})
export class ProjectsModule {}
