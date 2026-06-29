import { Module } from '@nestjs/common';
import { Controller, Get, Query } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HolidaysService {
  constructor(private readonly db: PrismaService) {}

  /** Festivos nacionales (location null) + los de la ubicación indicada. */
  findAll(location?: string) {
    return this.db.holiday.findMany({
      where: location ? { OR: [{ location: null }, { location }] } : undefined,
      orderBy: { date: 'asc' },
    });
  }
}

@Controller('holidays')
export class HolidaysController {
  constructor(private readonly service: HolidaysService) {}

  @Get()
  findAll(@Query('location') location?: string) {
    return this.service.findAll(location);
  }
}

@Module({ controllers: [HolidaysController], providers: [HolidaysService] })
export class HolidaysModule {}
