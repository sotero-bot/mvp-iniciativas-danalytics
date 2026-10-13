/**
 * HU-13: `asegurarSnapshot` fija en el programa la versión del catálogo elegida en una sesión.
 */
import { describe, it, expect, vi } from 'vitest';

import { SnapshotFormulariosService } from '../../apps/api/src/modules/formularios/application/snapshot-formularios.service';

const GLOBAL = {
  id: 'g2',
  programaId: null,
  tipoFormulario: 'feedback',
  nombre: 'Feedback v2',
  descripcion: null,
  version: 2,
  activa: true,
  campos: [
    { id: 'c1', campoPadreId: null, tipoCampo: 'likert', etiqueta: 'P1', descripcion: null, dimension: null, esObligatorio: true, orden: 1, configJson: {} },
  ],
};

function build(opts: { existente?: unknown; global?: unknown } = {}) {
  const tx = {
    plantillaFormulario: {
      // 1ª llamada: snapshot existente del programa; 2ª: el global activo.
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(opts.existente ?? null)
        .mockResolvedValueOnce(opts.global === undefined ? GLOBAL : opts.global),
      create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
    },
    campoFormulario: { create: vi.fn() },
  };
  const prisma = { $transaction: vi.fn().mockImplementation(async (fn: any) => fn(tx)) };
  return { service: new SnapshotFormulariosService(prisma as any), tx };
}

describe('SnapshotFormulariosService.asegurarSnapshot (HU-13)', () => {
  it('si el programa ya tiene snapshot de ese global, devuelve el existente sin crear', async () => {
    const { service, tx } = build({ existente: { id: 'snap-1' } });
    expect(await service.asegurarSnapshot('p1', 'g2', 'admin1')).toBe('snap-1');
    expect(tx.plantillaFormulario.create).not.toHaveBeenCalled();
  });

  it('si no existe, copia el global (con sus campos) y devuelve el id nuevo', async () => {
    const { service, tx } = build();
    const id = await service.asegurarSnapshot('p1', 'g2', 'admin1');
    expect(tx.plantillaFormulario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ programaId: 'p1', snapshotDeId: 'g2', version: 2, creadoPorId: 'admin1' }),
      }),
    );
    expect(tx.campoFormulario.create).toHaveBeenCalledTimes(1);
    expect(id).toBe((tx.plantillaFormulario.create as any).mock.calls[0][0].data.id);
  });

  it('el global se busca solo si es activo y de catálogo (programaId null)', async () => {
    const { service, tx } = build();
    await service.asegurarSnapshot('p1', 'g2');
    expect(tx.plantillaFormulario.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { id: 'g2', programaId: null, activa: true } }),
    );
  });

  it('global inexistente o inactivo → null y no crea', async () => {
    const { service, tx } = build({ global: null });
    expect(await service.asegurarSnapshot('p1', 'g2')).toBeNull();
    expect(tx.plantillaFormulario.create).not.toHaveBeenCalled();
  });
});
