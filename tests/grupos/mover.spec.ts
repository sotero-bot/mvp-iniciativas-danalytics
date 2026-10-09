/**
 * HU-21/22 (ampliación 2026-10-09) · MiembrosGrupoService.mover / intercambiar:
 * pasar a un integrante de un grupo a otro del MISMO programa, o intercambiar a dos
 * integrantes de dos grupos. Sin mínimo de integrantes: el grupo de origen puede quedar con 1 o 0.
 */

import { describe, it, expect, vi } from 'vitest';

import { MiembrosGrupoService } from '../../apps/api/src/modules/grupos/application/miembros.service';

const GRUPOS: Record<string, any> = {
  g1: { id: 'g1', programaId: 'p1' },
  g2: { id: 'g2', programaId: 'p1' },
  gOtro: { id: 'gOtro', programaId: 'p2' },
};

function build(over: Record<string, any> = {}) {
  const prisma: any = {
    grupo: { findUnique: vi.fn().mockImplementation(({ where }: any) => Promise.resolve(GRUPOS[where.id] ?? null)) },
    miembroGrupo: {
      // por grupo+usuario: A está en g1; por programa+usuario: B está en g2
      findFirst: vi.fn().mockImplementation(({ where }: any) => {
        if (where.grupoId) return Promise.resolve(where.usuarioId === 'A' && where.grupoId === 'g1' ? { id: 'mA', grupoId: 'g1' } : null);
        return Promise.resolve(where.usuarioId === 'B' ? { id: 'mB', grupoId: 'g2' } : null);
      }),
      count: vi.fn().mockResolvedValue(2),
      update: vi.fn().mockImplementation((args: any) => ({ op: 'update', ...args })),
    },
    $transaction: vi.fn().mockResolvedValue([]),
    ...over,
  };
  return { service: new MiembrosGrupoService(prisma), prisma };
}

describe('MiembrosGrupoService.mover', () => {
  it('grupo de origen inexistente → GRUPO_NOT_FOUND', async () => {
    const { service } = build();
    await expect(service.mover('nope', 'A', 'g2')).rejects.toMatchObject({ code: 'GRUPO_NOT_FOUND' });
  });

  it('grupo destino inexistente → GRUPO_NOT_FOUND', async () => {
    const { service } = build();
    await expect(service.mover('g1', 'A', 'nope')).rejects.toMatchObject({ code: 'GRUPO_NOT_FOUND' });
  });

  it('origen === destino → GRUPO_MOVER_INVALIDO', async () => {
    const { service, prisma } = build();
    await expect(service.mover('g1', 'A', 'g1')).rejects.toMatchObject({ code: 'GRUPO_MOVER_INVALIDO' });
    expect(prisma.miembroGrupo.update).not.toHaveBeenCalled();
  });

  it('destino de OTRO programa → GRUPO_MOVER_INVALIDO', async () => {
    const { service, prisma } = build();
    await expect(service.mover('g1', 'A', 'gOtro')).rejects.toMatchObject({ code: 'GRUPO_MOVER_INVALIDO' });
    expect(prisma.miembroGrupo.update).not.toHaveBeenCalled();
  });

  it('el usuario no es miembro del grupo de origen → MIEMBRO_NO_PARTICIPA', async () => {
    const { service } = build();
    await expect(service.mover('g1', 'Z', 'g2')).rejects.toMatchObject({ code: 'MIEMBRO_NO_PARTICIPA' });
  });

  it('caso feliz → cambia solo el grupoId de la fila (programaId intacto)', async () => {
    const { service, prisma } = build();
    await expect(service.mover('g1', 'A', 'g2')).resolves.toBeUndefined();
    expect(prisma.miembroGrupo.update).toHaveBeenCalledWith({ where: { id: 'mA' }, data: { grupoId: 'g2' } });
  });

  it('el origen puede quedar con 1 o 0 integrantes: no se consulta el conteo', async () => {
    const { service, prisma } = build();
    prisma.miembroGrupo.count.mockResolvedValue(1);
    await expect(service.mover('g1', 'A', 'g2')).resolves.toBeUndefined();
    expect(prisma.miembroGrupo.count).not.toHaveBeenCalled();
  });
});

describe('MiembrosGrupoService.intercambiar', () => {
  it('grupo inexistente → GRUPO_NOT_FOUND', async () => {
    const { service } = build();
    await expect(service.intercambiar('nope', 'A', 'B')).rejects.toMatchObject({ code: 'GRUPO_NOT_FOUND' });
  });

  it('mismo usuario → GRUPO_MOVER_INVALIDO', async () => {
    const { service } = build();
    await expect(service.intercambiar('g1', 'A', 'A')).rejects.toMatchObject({ code: 'GRUPO_MOVER_INVALIDO' });
  });

  it('el primero no es miembro de ese grupo → MIEMBRO_NO_PARTICIPA', async () => {
    const { service } = build();
    await expect(service.intercambiar('g1', 'Z', 'B')).rejects.toMatchObject({ code: 'MIEMBRO_NO_PARTICIPA' });
  });

  it('el segundo no está en ningún grupo del programa → MIEMBRO_NO_PARTICIPA', async () => {
    const { service, prisma } = build();
    await expect(service.intercambiar('g1', 'A', 'Z2')).rejects.toMatchObject({ code: 'MIEMBRO_NO_PARTICIPA' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('el segundo está en el MISMO grupo → GRUPO_MOVER_INVALIDO', async () => {
    const { service, prisma } = build();
    prisma.miembroGrupo.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve(where.grupoId ? { id: 'mA', grupoId: 'g1' } : { id: 'mB', grupoId: 'g1' }),
    );
    await expect(service.intercambiar('g1', 'A', 'B')).rejects.toMatchObject({ code: 'GRUPO_MOVER_INVALIDO' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('caso feliz → $transaction con dos update que cruzan los grupos', async () => {
    const { service, prisma } = build();
    await expect(service.intercambiar('g1', 'A', 'B')).resolves.toBeUndefined();
    expect(prisma.miembroGrupo.update).toHaveBeenCalledWith({ where: { id: 'mA' }, data: { grupoId: 'g2' } });
    expect(prisma.miembroGrupo.update).toHaveBeenCalledWith({ where: { id: 'mB' }, data: { grupoId: 'g1' } });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect((prisma.$transaction as any).mock.calls[0][0]).toHaveLength(2);
  });
});
