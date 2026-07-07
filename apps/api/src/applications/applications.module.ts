import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { InterviewsController } from './interviews.controller';
import { ApplicationsService } from './applications.service';

@Module({
  controllers: [ApplicationsController, InterviewsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
