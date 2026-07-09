/**
 * Lógica de negocio de `AdminAsistenciaController` — RF-19 (admin sin límite 24h),
 * RF-20 (resumen), RN-09 (cliente acotado a su empresa).
 */

import { describe, it, expect, vi } from 'vitest';

import { AdminAsistenciaController } from '../../apps/api/src/modules/asistencia/interfaces/admin-asistencia.controller';

const ADMIN = { sub: 'a1', userId: 'a1', role: 'danalytics_admin' as const, empresaId: null };
const CLIENTE_OTRA_EMPRESA = {
  sub: 'c1',
  userId: 'c1',
  role: 'cliente_admin' as const,
  empresaId: 'empresa-x',
};
const CLIENTE_MISMA_EMPRESA = {
  sub: 'c2',
  userId: 'c2',
  role: 'cliente_admin' as const,
  empresaId: 'empresa-1',
};

function buildController() {
  const prismaMock = {
    programa: { findUnique: vi.fn().mockResolvedValue({ id: 'p1', empresaId: 'empresa-1' }) },
    asistencia: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([
        { usuarioId: 'u1', sesionId: 'sesA', presente: true },
        { usuarioId: 'u1', sesionId: 'sesB', presente: false },
      ]),
    },
    sesion: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'sesA', numeroSesion: 1 },
        { id: 'sesB', numeroSesion: 2 },
      ]),
    },
    participantePrograma: {
      findMany: vi.fn().mockResolvedValue([
        { usuarioId: 'u1', usuario: { id: 'u1', nombre: 'Ana', email: 'ana@x.com' } },
      ]),
    },
  };
  return { controller: new AdminAsistenciaController(prismaMock as any), prismaMock };
}

describe('AdminAsistenciaController.updateAsistencia', () => {
  it('ASISTENCIA_NOT_FOUND si el registro no existe', async () => {
    const { controller } = buildController();
    await expect(controller.updateAsistencia('a-x', { presente: true })).rejects.toMatchObject({
      code: 'ASISTENCIA_NOT_FOUND',
    });
  });
});

describe('AdminAsistenciaController.resumen (RN-09)', () => {
  it('FORBIDDEN si el cliente pide un programa de otra empresa', async () => {
    const { controller } = buildController();
    await expect(controller.resumen('p1', CLIENTE_OTRA_EMPRESA)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('calcula el % de asistencia por participante sobre el total de sesiones', async () => {
    const { controller } = buildController();
    const resumen = await controller.resumen('p1', CLIENTE_MISMA_EMPRESA);
    expect(resumen.filas).toHaveLength(1);
    expect(resumen.filas[0].porcentaje).toBe(0.5); // 1 de 2 sesiones presente
  });

  it('admin ve el resumen de cualquier empresa', async () => {
    const { controller } = buildController();
    const resumen = await controller.resumen('p1', ADMIN);
    expect(resumen.filas).toHaveLength(1);
  });
});
