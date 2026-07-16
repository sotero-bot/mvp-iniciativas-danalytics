/**
 * C-05 (multiuso 24 h, deroga RN-08/RNF-05) y C-06 (informar "usuario no existe")
 * — aclaraciones 2026-07-14. Unit sobre MagicLinkService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MagicLinkService } from '../../apps/api/src/modules/auth/application/magic-link.service';

const RAW_TOKEN = 'a'.repeat(40); // length ≥ 20 requerido por consume()

function build(overrides: Record<string, any> = {}) {
  const prisma: any = {
    magicLink: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    usuario: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
    ...overrides.prisma,
  };
  const jwt: any = { sign: vi.fn().mockReturnValue('signed.jwt') };
  const email: any = { createAndSend: vi.fn() };
  const svc = new MagicLinkService(prisma as any, jwt as any, email as any);
  // createAndSend real usa prisma/email; lo espiamos para requestByEmail.
  const createSpy = vi.spyOn(svc, 'createAndSend').mockResolvedValue({ id: 'ml1', expiraEn: new Date() } as any);
  return { svc, prisma, jwt, createSpy };
}

const USUARIO = { id: 'u1', nombre: 'Ana', email: 'ana@x.com', empresaId: 'e1', activo: true, puedeIniciarSesion: true, role: { slug: 'estudiante', nombre: 'Estudiante' } };

describe('C-05 · consume() multiuso', () => {
  it('un link YA usado pero no expirado sigue sirviendo (multiuso)', async () => {
    const { svc } = build({
      prisma: {
        magicLink: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ml1',
            usadoEn: new Date(Date.now() - 3_600_000), // ya usado hace 1h
            expiraEn: new Date(Date.now() + 3_600_000), // vigente
            usuario: USUARIO,
            propositoRedirect: null,
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      },
    });
    const res = await svc.consume(RAW_TOKEN);
    expect(res.accessToken).toBe('signed.jwt');
  });

  it('un link EXPIRADO sí falla (MAGIC_LINK_EXPIRADO)', async () => {
    const { svc } = build({
      prisma: {
        magicLink: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ml1', usadoEn: null, expiraEn: new Date(Date.now() - 1000), usuario: USUARIO, propositoRedirect: null,
          }),
          update: vi.fn(),
        },
      },
    });
    await expect(svc.consume(RAW_TOKEN)).rejects.toMatchObject({ code: 'MAGIC_LINK_EXPIRADO' });
  });
});

describe('C-06 · requestByEmail() informa si el usuario no existe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('correo NO registrado → USUARIO_NO_REGISTRADO', async () => {
    const { svc } = build(); // findUnique/findFirst → null
    await expect(svc.requestByEmail('desconocido@x.com')).rejects.toMatchObject({
      code: 'USUARIO_NO_REGISTRADO',
    });
  });

  it('correo registrado y activo → envía el link (createAndSend)', async () => {
    const { svc, createSpy } = build({
      prisma: {
        magicLink: { findUnique: vi.fn(), update: vi.fn() },
        usuario: { findUnique: vi.fn().mockResolvedValue(USUARIO), findFirst: vi.fn() },
      },
    });
    await svc.requestByEmail('ana@x.com');
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: 'u1' }));
  });
});
