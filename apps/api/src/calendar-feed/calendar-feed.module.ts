import { Module } from '@nestjs/common';
import { AbsencesModule } from '../absences/absences.module';
import { AgendaModule } from '../agenda/agenda.module';
import { CalendarFeedController } from './calendar-feed.controller';
import { CalendarFeedService } from './calendar-feed.service';

@Module({
  imports: [AbsencesModule, AgendaModule],
  controllers: [CalendarFeedController],
  providers: [CalendarFeedService],
})
export class CalendarFeedModule {}
