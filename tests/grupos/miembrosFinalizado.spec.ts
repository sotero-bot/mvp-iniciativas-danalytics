/**
 * HU-23 (D6) · un grupo finalizado NO admite cambios de integrantes: agregar, quitar,
 * reemplazar, mover e intercambiar lanzan GRUPO_FINALIZADO (también cuando solo el grupo
 * destino / el par está finalizado) y no escriben. Para corregir hay que reabrir.
 */

import { describe, it, expect, vi } from 'vitest';

import { MiembrosGrupoService } from '../../apps/api/src/modules/grupos/application/miembros.service';

const FIN = new Date('2026-10-01');

function build(finalizados: string[] = []) {
  const grupos: Record<string, any> = {
    g1: { id: 'g1', programaId: 'p1', finalizadoEn: finalizados.includes('g1') ? FIN : null },
    g2: { id: 'g2', programaId: 'p1', finalizadoEn: finalizados.includes('g2') ? FIN : null },
  };
  const prisma: any = {
    grupo: { findUnique: vi.fn().mockImplementation(({ where }: any) => Promise.resolve(grupos[where.id] ?? null)) },
    participantePrograma: { findFirst: vi.fn().mockResolvedValue({ id: 'pp', confirmadoEn: new Date('2026-01-01') }) },
    miembroGrupo: {
      findFirst: vi.fn().mockImplementation(({ where }: any) => {
        if (where.grupoId) return Promise.resolve(where.usuarioId === 'A' && where.grupoId === 'g1' ? { id: 'mA', grupoId: 'g1' } : null);
        return Promise.resolve(where.usuarioId === 'B' ? { id: 'mB', grupoId: 'g2' } : null);
      }),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  };
  return { service: new MiembrosGrupoService(prisma), prisma };
}

function noEscribio(prisma: any) {
  expect(prisma.miembroGrupo.create).not.toHaveBeenCalled();
  expect(prisma.miembroGrupo.update).not.toHaveBeenCalled();
  expect(prisma.miembroGrupo.delete).not.toHaveBeenCalled();
  expect(prisma.$transaction).not.toHaveBeenCalled();
}

describe('HU-23 · integrantes bloqueados en grupo finalizado', () => {
  it('agregar', async () => {
    const { service, prisma } = build(['g1']);
    await expect(service.agregar('g1', 'C')).rejects.toMatchObject({ code: 'GRUPO_FINALIZADO' });
    noEscribio(prisma);
  });

  it('quitar', async () => {
    const { service, prisma } = build(['g1']);
    await expect(service.quitar('g1', 'A')).rejects.toMatchObject({ code: 'GRUPO_FINALIZADO' });
    noEscribio(prisma);
  });

  it('reemplazar', async () => {
    const { service, prisma } = build(['g1']);
    await expect(service.reemplazar('g1', 'A', 'C')).rejects.toMatchObject({ code: 'GRUPO_FINALIZADO' });
    noEscribio(prisma);
  });

  it('mover: origen finalizado', async () => {
    const { service, prisma } = build(['g1']);
    await expect(service.mover('g1', 'A', 'g2')).rejects.toMatchObject({ code: 'GRUPO_FINALIZADO' });
    noEscribio(prisma);
  });

  it('mover: solo el DESTINO finalizado', async () => {
    const { service, prisma } = build(['g2']);
    await expect(service.mover('g1', 'A', 'g2')).rejects.toMatchObject({ code: 'GRUPO_FINALIZADO' });
    noEscribio(prisma);
  });

  it('intercambiar: grupo finalizado', async () => {
    const { service, prisma } = build(['g1']);
    await expect(service.intercambiar('g1', 'A', 'B')).rejects.toMatchObject({ code: 'GRUPO_FINALIZADO' });
    noEscribio(prisma);
  });

  it('intercambiar: solo el grupo del PAR finalizado', async () => {
    const { service, prisma } = build(['g2']);
    await expect(service.intercambiar('g1', 'A', 'B')).rejects.toMatchObject({ code: 'GRUPO_FINALIZADO' });
    noEscribio(prisma);
  });

  it('con los grupos abiertos todo sigue funcionando (regresión)', async () => {
    const { service, prisma } = build([]);
    await service.quitar('g1', 'A');
    expect(prisma.miembroGrupo.delete).toHaveBeenCalled();
    await service.mover('g1', 'A', 'g2');
    expect(prisma.miembroGrupo.update).toHaveBeenCalled();
    await service.intercambiar('g1', 'A', 'B');
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
