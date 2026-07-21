import { Module } from '@nestjs/common';
import { AnotacionesController } from './anotaciones.controller';
import { AnotacionesService } from './anotaciones.service';

@Module({ controllers: [AnotacionesController], providers: [AnotacionesService] })
export class AnotacionesModule {}
