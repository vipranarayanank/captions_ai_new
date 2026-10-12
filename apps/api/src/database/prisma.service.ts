import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // Prisma connects lazily; connect at startup only when a database URL is configured.
    if (process.env.DATABASE_URL) await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
