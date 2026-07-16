/**
 * `ActorSesionesController` — gating de sesiones (RF-06/08/09) y URL firmada (RNF-03/08).
 */

import { describe, it, expect, vi } from 'vitest';
import 'reflect-metadata';

import { ActorSesionesController } from '../../apps/api/src/modules/sesiones/interfaces/actor-sesiones.controller';
import { ROLES_KEY } from '../../apps/api/src/modules/auth/guards';

const FACILITADOR = { sub: 'f1', userId: 'f1', role: 'facilitador' as const, empresaId: null };
const ESTUDIANTE = { sub: 'e1', userId: 'e1', role: 'estudiante' as const, empresaId: null };

function buildController(sesionOverrides: Record<string, unknown> = {}) {
  const prismaMock = {
    sesion: {
      findUnique: vi.fn().mockResolvedValue({
        id: 's1',
        programaId: 'p1',
        fechaProgramada: new Date('2020-01-01T00:00:00Z'),
        materialDesbloqueoEn: new Date('2020-01-02T00:01:00Z'),
        materialArchivoKey: 'k1',
        urlPresentacion: 'https://slides',
        urlGrabacion: 'https://vid',
        ...sesionOverrides,
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    programa: {
      findUnique: vi.fn().mockResolvedValue({
        facilitadores: [{ usuario: { id: 'f1', nombre: 'Faci Uno' } }],
      }),
    },
  };
  const scopeStub = { assertProgramaAccessible: vi.fn().mockResolvedValue(undefined) };
  const s3Stub = { getPresignedGetUrl: vi.fn().mockResolvedValue('https://signed-url') };
  const controller = new ActorSesionesController(prismaMock as any, scopeStub as any, s3Stub as any);
  return { controller, prismaMock, scopeStub, s3Stub };
}

describe('Autorización de ActorSesionesController', () => {
  it('declara @Roles(facilitador, estudiante)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ActorSesionesController)).toEqual([
      'facilitador',
      'estudiante',
    ]);
  });
});

