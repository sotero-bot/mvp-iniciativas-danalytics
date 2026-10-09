/**
 * HU-21/22 · MiembrosGrupoService.reemplazar: "quita a A, pon a B" atómico.
 * Orden de validación fijado por el plan; el conteo del grupo no cambia, incluso
 * con un grupo de exactamente 2 integrantes (el mínimo de integrantes ya no existe).
 */

import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@prisma/client';

import { MiembrosGrupoService } from '../../apps/api/src/modules/grupos/application/miembros.service';

function build(over: Record<string, any> = {}) {
  const prisma: any = {
    grupo: { findUnique: vi.fn().mockResolvedValue({ id: 'g1', programaId: 'p1' }) },
    miembroGrupo: {
      // 1ª llamada: saliente en ese grupo; 2ª: entrante ya en grupo del programa
      findFirst: vi.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(where.grupoId ? { id: 'mSaliente' } : null),
      ),
      count: vi.fn().mockResolvedValue(2),
      delete: vi.fn().mockReturnValue('DELETE_OP'),
      create: vi.fn().mockReturnValue('CREATE_OP'),
    },
    participantePrograma: {
      findFirst: vi.fn().mockResolvedValue({ id: 'pp1', confirmadoEn: new Date('2026-06-01') }),
    },
    $transaction: vi.fn().mockResolvedValue([]),
    ...over,
  };
  return { service: new MiembrosGrupoService(prisma), prisma };
}

describe('MiembrosGrupoService.reemplazar', () => {
  it('grupo inexistente → GRUPO_NOT_FOUND', async () => {
    const { service } = build({ grupo: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(service.reemplazar('g1', 'A', 'B')).rejects.toMatchObject({ code: 'GRUPO_NOT_FOUND' });
  });

  it('saliente === entrante → GRUPO_REEMPLAZO_INVALIDO', async () => {
    const { service, prisma } = build();
    await expect(service.reemplazar('g1', 'A', 'A')).rejects.toMatchObject({ code: 'GRUPO_REEMPLAZO_INVALIDO' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('saliente no es miembro de ese grupo → MIEMBRO_NO_PARTICIPA', async () => {
    const { service, prisma } = build();
    prisma.miembroGrupo.findFirst.mockResolvedValue(null);
    await expect(service.reemplazar('g1', 'A', 'B')).rejects.toMatchObject({ code: 'MIEMBRO_NO_PARTICIPA' });
  });

  it('entrante no es participante activo → MIEMBRO_NO_PARTICIPA', async () => {
    const { service, prisma } = build();
    prisma.participantePrograma.findFirst.mockResolvedValue(null);
    await expect(service.reemplazar('g1', 'A', 'B')).rejects.toMatchObject({ code: 'MIEMBRO_NO_PARTICIPA' });
    expect(prisma.participantePrograma.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { programaId: 'p1', usuarioId: 'B', activo: true } }),
    );
  });

  it('entrante sin confirmadoEn → MIEMBRO_NO_CONFIRMADO', async () => {
    const { service, prisma } = build();
    prisma.participantePrograma.findFirst.mockResolvedValue({ id: 'pp1', confirmadoEn: null });
    await expect(service.reemplazar('g1', 'A', 'B')).rejects.toMatchObject({ code: 'MIEMBRO_NO_CONFIRMADO' });
  });

  it('entrante ya en otro grupo del programa → MIEMBRO_YA_EN_GRUPO', async () => {
    const { service, prisma } = build();
    prisma.miembroGrupo.findFirst.mockResolvedValue({ id: 'x' }); // saliente OK y entrante ya en grupo
    await expect(service.reemplazar('g1', 'A', 'B')).rejects.toMatchObject({ code: 'MIEMBRO_YA_EN_GRUPO' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('P2002 en la transacción → MIEMBRO_YA_EN_GRUPO (carrera concurrente)', async () => {
    const { service, prisma } = build();
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
    );
    await expect(service.reemplazar('g1', 'A', 'B')).rejects.toMatchObject({ code: 'MIEMBRO_YA_EN_GRUPO' });
  });

  it('grupo con exactamente 2 integrantes → OK (el reemplazo no consulta el conteo)', async () => {
    const { service, prisma } = build();
    prisma.miembroGrupo.count.mockResolvedValue(2);
    await expect(service.reemplazar('g1', 'A', 'B')).resolves.toBeUndefined();
    expect(prisma.miembroGrupo.count).not.toHaveBeenCalled();
  });

  it('caso feliz → $transaction con un delete y un create (programaId explícito)', async () => {
    const { service, prisma } = build();
    await service.reemplazar('g1', 'A', 'B');
    expect(prisma.miembroGrupo.delete).toHaveBeenCalledWith({ where: { id: 'mSaliente' } });
    expect(prisma.miembroGrupo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ grupoId: 'g1', programaId: 'p1', usuarioId: 'B' }),
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(['DELETE_OP', 'CREATE_OP']);
  });
});
