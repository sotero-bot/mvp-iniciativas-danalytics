/**
 * `EmailService.resend` (RNF-12 "reenvío manual") — reconstruye el email desde los
 * soft-refs de `NotificacionEmail` sin columnas nuevas, y reintenta sobre la MISMA fila.
 */

import { describe, it, expect, vi } from 'vitest';

import { EmailService } from '../../apps/api/src/modules/email/email.service';
import { AppError } from '../../apps/api/src/shared/errors/AppError';

function buildService(overrides: Record<string, unknown> = {}) {
  const transport = { send: vi.fn().mockResolvedValue(undefined) };
  const prismaMock = {
    notificacionEmail: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'n1',
        tipo: 'observacion_urgente',
        destinatario: 'admin@danalytics.co',
        observacionId: 'o1',
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    observacionFacilitador: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'o1',
        programaId: 'p1',
        tipo: 'baja_participacion',
        urgencia: 'urgente',
        texto: 'estudiante desconectado',
      }),
    },
    programa: { findUnique: vi.fn().mockResolvedValue({ id: 'p1', nombre: 'Programa X' }) },
    ...overrides,
  };
  const service = new EmailService(transport as any, prismaMock as any);
  return { service, transport, prismaMock };
}

describe('EmailService.resend', () => {
  it('NOTIFICACION_NOT_FOUND si la fila no existe', async () => {
    const { service } = buildService({
      notificacionEmail: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() },
    });
    await expect(service.resend('n1')).rejects.toMatchObject({ code: 'NOTIFICACION_NOT_FOUND' });
  });

  it('reconstruye el email de una observación urgente y reintenta sobre la misma fila', async () => {
    const { service, transport, prismaMock } = buildService();
    await service.resend('n1');
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'admin@danalytics.co' }),
    );
    expect(prismaMock.notificacionEmail.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'n1' },
        data: expect.objectContaining({ estado: 'enviada' }),
      }),
    );
  });

  it('marca fallida y relanza si el transporte falla', async () => {
    const { service, prismaMock } = buildService();
    const transport = { send: vi.fn().mockRejectedValue(new Error('smtp down')) };
    const service2 = new EmailService(transport as any, prismaMock as any);
    await expect(service2.resend('n1')).rejects.toThrow('smtp down');
    expect(prismaMock.notificacionEmail.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'fallida' }) }),
    );
  });

  it('VALIDATION_ERROR para tipos sin soporte de reenvío todavía (ej. magic_link)', async () => {
    const { service } = buildService({
      notificacionEmail: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'n2', tipo: 'magic_link', destinatario: 'u@x.com', observacionId: null }),
        update: vi.fn(),
      },
    });
    await expect(service.resend('n2')).rejects.toBeInstanceOf(AppError);
  });
});
