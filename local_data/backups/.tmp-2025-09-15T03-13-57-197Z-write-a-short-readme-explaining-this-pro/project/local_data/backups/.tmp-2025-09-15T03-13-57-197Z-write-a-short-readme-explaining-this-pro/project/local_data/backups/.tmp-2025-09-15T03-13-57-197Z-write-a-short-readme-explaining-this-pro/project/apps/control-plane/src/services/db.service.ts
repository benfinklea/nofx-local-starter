import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  public pool!: Pool;

  async onModuleInit() {
    const cs = process.env.DATABASE_URL as string;
    if (!cs) throw new Error('DATABASE_URL missing');
    this.pool = new Pool({ connectionString: cs });
    await this.pool.query('select 1');
    console.log('DB connected');
  }
  async onModuleDestroy() {
    await this.pool.end();
  }
}
