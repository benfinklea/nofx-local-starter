import { Module } from '@nestjs/common';
import { RunController } from '../web/run.controller';
import { HealthController } from '../web/health.controller';
import { DbService } from '../services/db.service';
import { QueueService } from '../services/queue.service';

@Module({
  controllers: [RunController, HealthController],
  providers: [DbService, QueueService],
})
export class AppModule {}
