/**
 * O-01 (aclaración 2026-07-14): la bitácora solo es visible/editable cuando el
 * programa la habilita (Programa.bitacoraHabilitadaEn). Desde la aclaración
 * 2026-07-23 ese gate cubre TODA la sección del reto, incluida la plantilla del
 * proyecto (reemplaza la aclaración 2026-07-14 en la que la plantilla no tenía gate). Unit sobre GrupoRecursosController.
 */

import { describe, it, expect, vi } from 'vitest';

import { GrupoRecursosController } from '../../apps/api/src/modules/reto/interfaces/grupo-recursos.controller';

const ACTOR = { sub: 'u1', role: 'estudiante', empresaId: null } as any;

function build(bitacoraHabilitadaEn: Date | null) {
  const grupo = {
    id: 'g1',
    programaId: 'p1',
    nombre: 'G1',
    orden: 1,
    programa: { id: 'p1', nombre: 'P', estado: 'activo', presentacionDesdeSesion: null, bitacoraHabilitadaEn, empresa: { nombre: 'Emp' } },
  };
  const prisma: any = {
    grupo: { findUnique: vi.fn().mockResolvedValue(grupo) },
    miembroGrupo: { findFirst: vi.fn().mockResolvedValue({ id: 'm1' }) },
    plantillaFormulario: { findFirst: vi.fn().mockResolvedValue({ id: 'pl1', programaId: 'p1', tipoFormulario: 'plantilla_proyecto', nombre: 'Plantilla', descripcion: null }) },
    campoFormulario: { findMany: vi.fn().mockResolvedValue([]) },
    respuestaFormulario: { findFirst: vi.fn().mockResolvedValue(null) },
    presentacionFinal: { findUnique: vi.fn().mockResolvedValue(null) },
  };
  const scope: any = { assertProgramaAccessible: vi.fn().mockResolvedValue(undefined) };
  const translations: any = { applyOverlay: vi.fn().mockResolvedValue({}) };
  const s3: any = {};
  return { controller: new GrupoRecursosController(prisma as any, scope as any, translations as any, s3 as any), prisma };
}

describe('O-01 · gate de la bitácora', () => {
  it('bitácora NO habilitada → BITACORA_NO_HABILITADA al abrirla', async () => {
    const { controller } = build(null);
    await expect(controller.getBitacora('g1', ACTOR)).rejects.toMatchObject({ code: 'BITACORA_NO_HABILITADA' });
  });

  it('bitácora NO habilitada → BITACORA_NO_HABILITADA al guardar draft', async () => {
    const { controller } = build(null);
    await expect(controller.saveBitacoraDraft('g1', { datos: {} }, ACTOR)).rejects.toMatchObject({
      code: 'BITACORA_NO_HABILITADA',
    });
  });

  it('la plantilla del proyecto TAMBIÉN está gateada: bitácora NO habilitada → BITACORA_NO_HABILITADA', async () => {
    const { controller } = build(null);
    await expect(controller.getPlantillaProyecto('g1', ACTOR)).rejects.toMatchObject({
      code: 'BITACORA_NO_HABILITADA',
    });
    await expect(controller.savePlantillaProyectoDraft('g1', { datos: {} }, ACTOR)).rejects.toMatchObject({
      code: 'BITACORA_NO_HABILITADA',
    });
  });

  it('con la bitácora habilitada la plantilla del proyecto se abre normalmente', async () => {
    const { controller } = build(new Date('2026-07-01'));
    const res = await controller.getPlantillaProyecto('g1', ACTOR);
    expect(res).toMatchObject({ tipoFormulario: 'plantilla_proyecto' });
  });
});
