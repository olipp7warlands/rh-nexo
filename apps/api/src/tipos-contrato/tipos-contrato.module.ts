import { Module } from '@nestjs/common';
import { TiposContratoController } from './tipos-contrato.controller';
import { TiposContratoService } from './tipos-contrato.service';

@Module({ controllers: [TiposContratoController], providers: [TiposContratoService] })
export class TiposContratoModule {}
