import { Module } from '@nestjs/common';
import { IdiomasController } from './idiomas.controller';
import { IdiomasService } from './idiomas.service';

@Module({ controllers: [IdiomasController], providers: [IdiomasService] })
export class IdiomasModule {}
