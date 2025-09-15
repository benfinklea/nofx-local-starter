import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import PgBoss from 'pg-boss';
import { DbService } from './db.service';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  boss!: PgBoss;
  readonly queueName = process.env.JOB_QUEUE || 'step_ready';
  constructor(private readonly db: DbService) {}

  async onModuleInit() {
    const cs = process.env.DATABASE_URL as string;
    this.boss = new PgBoss({ connectionString: cs, schema: process.env.BOSS_SCHEMA || 'pgboss' });
    await this.boss.start();
    console.log('Queue started');
  }
  async onModuleDestroy() {
    await this.boss.stop();
  }

  async enqueueStep(stepId: string) {
    await this.boss.send(this.queueName, { stepId });
  }
}
