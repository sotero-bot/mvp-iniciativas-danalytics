import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Prisma, TipoCampo, TipoFormulario } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../prisma.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import type { AuthUser } from '../../auth/guards';
import { AppError } from '../../../shared/errors/AppError';
import { validarConfigCampo } from '../application/form-config';
import { SnapshotFormulariosService } from '../application/snapshot-formularios.service';

interface CreatePlantillaDto {
  tipoFormulario: TipoFormulario;
  nombre: string;
  descripcion?: string | null;
}

interface UpdatePlantillaDto {
  nombre?: string;
  descripcion?: string | null;
  activa?: boolean;
}

interface CampoDto {
  tipoCampo: TipoCampo;
  etiqueta: string;
  descripcion?: string | null;
  dimension?: string | null;
  esObligatorio?: boolean;
  orden?: number;
  campoPadreId?: string | null;
  configJson?: unknown;
}

interface ReordenDto {
  orden: { id: string; orden: number }[];
}

const PLANTILLA_SELECT = {
  id: true,
  programaId: true,
  tipoFormulario: true,
  nombre: true,
  descripcion: true,
  version: true,
  activa: true,
  snapshotDeId: true,
  creadoPorId: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { campos: true, respuestas: true } },
} satisfies Prisma.PlantillaFormularioSelect;

