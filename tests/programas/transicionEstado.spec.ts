/**
 * RF-02: máquina de estados de `Programa` en `AdminProgramasController.updatePrograma`.
 * RF-46 (Fase 2): la transición borrador→activo dispara el snapshot de formularios.
 */

import { describe, it, expect, vi } from 'vitest';

import { AdminProgramasController } from '../../apps/api/src/modules/programas/interfaces/admin-programas.controller';

function buildController(estadoActual: string) {
  const prismaMock = {
    programa: {
      findUnique: vi.fn().mockResolvedValue({ id: 'p1', estado: estadoActual }),
      update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'p1', ...data })),
    },
    grupo: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  const snapshotsMock = { snapshotPrograma: vi.fn().mockResolvedValue(0) };
  const controller = new AdminProgramasController(
    prismaMock as any,
    {} as any,
    {} as any,
    snapshotsMock as any,
  );
  return { controller, snapshotsMock };
}

describe('AdminProgramasController.updatePrograma — transición de estado (RF-02)', () => {
  it('borrador → activo es válida y dispara el snapshot de formularios (RF-46)', async () => {
    const { controller, snapshotsMock } = buildController('borrador');
    const result = await controller.updatePrograma('p1', { estado: 'activo' as any });
    expect((result as any).estado).toBe('activo');
    expect(snapshotsMock.snapshotPrograma).toHaveBeenCalledWith('p1');
  });

  it('activo → finalizado es válida y NO dispara snapshot', async () => {
    const { controller, snapshotsMock } = buildController('activo');
    const result = await controller.updatePrograma('p1', { estado: 'finalizado' as any });
    expect((result as any).estado).toBe('finalizado');
    expect(snapshotsMock.snapshotPrograma).not.toHaveBeenCalled();
  });

  it('cualquier estado → cancelado es válido', async () => {
    const { controller } = buildController('activo');
    const result = await controller.updatePrograma('p1', { estado: 'cancelado' as any });
    expect((result as any).estado).toBe('cancelado');
  });

  it('borrador → finalizado es inválida (PROGRAMA_TRANSICION_INVALIDA)', async () => {
    const { controller } = buildController('borrador');
    await expect(
      controller.updatePrograma('p1', { estado: 'finalizado' as any }),
    ).rejects.toMatchObject({ code: 'PROGRAMA_TRANSICION_INVALIDA' });
  });

  it('finalizado → activo es inválida', async () => {
    const { controller } = buildController('finalizado');
    await expect(
      controller.updatePrograma('p1', { estado: 'activo' as any }),
    ).rejects.toMatchObject({ code: 'PROGRAMA_TRANSICION_INVALIDA' });
  });

  it('activo → borrador es inválida', async () => {
    const { controller } = buildController('activo');
    await expect(
      controller.updatePrograma('p1', { estado: 'borrador' as any }),
    ).rejects.toMatchObject({ code: 'PROGRAMA_TRANSICION_INVALIDA' });
  });

  it('reenviar el mismo estado no lanza (no-op) y no dispara snapshot', async () => {
    const { controller, snapshotsMock } = buildController('activo');
    const result = await controller.updatePrograma('p1', { estado: 'activo' as any });
    expect((result as any).estado).toBe('activo');
    expect(snapshotsMock.snapshotPrograma).not.toHaveBeenCalled();
  });

  it('no valida transición si el body no toca estado', async () => {
    const { controller } = buildController('finalizado');
    const result = await controller.updatePrograma('p1', { nombre: 'Nuevo nombre' } as any);
    expect((result as any).nombre).toBe('Nuevo nombre');
  });

  it('crear un programa DIRECTAMENTE en activo también dispara el snapshot (RF-46)', async () => {
    const { controller, snapshotsMock } = buildController('borrador');
    (controller as any).prisma.usuario = {
      findUnique: vi.fn().mockResolvedValue({ id: 'f1', role: { slug: 'facilitador' } }),
    };
    (controller as any).prisma.programa.create = vi
      .fn()
      .mockImplementation(({ data }: any) => Promise.resolve({ id: data.id, estado: data.estado }));

    await controller.createPrograma({
      nombre: 'P',
      empresaId: 'e1',
      facilitadorId: 'f1',
      estado: 'activo' as any,
    });
    expect(snapshotsMock.snapshotPrograma).toHaveBeenCalledTimes(1);

    snapshotsMock.snapshotPrograma.mockClear();
    await controller.createPrograma({ nombre: 'P2', empresaId: 'e1', facilitadorId: 'f1' });
    expect(snapshotsMock.snapshotPrograma).not.toHaveBeenCalled();
  });

  it('GRUPO_MIN_INTEGRANTES: no se activa con un grupo de menos de 2 miembros', async () => {
    const { controller, snapshotsMock } = buildController('borrador');
    (controller as any).prisma.grupo.findMany = vi
      .fn()
      .mockResolvedValue([{ _count: { miembros: 1 } }]);
    await expect(
      controller.updatePrograma('p1', { estado: 'activo' as any }),
    ).rejects.toMatchObject({ code: 'GRUPO_MIN_INTEGRANTES' });
    expect(snapshotsMock.snapshotPrograma).not.toHaveBeenCalled();
  });
});
