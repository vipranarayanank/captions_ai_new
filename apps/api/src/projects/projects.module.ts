import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectsQueue } from './projects.queue';
import { ProcessingWorker } from './processing.worker';
import { OpenAiWhisperProvider } from '../transcription/openai-whisper.provider';
import { TRANSCRIPTION_PROVIDER } from '../transcription/transcription-provider';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';
import { ExportsQueue } from './exports.queue';
import { ExportsWorker } from './exports.worker';

@Module({
  controllers: [ProjectsController, ExportsController],
  providers: [
    ProjectsService, ProjectsQueue, ProcessingWorker, OpenAiWhisperProvider,
    { provide: TRANSCRIPTION_PROVIDER, useExisting: OpenAiWhisperProvider },
    ExportsService, ExportsQueue, ExportsWorker,
  ],
})
export class ProjectsModule {}
