import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const EXPORT_QUEUE = 'export-project';

@Injectable()
export class ExportsQueue implements OnModuleDestroy {
  private readonly connection: IORedis;
  readonly queue: Queue;

  constructor(config: ConfigService) {
    this.connection = new IORedis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
    this.queue = new Queue(EXPORT_QUEUE, { connection: this.connection });
  }

  async enqueue(projectId: string) {
    await this.queue.add('export-project', { projectId }, {
      attempts: 2, backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 50, removeOnFail: 100,
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
    await this.connection.quit();
  }
}