describe('ActorSesionesController.getMaterial', () => {
  it('SESION_NOT_FOUND si la sesión no existe', async () => {
    const { controller, prismaMock } = buildController();
    prismaMock.sesion.findUnique.mockResolvedValue(null);
    await expect(controller.getMaterial('s1', FACILITADOR)).rejects.toMatchObject({
      code: 'SESION_NOT_FOUND',
    });
  });

  it('C-03: SESION_BLOQUEADA para facilitador si la sesión es a más de 7 días', async () => {
    const { controller } = buildController({ fechaProgramada: new Date(Date.now() + 8 * 86_400_000) });
    await expect(controller.getMaterial('s1', FACILITADOR)).rejects.toMatchObject({
      code: 'SESION_BLOQUEADA',
    });
  });

  it('C-03: el facilitador SÍ ve el material dentro de la ventana de 7 días', async () => {
    const { controller } = buildController({ fechaProgramada: new Date(Date.now() + 3 * 86_400_000) });
    const result = await controller.getMaterial('s1', FACILITADOR);
    expect(result).toMatchObject({ url: 'https://signed-url' });
  });

  it('facilitador accede al material de una sesión pasada (URL firmada ≤1h por default)', async () => {
    const { controller, s3Stub } = buildController();
    const result = await controller.getMaterial('s1', FACILITADOR);
    expect(result).toEqual({
      url: 'https://signed-url',
      urlPresentacion: 'https://slides',
      urlGrabacion: 'https://vid',
    });
    expect(s3Stub.getPresignedGetUrl).toHaveBeenCalledWith('k1', 3600);
  });

  it('SESION_BLOQUEADA para estudiante si materialDesbloqueoEn no ha llegado', async () => {
    const { controller } = buildController({ materialDesbloqueoEn: new Date(Date.now() + 86_400_000) });
    await expect(controller.getMaterial('s1', ESTUDIANTE)).rejects.toMatchObject({
      code: 'SESION_BLOQUEADA',
    });
  });

  it('SESION_BLOQUEADA para estudiante si materialDesbloqueoEn es null', async () => {
    const { controller } = buildController({ materialDesbloqueoEn: null });
    await expect(controller.getMaterial('s1', ESTUDIANTE)).rejects.toMatchObject({
      code: 'SESION_BLOQUEADA',
    });
  });

  it('estudiante accede al material una vez pasado materialDesbloqueoEn', async () => {
    const { controller } = buildController();
    const result = await controller.getMaterial('s1', ESTUDIANTE);
    expect(result.url).toBe('https://signed-url');
  });

  it('devuelve url null si la sesión no tiene materialArchivoKey', async () => {
    const { controller } = buildController({ materialArchivoKey: null });
    const result = await controller.getMaterial('s1', ESTUDIANTE);
    expect(result.url).toBeNull();
  });

  it('devuelve la URL de la presentación junto al material (mismo gating)', async () => {
    const { controller } = buildController();
    const result = await controller.getMaterial('s1', ESTUDIANTE);
    expect(result.urlPresentacion).toBe('https://slides');
  });

  it('propaga el 403 de scoping (programa ajeno o gracia vencida)', async () => {
    const { controller, scopeStub } = buildController();
    scopeStub.assertProgramaAccessible.mockRejectedValue({ code: 'FORBIDDEN' });
    await expect(controller.getMaterial('s1', FACILITADOR)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('ActorSesionesController.listMisProgramas', () => {
  it('usa el fragmento WHERE de ActorScopeService.programaScope', async () => {
    const prismaMock = {
      programa: { findMany: vi.fn().mockResolvedValue([{ id: 'p1' }]) },
    };
    const scope = { facilitadores: { some: { usuarioId: 'f1' } } };
    const scopeStub = { programaScope: vi.fn().mockReturnValue(scope) };
    const controller = new ActorSesionesController(prismaMock as any, scopeStub as any, {} as any);
    const result = await controller.listMisProgramas(FACILITADOR);
    expect(result).toEqual([{ id: 'p1' }]);
    expect(scopeStub.programaScope).toHaveBeenCalledWith(FACILITADOR);
    expect(prismaMock.programa.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: scope }),
    );
  });
});

describe('ActorSesionesController.listSesiones', () => {
  it('C-03: bloqueada solo para sesiones a más de 7 días (facilitador)', async () => {
    const { controller, prismaMock } = buildController();
    prismaMock.sesion.findMany.mockResolvedValue([
      { id: 's1', fechaProgramada: new Date(Date.now() + 8 * 86_400_000), materialDesbloqueoEn: null }, // >7d → bloqueada
      { id: 's2', fechaProgramada: new Date(Date.now() + 3 * 86_400_000), materialDesbloqueoEn: null }, // dentro de 7d → visible
      { id: 's3', fechaProgramada: new Date(Date.now() - 86_400_000), materialDesbloqueoEn: null }, // pasada → visible
    ]);
    const result = await controller.listSesiones('p1', FACILITADOR);
    expect(result).toEqual([
      expect.objectContaining({ id: 's1', bloqueada: true }),
      expect.objectContaining({ id: 's2', bloqueada: false }),
      expect.objectContaining({ id: 's3', bloqueada: false }),
    ]);
  });

  it('C-01: adjunta los facilitadores del programa a cada sesión (visible aunque esté bloqueada)', async () => {
    const { controller, prismaMock } = buildController();
    prismaMock.sesion.findMany.mockResolvedValue([
      { id: 's1', fechaProgramada: new Date(Date.now() + 8 * 86_400_000), materialDesbloqueoEn: null }, // bloqueada
    ]);
    const result = await controller.listSesiones('p1', ESTUDIANTE);
    expect(result[0]).toMatchObject({
      id: 's1',
      bloqueada: true,
      facilitadores: [{ id: 'f1', nombre: 'Faci Uno' }],
    });
  });

  it('oculta presentación y grabación de las sesiones bloqueadas (gating servidor)', async () => {
    const { controller, prismaMock } = buildController();
    prismaMock.sesion.findMany.mockResolvedValue([
      {
        id: 's1', // >7d → bloqueada para facilitador
        fechaProgramada: new Date(Date.now() + 8 * 86_400_000),
        materialDesbloqueoEn: null,
        urlPresentacion: 'https://slides',
        urlGrabacion: 'https://vid',
      },
      {
        id: 's2', // dentro de 7d → visible
        fechaProgramada: new Date(Date.now() + 3 * 86_400_000),
        materialDesbloqueoEn: null,
        urlPresentacion: 'https://slides',
        urlGrabacion: 'https://vid',
      },
    ]);
    const result = await controller.listSesiones('p1', FACILITADOR);
    expect(result[0]).toMatchObject({ id: 's1', bloqueada: true, urlPresentacion: null, urlGrabacion: null });
    expect(result[1]).toMatchObject({
      id: 's2',
      bloqueada: false,
      urlPresentacion: 'https://slides',
      urlGrabacion: 'https://vid',
    });
  });
});
