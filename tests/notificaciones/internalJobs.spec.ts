/**
 * `InternalJobsController.notificarMaterialDisponible` (RF-40/§8 batch).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { InternalJobsController } from '../../apps/api/src/modules/notificaciones/interfaces/internal-jobs.controller';

const ORIGINAL_SECRET = process.env.CRON_SECRET;

beforeEach(() => {
  process.env.CRON_SECRET = 'test-secret';
});

afterEach(() => {
  process.env.CRON_SECRET = ORIGINAL_SECRET;
});

function buildController(overrides: Record<string, unknown> = {}) {
  const prismaMock = {
    sesion: { findMany: vi.fn().mockResolvedValue([]) },
    notificacionEmail: { findFirst: vi.fn().mockResolvedValue(null) },
    ...overrides,
  };
  const emailStub = { sendMaterialDisponible: vi.fn().mockResolvedValue(undefined) };
  return { controller: new InternalJobsController(prismaMock as any, emailStub as any), prismaMock, emailStub };
}

describe('InternalJobsController.notificarMaterialDisponible', () => {
  it('FORBIDDEN sin el secreto correcto', async () => {
    const { controller } = buildController();
    await expect(controller.notificarMaterialDisponible('Bearer wrong')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('FORBIDDEN si CRON_SECRET no está configurado', async () => {
    delete process.env.CRON_SECRET;
    const { controller } = buildController();
    await expect(controller.notificarMaterialDisponible('Bearer test-secret')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('notifica a los participantes activos de sesiones en la ventana', async () => {
    const { controller, emailStub } = buildController({
      sesion: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 's1',
            numeroSesion: 2,
            programaId: 'p1',
            programa: {
              nombre: 'Programa X',
              activo: true,
              participantes: [{ usuarioId: 'u1', usuario: { nombre: 'Ana', email: 'ana@x.com' } }],
            },
          },
        ]),
      },
    });
    const result = await controller.notificarMaterialDisponible('Bearer test-secret');
    expect(result).toEqual({ sesionesEnVentana: 1, notificados: 1 });
    expect(emailStub.sendMaterialDisponible).toHaveBeenCalledWith(
      'ana@x.com',
      'es',
      expect.objectContaining({ nombreUsuario: 'Ana', numeroSesion: 2 }),
      { programaId: 'p1', usuarioId: 'u1' },
    );
  });

  it('no duplica el envío si ya existe una NotificacionEmail reciente para ese usuario', async () => {
    const { controller, emailStub } = buildController({
      sesion: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 's1',
            numeroSesion: 2,
            programaId: 'p1',
            programa: {
              nombre: 'Programa X',
              activo: true,
              participantes: [{ usuarioId: 'u1', usuario: { nombre: 'Ana', email: 'ana@x.com' } }],
            },
          },
        ]),
      },
      notificacionEmail: { findFirst: vi.fn().mockResolvedValue({ id: 'existing' }) },
    });
    await controller.notificarMaterialDisponible('Bearer test-secret');
    expect(emailStub.sendMaterialDisponible).not.toHaveBeenCalled();
  });
});
