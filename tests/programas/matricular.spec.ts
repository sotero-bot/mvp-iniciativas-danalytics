/**
 * Reglas de matrícula (aclaración 2026-07-15):
 *  - El estudiante es único por empresa: si el email/usuario ya pertenece a OTRA
 *    empresa, no puede matricularse aquí (USUARIO_OTRA_EMPRESA).
 *  - No se puede matricular dos veces en el mismo programa (PARTICIPANTE_DUPLICATE,
 *    respaldado por @@unique([programaId, usuarioId])).
 * Ver `AdminProgramasController.matricular`.
 */

import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@prisma/client';

import { AdminProgramasController } from '../../apps/api/src/modules/programas/interfaces/admin-programas.controller';

const PROGRAMA = { id: 'p1', empresaId: 'e1', timezone: 'America/Bogota' };

function buildController(overrides: {
  usuariosPorEmail?: any[];
  usuarioPorId?: any;
  participanteCreate?: () => Promise<any>;
} = {}) {
  const participanteCreate =
    overrides.participanteCreate ??
    (({ data }: any) => Promise.resolve({ id: 'part1', ...data }));
  const prismaMock = {
    programa: {
      findUnique: vi.fn().mockResolvedValue(PROGRAMA),
    },
    usuario: {
      findMany: vi.fn().mockResolvedValue(overrides.usuariosPorEmail ?? []),
      findUnique: vi.fn().mockResolvedValue(overrides.usuarioPorId ?? null),
      create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'u-new', ...data })),
    },
    role: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'role-estudiante' }),
    },
    participantePrograma: {
      create: vi.fn().mockImplementation(participanteCreate),
    },
  };
  const magicLinkMock = { createAndSend: vi.fn().mockResolvedValue(undefined) };
  const controller = new AdminProgramasController(
    prismaMock as any,
    magicLinkMock as any,
    {} as any,
    {} as any,
  );
  return { controller, prismaMock };
}

describe('AdminProgramasController.matricular — unicidad por empresa', () => {
  it('reutiliza al estudiante existente si el email ya está en la MISMA empresa', async () => {
    const { controller, prismaMock } = buildController({
      usuariosPorEmail: [{ id: 'u1', empresaId: 'e1', role: { slug: 'estudiante' } }],
    });
    await controller.matricular('p1', { email: 'a@a.com', enviarInvitacion: false } as any);
    expect(prismaMock.usuario.create).not.toHaveBeenCalled();
    expect(prismaMock.participantePrograma.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ usuarioId: 'u1' }) }),
    );
  });

  it('bloquea si el email pertenece a OTRA empresa (USUARIO_OTRA_EMPRESA)', async () => {
    const { controller, prismaMock } = buildController({
      usuariosPorEmail: [{ id: 'u9', empresaId: 'e2', role: { slug: 'estudiante' } }],
    });
    await expect(
      controller.matricular('p1', { email: 'a@a.com', nombre: 'Ana', enviarInvitacion: false } as any),
    ).rejects.toMatchObject({ code: 'USUARIO_OTRA_EMPRESA' });
    expect(prismaMock.usuario.create).not.toHaveBeenCalled();
    expect(prismaMock.participantePrograma.create).not.toHaveBeenCalled();
  });

  it('permite matricular al mismo estudiante en OTRO programa de la misma empresa', async () => {
    // El estudiante ya existe en la empresa e1 (matriculado en otro programa).
    // Al matricularlo en p1 (también de e1) se reutiliza el usuario y se crea
    // una nueva fila de participante, sin crear un usuario duplicado.
    const { controller, prismaMock } = buildController({
      usuariosPorEmail: [{ id: 'u1', empresaId: 'e1', role: { slug: 'estudiante' } }],
    });
    await controller.matricular('p1', { email: 'a@a.com', enviarInvitacion: false } as any);
    expect(prismaMock.usuario.create).not.toHaveBeenCalled();
    expect(prismaMock.participantePrograma.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ programaId: 'p1', usuarioId: 'u1' }) }),
    );
  });

  it('crea un estudiante nuevo si el email no existe en ninguna empresa', async () => {
    const { controller, prismaMock } = buildController({ usuariosPorEmail: [] });
    await controller.matricular('p1', { email: 'nuevo@a.com', nombre: 'Nuevo', enviarInvitacion: false } as any);
    expect(prismaMock.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: 'nuevo@a.com', empresaId: 'e1' }) }),
    );
    // El participante se crea con el id del usuario recién creado.
    const nuevoId = prismaMock.usuario.create.mock.calls[0][0].data.id;
    expect(prismaMock.participantePrograma.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ usuarioId: nuevoId }) }),
    );
  });

  it('bloquea por usuarioId si el usuario pertenece a otra empresa', async () => {
    const { controller } = buildController({
      usuarioPorId: { id: 'u5', empresaId: 'e2', role: { slug: 'estudiante' } },
    });
    await expect(
      controller.matricular('p1', { usuarioId: 'u5', enviarInvitacion: false } as any),
    ).rejects.toMatchObject({ code: 'USUARIO_OTRA_EMPRESA' });
  });

  it('acepta por usuarioId si el usuario es de la misma empresa', async () => {
    const { controller, prismaMock } = buildController({
      usuarioPorId: { id: 'u5', empresaId: 'e1', role: { slug: 'estudiante' } },
    });
    await controller.matricular('p1', { usuarioId: 'u5', enviarInvitacion: false } as any);
    expect(prismaMock.participantePrograma.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ usuarioId: 'u5' }) }),
    );
  });

  it('no permite matricular dos veces en el mismo programa (PARTICIPANTE_DUPLICATE)', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: '5.22.0',
    });
    const { controller } = buildController({
      usuarioPorId: { id: 'u5', empresaId: 'e1', role: { slug: 'estudiante' } },
      participanteCreate: () => Promise.reject(p2002),
    });
    await expect(
      controller.matricular('p1', { usuarioId: 'u5', enviarInvitacion: false } as any),
    ).rejects.toMatchObject({ code: 'PARTICIPANTE_DUPLICATE' });
  });
});
