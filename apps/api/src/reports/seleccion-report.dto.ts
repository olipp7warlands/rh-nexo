import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Filtros de GET /reports/seleccion. Todos opcionales. */
export class SeleccionReportQueryDto {
  /** Año natural (UTC). Acota a las ofertas abiertas O cerradas en ese año. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year?: number;
  @IsOptional() @IsString() @MaxLength(50) sociedadId?: string;
  @IsOptional() @IsString() @MaxLength(50) proyectoId?: string;
}
