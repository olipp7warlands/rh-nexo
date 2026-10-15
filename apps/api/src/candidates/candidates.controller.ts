import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CandidatesService } from './candidates.service';
import { CreateCandidateDto, HistoricoQueryDto } from './candidates.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@Roles('ADMIN', 'RRHH', 'MANAGER')
@Controller('candidates')
export class CandidatesController {
  constructor(private readonly service: CandidatesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query('search') search?: string) {
    return this.service.findAll(user, search);
  }

  /**
   * Histórico transversal de candidaturas. Solo ADMIN/RRHH: el @Roles del método sustituye al
   * de la clase (RolesGuard usa getAllAndOverride), así que un MANAGER recibe 403. Declarado
   * ANTES de `:id`, o `historico` se interpretaría como un id de candidato.
   */
  @Roles('ADMIN', 'RRHH')
  @Get('historico')
  historico(@CurrentUser() user: AuthUser, @Query() query: HistoricoQueryDto) {
    return this.service.historico(query, user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(id, user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCandidateDto) {
    return this.service.create(dto, user);
  }
}
