import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectsQueue } from './projects.queue';
import { ProcessingWorker } from './processing.worker';
import { OpenAiWhisperProvider } from '../transcription/openai-whisper.provider';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectsQueue, ProcessingWorker, OpenAiWhisperProvider],
})
export class ProjectsModule {}
