import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectsQueue } from './projects.queue';
import { ProcessingWorker } from './processing.worker';
import { GeminiTranscribeProvider } from '../transcription/gemini-transcribe.provider';
import { TRANSCRIPTION_PROVIDER } from '../transcription/transcription-provider';

@Module({
  controllers: [ProjectsController],
  providers: [
    ProjectsService, ProjectsQueue, ProcessingWorker, GeminiTranscribeProvider,
    { provide: TRANSCRIPTION_PROVIDER, useExisting: GeminiTranscribeProvider },
  ],
})
export class ProjectsModule {}