// El admin SÍ ve configJson (scores incluidos) — RNF-04 solo restringe al resto de roles.
const CAMPO_SELECT = {
  id: true,
  plantillaId: true,
  campoPadreId: true,
  tipoCampo: true,
  etiqueta: true,
  descripcion: true,
  dimension: true,
  esObligatorio: true,
  orden: true,
  configJson: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CampoFormularioSelect;

// Autorización (Plan 2 §0.1, RF-22…RF-27/RF-46…RF-49): form builder, solo danalytics_admin.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('danalytics_admin')
@Controller('admin')
export class AdminFormulariosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshots: SnapshotFormulariosService,
  ) {}

  // --------- Plantillas (RF-22/23) ---------

  // Sin programaId → templates globales (los que edita el builder);
  // con programaId → snapshots de ese programa.
  @Get('plantillas-formulario')
  async listPlantillas(
    @Query('tipo') tipo?: TipoFormulario,
    @Query('programaId') programaId?: string,
  ) {
    const where: Prisma.PlantillaFormularioWhereInput = {
      programaId: programaId ?? null,
    };
    if (tipo) where.tipoFormulario = tipo;
    return this.prisma.plantillaFormulario.findMany({
      where,
      select: PLANTILLA_SELECT,
      orderBy: [{ tipoFormulario: 'asc' }, { version: 'desc' }],
    });
  }

  @Post('plantillas-formulario')
  async createPlantilla(@Body() body: CreatePlantillaDto, @CurrentUser() actor: AuthUser) {
    if (!body?.tipoFormulario || !body?.nombre?.trim()) {
      throw new AppError('VALIDATION_ERROR', { message: 'tipoFormulario y nombre son obligatorios' });
    }
    return this.prisma.plantillaFormulario.create({
      data: {
        id: randomUUID(),
        programaId: null,
        tipoFormulario: body.tipoFormulario,
        nombre: body.nombre.trim(),
        descripcion: body.descripcion ?? null,
        creadoPorId: actor.sub,
      },
      select: PLANTILLA_SELECT,
    });
  }

  // RF-23: duplicar = nueva versión editable (version+1). El original se desactiva
  // para que el snapshot (RF-46, que copia los globales ACTIVOS) no duplique el tipo.
  @Post('plantillas-formulario/:id/duplicar')
  async duplicarPlantilla(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    const original = await this.prisma.plantillaFormulario.findUnique({
      where: { id },
      include: { campos: { orderBy: { orden: 'asc' } } },
    });
    if (!original) throw new AppError('PLANTILLA_NOT_FOUND');

    return this.prisma.$transaction(async (tx) => {
      if (original.programaId === null) {
        await tx.plantillaFormulario.update({ where: { id }, data: { activa: false } });
      }
      const copia = await tx.plantillaFormulario.create({
        data: {
          id: randomUUID(),
          programaId: original.programaId,
          tipoFormulario: original.tipoFormulario,
          nombre: original.nombre,
          descripcion: original.descripcion,
          version: original.version + 1,
          activa: true,
          creadoPorId: actor.sub,
        },
        select: PLANTILLA_SELECT,
      });

      const idMap = new Map<string, string>();
      for (const campo of original.campos) idMap.set(campo.id, randomUUID());
      for (const campo of original.campos) {
        await tx.campoFormulario.create({
          data: {
            id: idMap.get(campo.id)!,
            plantillaId: copia.id,
            campoPadreId: campo.campoPadreId ? idMap.get(campo.campoPadreId) ?? null : null,
            tipoCampo: campo.tipoCampo,
            etiqueta: campo.etiqueta,
            descripcion: campo.descripcion,
            dimension: campo.dimension,
            esObligatorio: campo.esObligatorio,
            orden: campo.orden,
            configJson: campo.configJson as Prisma.InputJsonValue,
          },
        });
      }
      return copia;
    });
  }

  @Patch('plantillas-formulario/:id')
  async updatePlantilla(@Param('id') id: string, @Body() body: UpdatePlantillaDto) {
    const existing = await this.prisma.plantillaFormulario.findUnique({
      where: { id },
      include: { _count: { select: { respuestas: true } } },
    });
    if (!existing) throw new AppError('PLANTILLA_NOT_FOUND');

    // RF-23/RF-47: con respuestas la plantilla es inmutable; solo se permite
    // activar/desactivar (retirar una versión no toca lo ya respondido).
    const tocaContenido = body.nombre !== undefined || body.descripcion !== undefined;
    if (tocaContenido && existing._count.respuestas > 0) {
      throw new AppError('PLANTILLA_INMUTABLE');
    }

    const data: Prisma.PlantillaFormularioUpdateInput = {};
    if (body.nombre !== undefined) data.nombre = body.nombre;
    if (body.descripcion !== undefined) data.descripcion = body.descripcion ?? null;
    if (body.activa !== undefined) data.activa = body.activa;
    return this.prisma.plantillaFormulario.update({ where: { id }, data, select: PLANTILLA_SELECT });
  }

  // --------- Campos (RF-24/25/26) ---------

  @Get('plantillas-formulario/:id/campos')
  async listCampos(@Param('id') plantillaId: string) {
    const plantilla = await this.prisma.plantillaFormulario.findUnique({ where: { id: plantillaId } });
    if (!plantilla) throw new AppError('PLANTILLA_NOT_FOUND');
    return this.prisma.campoFormulario.findMany({
      where: { plantillaId },
      select: CAMPO_SELECT,
      orderBy: { orden: 'asc' },
    });
  }

  @Post('plantillas-formulario/:id/campos')
  async createCampo(@Param('id') plantillaId: string, @Body() body: CampoDto) {
    await this.assertPlantillaMutable(plantillaId);
    if (!body?.tipoCampo || !body?.etiqueta?.trim()) {
      throw new AppError('VALIDATION_ERROR', { message: 'tipoCampo y etiqueta son obligatorios' });
    }
    const config = validarConfigCampo(body.tipoCampo, body.configJson ?? {});

    if (body.campoPadreId) {
      const padre = await this.prisma.campoFormulario.findUnique({ where: { id: body.campoPadreId } });
      if (!padre || padre.plantillaId !== plantillaId) throw new AppError('CAMPO_NOT_FOUND');
      if (padre.tipoCampo !== 'grupo_repetible') {
        throw new AppError('CAMPO_CONFIG_INVALIDA', {
          message: 'campoPadreId debe apuntar a un grupo_repetible',
        });
      }
    }

    let orden = body.orden;
    if (orden === undefined) {
      const last = await this.prisma.campoFormulario.findFirst({
        where: { plantillaId },
        orderBy: { orden: 'desc' },
        select: { orden: true },
      });
      orden = (last?.orden ?? 0) + 1;
    }

    return this.prisma.campoFormulario.create({
      data: {
        id: randomUUID(),
        plantillaId,
        campoPadreId: body.campoPadreId ?? null,
        tipoCampo: body.tipoCampo,
        etiqueta: body.etiqueta.trim(),
        descripcion: body.descripcion ?? null,
        dimension: body.dimension ?? null,
        esObligatorio: body.esObligatorio ?? false,
        orden,
        configJson: config as Prisma.InputJsonValue,
      },
      select: CAMPO_SELECT,
    });
  }

  @Patch('campos/:id')
  async updateCampo(@Param('id') id: string, @Body() body: Partial<CampoDto>) {
    const existing = await this.prisma.campoFormulario.findUnique({ where: { id } });
    if (!existing) throw new AppError('CAMPO_NOT_FOUND');
    await this.assertPlantillaMutable(existing.plantillaId);

    const tipoCampo = body.tipoCampo ?? existing.tipoCampo;
    const data: Prisma.CampoFormularioUpdateInput = {};
    if (body.tipoCampo !== undefined) data.tipoCampo = body.tipoCampo;
    if (body.etiqueta !== undefined) data.etiqueta = body.etiqueta;
    if (body.descripcion !== undefined) data.descripcion = body.descripcion ?? null;
    if (body.dimension !== undefined) data.dimension = body.dimension ?? null;
    if (body.esObligatorio !== undefined) data.esObligatorio = body.esObligatorio;
    if (body.orden !== undefined) data.orden = body.orden;
    // Grupo padre: conectar (hijo de un grupo_repetible) o desconectar (campo de
    // primer nivel). Antes se ignoraba, por eso "Sin grupo padre" no surtía efecto.
    if (body.campoPadreId !== undefined) {
      if (body.campoPadreId) {
        const padre = await this.prisma.campoFormulario.findUnique({ where: { id: body.campoPadreId } });
        if (!padre || padre.plantillaId !== existing.plantillaId) throw new AppError('CAMPO_NOT_FOUND');
        if (padre.tipoCampo !== 'grupo_repetible') {
          throw new AppError('CAMPO_CONFIG_INVALIDA', {
            message: 'campoPadreId debe apuntar a un grupo_repetible',
          });
        }
        data.campoPadre = { connect: { id: body.campoPadreId } };
      } else {
        data.campoPadre = { disconnect: true };
      }
    }
    if (body.configJson !== undefined || body.tipoCampo !== undefined) {
      const config = validarConfigCampo(tipoCampo, body.configJson ?? existing.configJson);
      data.configJson = config as Prisma.InputJsonValue;
    }
    return this.prisma.campoFormulario.update({ where: { id }, data, select: CAMPO_SELECT });
  }

  @Delete('campos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCampo(@Param('id') id: string) {
    const existing = await this.prisma.campoFormulario.findUnique({ where: { id } });
    if (!existing) throw new AppError('CAMPO_NOT_FOUND');
    await this.assertPlantillaMutable(existing.plantillaId);
    await this.prisma.campoFormulario.delete({ where: { id } });
  }

  // RF-24: reordenar en lote.
  @Put('plantillas-formulario/:id/campos/orden')
  async reordenarCampos(@Param('id') plantillaId: string, @Body() body: ReordenDto) {
    await this.assertPlantillaMutable(plantillaId);
    if (!Array.isArray(body?.orden) || body.orden.length === 0) {
      throw new AppError('VALIDATION_ERROR', { message: 'orden debe ser un array {id, orden}' });
    }
    const ids = body.orden.map(o => o.id);
    const campos = await this.prisma.campoFormulario.findMany({
      where: { id: { in: ids }, plantillaId },
      select: { id: true },
    });
    if (campos.length !== ids.length) throw new AppError('CAMPO_NOT_FOUND');

    await this.prisma.$transaction(
      body.orden.map(o =>
        this.prisma.campoFormulario.update({ where: { id: o.id }, data: { orden: o.orden } }),
      ),
    );
    return { actualizados: body.orden.length };
  }

  // --------- Snapshot por programa (RF-46/47/49) ---------

  // RF-47: regeneración manual, solo válida sin respuestas.
  @Post('programas/:id/regenerar-snapshot')
  async regenerarSnapshot(@Param('id') programaId: string, @CurrentUser() actor: AuthUser) {
    const programa = await this.prisma.programa.findUnique({ where: { id: programaId } });
    if (!programa) throw new AppError('PROGRAMA_NOT_FOUND');
    const creados = await this.snapshots.regenerarSnapshot(programaId, actor.sub);
    return { creados };
  }

  // RF-46: rellena los tipos de formulario que faltan en el snapshot (ej. bitácora /
  // plantilla de proyecto creadas como global DESPUÉS de activar el programa). Aditivo:
  // no toca ni duplica los snapshots existentes (preserva el versionado inmutable) y es
  // seguro con respuestas ya registradas.
  @Post('programas/:id/sincronizar-plantillas')
  async sincronizarPlantillas(@Param('id') programaId: string, @CurrentUser() actor: AuthUser) {
    const programa = await this.prisma.programa.findUnique({ where: { id: programaId } });
    if (!programa) throw new AppError('PROGRAMA_NOT_FOUND');
    const creados = await this.snapshots.sincronizarPlantillasFaltantes(programaId, actor.sub);
    return { creados };
  }

  // RF-49: fecha de snapshot por tipo + indicador "versión anterior" si el global cambió.
  @Get('programas/:id/snapshot-estado')
  async snapshotEstado(@Param('id') programaId: string) {
    const programa = await this.prisma.programa.findUnique({ where: { id: programaId } });
    if (!programa) throw new AppError('PROGRAMA_NOT_FOUND');
    return this.snapshots.estadoSnapshot(programaId);
  }

  // --------- Helpers ---------

  // RF-23/RF-47: una plantilla (global o snapshot) con ≥1 respuesta es inmutable.
  private async assertPlantillaMutable(plantillaId: string): Promise<void> {
    const plantilla = await this.prisma.plantillaFormulario.findUnique({
      where: { id: plantillaId },
      include: { _count: { select: { respuestas: true } } },
    });
    if (!plantilla) throw new AppError('PLANTILLA_NOT_FOUND');
    if (plantilla._count.respuestas > 0) throw new AppError('PLANTILLA_INMUTABLE');
  }
}
