import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const PROJECT_QUEUE = 'process-project';

@Injectable()
export class ProjectsQueue implements OnModuleDestroy {
  private readonly connection: IORedis;
  readonly queue: Queue;

  constructor(config: ConfigService) {
    this.connection = new IORedis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue(PROJECT_QUEUE, { connection: this.connection });
  }

  async enqueue(projectId: string) {
    await this.queue.add('process-project', { projectId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1500 },
      removeOnComplete: 100,
      removeOnFail: 200,
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
    await this.connection.quit();
  }
}
