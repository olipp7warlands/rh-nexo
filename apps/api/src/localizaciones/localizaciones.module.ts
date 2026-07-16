import { Module } from '@nestjs/common';
import { LocalizacionesController } from './localizaciones.controller';
import { LocalizacionesService } from './localizaciones.service';

@Module({ controllers: [LocalizacionesController], providers: [LocalizacionesService] })
export class LocalizacionesModule {}
