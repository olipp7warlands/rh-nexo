import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

const logQueries = process.env.PRISMA_LOG_QUERIES === 'true';

@Injectable()
export class PrismaService extends PrismaClient<Prisma.PrismaClientOptions, 'query'> implements OnModuleInit {
  constructor() {
    super(logQueries ? { log: [{ emit: 'event', level: 'query' }] } : {});
  }

  async onModuleInit() {
    await this.$connect();
    // Instrumentación de diagnóstico (auditoría de rendimiento), apagada por defecto —
    // solo se activa con PRISMA_LOG_QUERIES=true, nunca en producción/tests.
    if (logQueries) {
      this.$on('query', (e) => {
        console.log(`[prisma] ${e.duration}ms  ${e.query}`);
      });
    }
  }
}
