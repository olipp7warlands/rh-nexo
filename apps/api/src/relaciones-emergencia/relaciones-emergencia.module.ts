import { Module } from '@nestjs/common';
import { RelacionesEmergenciaController } from './relaciones-emergencia.controller';
import { RelacionesEmergenciaService } from './relaciones-emergencia.service';

@Module({ controllers: [RelacionesEmergenciaController], providers: [RelacionesEmergenciaService] })
export class RelacionesEmergenciaModule {}
