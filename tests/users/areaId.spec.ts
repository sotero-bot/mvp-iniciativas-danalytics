/**
 * HU-14: `AdminUsersController` acepta `areaId` (catálogo por empresa) en create/update,
 * lo valida contra la empresa del usuario y mantiene `area` (texto, deprecado) sincronizado.
 */

import { describe, it, expect, vi } from 'vitest';

import { AdminUsersController } from '../../apps/api/src/modules/users/interfaces/admin-users.controller';

function build(opts: { area?: any; existing?: any } = {}) {
  const area = opts.area === undefined ? { id: 'a1', empresaId: 'e1', nombre: 'Diseño' } : opts.area;
  const existing = { id: 'u1', empresaId: 'e1', role: { slug: 'estudiante' }, username: null, email: 'a@a.com', ...opts.existing };
  const prisma = {
    usuario: {
      findUnique: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...data, role: { slug: 'estudiante' } })),
      update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'u1', ...data, role: { slug: 'estudiante' } })),
    },
    role: { findUnique: vi.fn().mockResolvedValue({ id: 'r1', slug: 'estudiante' }) },
    areaEmpresa: { findUnique: vi.fn().mockResolvedValue(area) },
  };
  return { controller: new AdminUsersController(prisma as any, {} as any), prisma };
}

const nuevo = { nombre: 'Ana', role: 'estudiante', email: 'a@a.com', empresaId: 'e1' };

describe('AdminUsersController.create — areaId', () => {
  it('areaId de OTRA empresa → AREA_EMPRESA_INVALIDA y no crea', async () => {
    const { controller, prisma } = build({ area: { id: 'a1', empresaId: 'e2', nombre: 'Diseño' } });
    await expect(controller.create({ ...nuevo, areaId: 'a1' })).rejects.toMatchObject({ code: 'AREA_EMPRESA_INVALIDA' });
    expect(prisma.usuario.create).not.toHaveBeenCalled();
  });

  it('areaId inexistente → AREA_EMPRESA_INVALIDA', async () => {
    const { controller } = build({ area: null });
    await expect(controller.create({ ...nuevo, areaId: 'a1' })).rejects.toMatchObject({ code: 'AREA_EMPRESA_INVALIDA' });
  });

  it('areaId válido: guarda areaId y sincroniza `area` con el nombre del catálogo', async () => {
    const { controller, prisma } = build();
    await controller.create({ ...nuevo, areaId: 'a1', area: 'texto viejo' });
    expect(prisma.usuario.create.mock.calls[0][0].data).toMatchObject({ areaId: 'a1', area: 'Diseño' });
  });

  it('devuelve areaId y areaCatalogo en el select', async () => {
    const { controller, prisma } = build();
    await controller.create({ ...nuevo, areaId: 'a1' });
    const select = prisma.usuario.create.mock.calls[0][0].select;
    expect(select.areaId).toBe(true);
    expect(select.areaCatalogo).toEqual({ select: { id: true, nombre: true } });
  });
});

describe('AdminUsersController.update — areaId', () => {
  it('areaId de otra empresa → AREA_EMPRESA_INVALIDA y no actualiza', async () => {
    const { controller, prisma } = build({ area: { id: 'a1', empresaId: 'e2', nombre: 'X' } });
    await expect(controller.update('u1', { areaId: 'a1' })).rejects.toMatchObject({ code: 'AREA_EMPRESA_INVALIDA' });
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('valida contra la empresa NUEVA cuando el mismo PATCH cambia de empresa', async () => {
    const { controller } = build({ area: { id: 'a1', empresaId: 'e1', nombre: 'Diseño' } });
    await expect(controller.update('u1', { empresaId: 'e2', areaId: 'a1' })).rejects.toMatchObject({
      code: 'AREA_EMPRESA_INVALIDA',
    });
  });

  it('areaId válido: conecta la relación y sincroniza `area`', async () => {
    const { controller, prisma } = build();
    await controller.update('u1', { areaId: 'a1' });
    const data = prisma.usuario.update.mock.calls[0][0].data;
    expect(data.areaCatalogo).toEqual({ connect: { id: 'a1' } });
    expect(data.area).toBe('Diseño');
  });

  it('areaId null: desconecta y limpia `area`', async () => {
    const { controller, prisma } = build();
    await controller.update('u1', { areaId: null });
    const data = prisma.usuario.update.mock.calls[0][0].data;
    expect(data.areaCatalogo).toEqual({ disconnect: true });
    expect(data.area).toBeNull();
  });

  it('cambiar de empresa sin enviar areaId limpia el área (no puede quedar un área de otra empresa)', async () => {
    const { controller, prisma } = build();
    await controller.update('u1', { empresaId: 'e2' });
    const data = prisma.usuario.update.mock.calls[0][0].data;
    expect(data.areaCatalogo).toEqual({ disconnect: true });
    expect(data.area).toBeNull();
  });

  it('sin tocar empresa ni área, no modifica el área', async () => {
    const { controller, prisma } = build();
    await controller.update('u1', { nombre: 'Nuevo' });
    const data = prisma.usuario.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('areaCatalogo');
    expect(data).not.toHaveProperty('area');
  });
});
