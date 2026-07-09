/**
 * RF-02: máquina de estados de `Programa` en `AdminProgramasController.updatePrograma`.
 */

import { describe, it, expect, vi } from 'vitest';

import { AdminProgramasController } from '../../apps/api/src/modules/programas/interfaces/admin-programas.controller';

function buildController(estadoActual: string) {
  const prismaMock = {
    programa: {
      findUnique: vi.fn().mockResolvedValue({ id: 'p1', estado: estadoActual }),
      update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'p1', ...data })),
    },
  };
  return new AdminProgramasController(prismaMock as any, {} as any, {} as any);
}

describe('AdminProgramasController.updatePrograma — transición de estado (RF-02)', () => {
  it('borrador → activo es válida', async () => {
    const controller = buildController('borrador');
    const result = await controller.updatePrograma('p1', { estado: 'activo' as any });
    expect((result as any).estado).toBe('activo');
  });

  it('activo → finalizado es válida', async () => {
    const controller = buildController('activo');
    const result = await controller.updatePrograma('p1', { estado: 'finalizado' as any });
    expect((result as any).estado).toBe('finalizado');
  });

  it('cualquier estado → cancelado es válido', async () => {
    const controller = buildController('activo');
    const result = await controller.updatePrograma('p1', { estado: 'cancelado' as any });
    expect((result as any).estado).toBe('cancelado');
  });

  it('borrador → finalizado es inválida (PROGRAMA_TRANSICION_INVALIDA)', async () => {
    const controller = buildController('borrador');
    await expect(
      controller.updatePrograma('p1', { estado: 'finalizado' as any }),
    ).rejects.toMatchObject({ code: 'PROGRAMA_TRANSICION_INVALIDA' });
  });

  it('finalizado → activo es inválida', async () => {
    const controller = buildController('finalizado');
    await expect(
      controller.updatePrograma('p1', { estado: 'activo' as any }),
    ).rejects.toMatchObject({ code: 'PROGRAMA_TRANSICION_INVALIDA' });
  });

  it('activo → borrador es inválida', async () => {
    const controller = buildController('activo');
    await expect(
      controller.updatePrograma('p1', { estado: 'borrador' as any }),
    ).rejects.toMatchObject({ code: 'PROGRAMA_TRANSICION_INVALIDA' });
  });

  it('reenviar el mismo estado no lanza (no-op)', async () => {
    const controller = buildController('activo');
    const result = await controller.updatePrograma('p1', { estado: 'activo' as any });
    expect((result as any).estado).toBe('activo');
  });

  it('no valida transición si el body no toca estado', async () => {
    const controller = buildController('finalizado');
    const result = await controller.updatePrograma('p1', { nombre: 'Nuevo nombre' } as any);
    expect((result as any).nombre).toBe('Nuevo nombre');
  });
});
