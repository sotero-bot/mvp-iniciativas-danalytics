/**
 * Snapshot de formularios por programa (Plan 2 §2.2 — RF-46/47/48/49, RN-10).
 */

import { describe, it, expect, vi } from 'vitest';

import { SnapshotFormulariosService } from '../../apps/api/src/modules/formularios/application/snapshot-formularios.service';

const GLOBAL = {
  id: 'g1',
  programaId: null,
  tipoFormulario: 'diagnostico_inicial',
  nombre: 'Diagnóstico',
  descripcion: null,
  version: 2,
  activa: true,
  campos: [
    { id: 'c1', campoPadreId: null, tipoCampo: 'likert', etiqueta: 'P1', descripcion: null, dimension: 'adopcion', esObligatorio: true, orden: 1, configJson: { min: 1, max: 5 } },
    { id: 'c2', campoPadreId: null, tipoCampo: 'opcion_multiple', etiqueta: 'P2', descripcion: null, dimension: 'uso', esObligatorio: false, orden: 2, configJson: { opciones: [{ valor: 'a', etiqueta: 'A', score: 3 }] } },
  ],
};

function buildService(overrides: Record<string, any> = {}) {
  const tx = {
    plantillaFormulario: {
      findMany: vi
        .fn()
        // 1ª llamada: globales activos; 2ª: snapshots ya existentes del programa.
        .mockResolvedValueOnce(overrides.globales ?? [GLOBAL])
        .mockResolvedValueOnce(overrides.existentes ?? []),
      create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    campoFormulario: {
      create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
    },
    respuestaFormulario: {
      count: vi.fn().mockResolvedValue(overrides.respuestas ?? 0),
    },
  };
  const prisma = {
    $transaction: vi.fn().mockImplementation(async (fn: any) => fn(tx)),
    plantillaFormulario: overrides.plantillaFindMany
      ? { findMany: overrides.plantillaFindMany }
      : tx.plantillaFormulario,
  };
  return { service: new SnapshotFormulariosService(prisma as any), tx, prisma };
}

describe('SnapshotFormulariosService.snapshotPrograma (RF-46)', () => {
  it('copia cada global activo con sus campos y snapshotDeId al origen', async () => {
    const { service, tx } = buildService();
    const creados = await service.snapshotPrograma('prog1', 'admin1');

    expect(creados).toBe(1);
    expect(tx.plantillaFormulario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          programaId: 'prog1',
          snapshotDeId: 'g1',
          tipoFormulario: 'diagnostico_inicial',
          version: 2,
          creadoPorId: 'admin1',
        }),
      }),
    );
    // RF-48: los campos se copian como filas nuevas — editar el global después
    // no toca el snapshot. configJson (con scores) viaja íntegro a la copia.
    expect(tx.campoFormulario.create).toHaveBeenCalledTimes(2);
    const configCopiada = (tx.campoFormulario.create as any).mock.calls[1][0].data.configJson;
    expect(configCopiada).toEqual({ opciones: [{ valor: 'a', etiqueta: 'A', score: 3 }] });
  });

  it('es idempotente: no duplica snapshots ya tomados de un global', async () => {
    const { service, tx } = buildService({ existentes: [{ snapshotDeId: 'g1' }] });
    const creados = await service.snapshotPrograma('prog1');
    expect(creados).toBe(0);
    expect(tx.plantillaFormulario.create).not.toHaveBeenCalled();
  });
});

describe('SnapshotFormulariosService.regenerarSnapshot (RF-47)', () => {
  it('con ≥1 respuesta → SNAPSHOT_CON_RESPUESTAS y no borra nada', async () => {
    const { service, tx } = buildService({ respuestas: 4 });
    await expect(service.regenerarSnapshot('prog1')).rejects.toMatchObject({
      code: 'SNAPSHOT_CON_RESPUESTAS',
    });
    expect(tx.plantillaFormulario.deleteMany).not.toHaveBeenCalled();
  });

  it('sin respuestas: borra los snapshots del programa y re-copia los globales', async () => {
    const { service, tx } = buildService({ respuestas: 0 });
    const creados = await service.regenerarSnapshot('prog1', 'admin1');
    expect(tx.plantillaFormulario.deleteMany).toHaveBeenCalledWith({
      where: { programaId: 'prog1' },
    });
    expect(creados).toBe(1);
  });
});

describe('SnapshotFormulariosService.estadoSnapshot (RF-49)', () => {
  it('marca "desactualizado" si el global cambió después del snapshot', async () => {
    const snapshotEn = new Date('2026-07-01T00:00:00Z');
    const plantillaFindMany = vi.fn().mockResolvedValue([
      {
        id: 's1',
        tipoFormulario: 'diagnostico_inicial',
        nombre: 'Diag',
        version: 2,
        createdAt: snapshotEn,
        snapshotDeId: 'g1',
        snapshotDe: { id: 'g1', updatedAt: new Date('2026-07-05T00:00:00Z'), activa: true },
        _count: { respuestas: 0 },
      },
      {
        id: 's2',
        tipoFormulario: 'feedback',
        nombre: 'Feedback',
        version: 1,
        createdAt: snapshotEn,
        snapshotDeId: 'g2',
        snapshotDe: { id: 'g2', updatedAt: new Date('2026-06-01T00:00:00Z'), activa: true },
        _count: { respuestas: 2 },
      },
    ]);
    const { service } = buildService({ plantillaFindMany });

    const estado = await service.estadoSnapshot('prog1');
    expect(estado[0]).toMatchObject({ id: 's1', desactualizado: true, snapshotEn });
    expect(estado[1]).toMatchObject({ id: 's2', desactualizado: false, respuestas: 2 });
  });
});
