/**
 * HU-13: relación N:M entre sesiones y formularios del programa
 * (`GET/PUT admin/sesiones/:id/formularios`).
 */
import { describe, it, expect, vi } from 'vitest';
import 'reflect-metadata';

import { AdminFormulariosController } from '../../apps/api/src/modules/formularios/interfaces/admin-formularios.controller';

function build(opts: { sesion?: unknown; plantillas?: unknown[]; globales?: unknown[]; vinculos?: unknown[] } = {}) {
  const asegurarSnapshot = vi.fn().mockImplementation(async (_p: string, g: string) => `snap-${g}`);
  const prisma: any = {
    sesion: {
      findUnique: vi.fn().mockResolvedValue(opts.sesion === undefined ? { id: 's1', programaId: 'p1' } : opts.sesion),
    },
    plantillaFormulario: {
      // where.programaId === null → consulta de catálogo; si no, snapshots del programa.
      findMany: vi
        .fn()
        .mockImplementation(async ({ where }: any) => (where.programaId === null ? opts.globales ?? [] : opts.plantillas ?? [])),
    },
    sesionFormulario: {
      findMany: vi.fn().mockResolvedValue(opts.vinculos ?? []),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: vi.fn().mockImplementation(async (ops: any[]) => Promise.all(ops)),
  };
  return { controller: new AdminFormulariosController(prisma, { asegurarSnapshot } as any), prisma, asegurarSnapshot };
}

describe('GET admin/sesiones/:id/formularios', () => {
  it('devuelve los ids de los formularios ligados a la sesión', async () => {
    const { controller } = build({ vinculos: [{ plantillaId: 'a' }, { plantillaId: 'b' }] });
    expect(await controller.getSesionFormularios('s1')).toEqual({ plantillaIds: ['a', 'b'] });
  });

  it('sesión inexistente → SESION_NOT_FOUND', async () => {
    const { controller } = build({ sesion: null });
    await expect(controller.getSesionFormularios('x')).rejects.toMatchObject({ code: 'SESION_NOT_FOUND' });
  });
});

describe('PUT admin/sesiones/:id/formularios', () => {
  it('reemplaza el conjunto: borra los vínculos previos y crea los nuevos', async () => {
    const { controller, prisma } = build({ plantillas: [{ id: 'a' }, { id: 'b' }] });
    const r = await controller.setSesionFormularios('s1', { plantillaIds: ['a', 'b'] });
    expect(r).toEqual({ plantillaIds: ['a', 'b'] });
    expect(prisma.sesionFormulario.deleteMany).toHaveBeenCalledWith({ where: { sesionId: 's1' } });
    expect(prisma.sesionFormulario.createMany).toHaveBeenCalledWith({
      data: [
        { sesionId: 's1', plantillaId: 'a' },
        { sesionId: 's1', plantillaId: 'b' },
      ],
    });
  });

  it('solo acepta formularios del MISMO programa y de tipo feedback/diagnostico_final', async () => {
    const { controller, prisma } = build({ plantillas: [{ id: 'a' }] });
    await controller.setSesionFormularios('s1', { plantillaIds: ['a'] });
    expect(prisma.plantillaFormulario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['a'] },
          programaId: 'p1',
          tipoFormulario: { in: ['feedback', 'diagnostico_final'] },
        }),
      }),
    );
  });

  it('un id que no es del programa / tipo válido → PLANTILLA_NOT_FOUND y no escribe', async () => {
    const { controller, prisma } = build({ plantillas: [{ id: 'a' }] });
    await expect(controller.setSesionFormularios('s1', { plantillaIds: ['a', 'ajena'] })).rejects.toMatchObject({
      code: 'PLANTILLA_NOT_FOUND',
    });
    expect(prisma.sesionFormulario.deleteMany).not.toHaveBeenCalled();
  });

  it('ids repetidos se deduplican', async () => {
    const { controller, prisma } = build({ plantillas: [{ id: 'a' }] });
    const r = await controller.setSesionFormularios('s1', { plantillaIds: ['a', 'a'] });
    expect(r).toEqual({ plantillaIds: ['a'] });
    expect(prisma.sesionFormulario.createMany).toHaveBeenCalledWith({ data: [{ sesionId: 's1', plantillaId: 'a' }] });
  });

  it('lista vacía desvincula todo', async () => {
    const { controller, prisma } = build();
    const r = await controller.setSesionFormularios('s1', { plantillaIds: [] });
    expect(r).toEqual({ plantillaIds: [] });
    expect(prisma.sesionFormulario.deleteMany).toHaveBeenCalledWith({ where: { sesionId: 's1' } });
  });

  it('sesión inexistente → SESION_NOT_FOUND', async () => {
    const { controller } = build({ sesion: null });
    await expect(controller.setSesionFormularios('x', { plantillaIds: [] })).rejects.toMatchObject({
      code: 'SESION_NOT_FOUND',
    });
  });

  it('plantillaIds ausente o no-array → VALIDATION_ERROR', async () => {
    const { controller } = build();
    await expect(controller.setSesionFormularios('s1', {} as any)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('un id de CATÁLOGO activo fija esa versión en el programa y liga el snapshot', async () => {
    const { controller, prisma, asegurarSnapshot } = build({ plantillas: [{ id: 'a' }], globales: [{ id: 'g2' }] });
    const r = await controller.setSesionFormularios('s1', { plantillaIds: ['a', 'g2'] }, { sub: 'admin1' } as any);
    expect(asegurarSnapshot).toHaveBeenCalledWith('p1', 'g2', 'admin1');
    expect(r).toEqual({ plantillaIds: ['a', 'snap-g2'] });
    expect(prisma.sesionFormulario.createMany).toHaveBeenCalledWith({
      data: [
        { sesionId: 's1', plantillaId: 'a' },
        { sesionId: 's1', plantillaId: 'snap-g2' },
      ],
    });
  });

  it('el catálogo se consulta solo activo, de catálogo y de tipo feedback/diagnostico_final', async () => {
    const { controller, prisma } = build({ globales: [{ id: 'g2' }] });
    await controller.setSesionFormularios('s1', { plantillaIds: ['g2'] }, { sub: 'admin1' } as any);
    expect(prisma.plantillaFormulario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['g2'] },
          programaId: null,
          activa: true,
          tipoFormulario: { in: ['feedback', 'diagnostico_final'] },
        }),
      }),
    );
  });

  it('un id que no es ni del programa ni del catálogo válido → PLANTILLA_NOT_FOUND sin crear snapshots', async () => {
    const { controller, asegurarSnapshot } = build({ globales: [{ id: 'g2' }] });
    await expect(
      controller.setSesionFormularios('s1', { plantillaIds: ['g2', 'x'] }, { sub: 'admin1' } as any),
    ).rejects.toMatchObject({ code: 'PLANTILLA_NOT_FOUND' });
    expect(asegurarSnapshot).not.toHaveBeenCalled();
  });
});
