import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { DbService } from '../services/db.service';
import { QueueService } from '../services/queue.service';
import { v4 as uuidv4 } from 'uuid';

const CreateRunSchema = z.object({
  plan: z.any(),
  owner: z.string().min(1)
});

@Controller('runs')
export class RunController {
  constructor(private readonly db: DbService, private readonly queue: QueueService) {}

  @Get()
  async list() {
    const res = await this.db.pool.query('select * from nofx.run order by created_at desc limit 50');
    return res.rows;
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const r = await this.db.pool.query('select * from nofx.run where id = $1', [id]);
    const s = await this.db.pool.query('select * from nofx.step where run_id = $1 order by created_at', [id]).catch(() => ({ rows: [] }));
    return { run: r.rows[0], steps: s.rows };
  }

  @Post()
  async create(@Body() body: any) {
    const { plan, owner } = CreateRunSchema.parse(body);
    const runId = uuidv4();
    await this.db.pool.query(
      `insert into nofx.run (id, status, plan, owner) values ($1,'queued',$2,$3)`,
      [runId, plan, owner]
    );
    // create a single hello step to demo
    const stepId = uuidv4();
    await this.db.pool.query(
      `insert into nofx.step (id, run_id, name, status, inputs) values ($1,$2,$3,'queued',$4)`,
      [stepId, runId, 'hello_codegen', JSON.stringify({ text: 'Hello from NOFX' })]
    );
    await this.queue.enqueueStep(stepId);
    await this.db.pool.query(
      `insert into nofx.event (run_id, step_id, type, payload) values ($1,$2,'step.ready',$3)`,
      [runId, stepId, JSON.stringify({})]
    );
    return { id: runId, stepId };
  }
}
