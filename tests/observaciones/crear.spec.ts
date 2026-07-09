/**
 * Lógica de negocio de `FacilitadorObservacionesController` (RF-39/40/41).
 */

import { describe, it, expect, vi } from 'vitest';

import { FacilitadorObservacionesController } from '../../apps/api/src/modules/observaciones/interfaces/facilitador-observaciones.controller';

const ACTOR = { sub: 'facil-1', userId: 'facil-1', role: 'facilitador' as const, empresaId: null };

function buildController(overrides: Record<string, unknown> = {}) {
  const prismaMock = {
    programa: { findUnique: vi.fn().mockResolvedValue({ id: 'p1', nombre: 'Programa X' }) },
    observacionFacilitador: {
      create: vi.fn().mockResolvedValue({
        id: 'o1',
        programaId: 'p1',
        tipo: 'baja_participacion',
        urgencia: 'normal',
        texto: 'algo',
      }),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([{ id: 'o1', autorId: 'facil-1' }]),
    },
    configuracionNotificacion: {
      findUnique: vi.fn().mockResolvedValue({ emails: ['admin@danalytics.co'] }),
    },
    ...overrides,
  };
  const scopeStub = { assertProgramaAccessible: vi.fn().mockResolvedValue(undefined) };
  const emailStub = { sendObservacion: vi.fn().mockResolvedValue(undefined) };
  const controller = new FacilitadorObservacionesController(
    prismaMock as any,
    scopeStub as any,
    emailStub as any,
  );
  return { controller, prismaMock, scopeStub, emailStub };
}

describe('FacilitadorObservacionesController.crear', () => {
  it('crea la observación y dispara el email a la lista configurada', async () => {
    const { controller, emailStub, prismaMock } = buildController();
    const result = await controller.crear('p1', { tipo: 'baja_participacion', texto: 'algo' }, ACTOR);
    expect(result).toMatchObject({ id: 'o1' });
    expect(emailStub.sendObservacion).toHaveBeenCalledWith(
      false,
      ['admin@danalytics.co'],
      expect.objectContaining({ programa: 'Programa X' }),
      { programaId: 'p1', observacionId: 'o1' },
    );
    expect(prismaMock.observacionFacilitador.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'o1' }, data: { notificadoEn: expect.any(Date) } }),
    );
  });

  it('no revierte la creación si el envío de email falla (best-effort)', async () => {
    const { controller, emailStub } = buildController();
    emailStub.sendObservacion.mockRejectedValue(new Error('smtp down'));
    const result = await controller.crear('p1', { tipo: 'otro', texto: 'algo' }, ACTOR);
    expect(result).toMatchObject({ id: 'o1' });
  });

  it('no envía email si la configuración de destinatarios está vacía', async () => {
    const { controller, emailStub } = buildController({
      configuracionNotificacion: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    await controller.crear('p1', { tipo: 'otro', texto: 'algo' }, ACTOR);
    expect(emailStub.sendObservacion).not.toHaveBeenCalled();
  });
});

describe('FacilitadorObservacionesController.listPropias (RF-41)', () => {
  it('filtra por autorId = actor.sub', async () => {
    const { controller, prismaMock } = buildController();
    await controller.listPropias('p1', ACTOR);
    expect(prismaMock.observacionFacilitador.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { programaId: 'p1', autorId: 'facil-1' } }),
    );
  });
});
