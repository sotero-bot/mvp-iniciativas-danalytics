/**
 * Fase 4 (Plan 2 §4.1/§4.5 — RNF-13): bitácora de auditoría APPEND-ONLY.
 * El interceptor global registra cada acción de facilitador/estudiante/roles
 * cliente (y las mutaciones del admin); la lectura del log es SOLO de
 * danalytics_admin y no existe ningún endpoint de escritura sobre el log.
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { lastValueFrom, of } from 'rxjs';

import { ROLES_KEY } from '../../apps/api/src/modules/auth/guards';
import { AdminRegistroAccesoController } from '../../apps/api/src/modules/auditoria/interfaces/admin-registro-acceso.controller';
import { RegistroAccesoInterceptor } from '../../apps/api/src/modules/auditoria/registro-acceso.interceptor';

function buildInterceptor(overrides: Record<string, any> = {}) {
  const prisma = {
    registroAcceso: { create: vi.fn().mockResolvedValue({}) },
    ...overrides.prisma,
  };
  return { interceptor: new RegistroAccesoInterceptor(prisma as any), prisma };
}

function httpContext(req: Record<string, unknown>) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
}

const NEXT = { handle: () => of({ ok: true }) } as any;

describe('Autorización del visor (§0.1, RNF-13)', () => {
  it('AdminRegistroAccesoController declara @Roles(danalytics_admin)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminRegistroAccesoController)).toEqual(['danalytics_admin']);
  });

  it('append-only: el controller SOLO expone lectura (ningún handler de escritura)', () => {
    const handlers = Object.getOwnPropertyNames(AdminRegistroAccesoController.prototype).filter(
      n => n !== 'constructor',
    );
    expect(handlers).toEqual(['list']);
  });
});

describe('RegistroAccesoInterceptor (RNF-13)', () => {
  it('registra la acción de un rol de portal (GET) con usuario, rol, recurso, IP y user-agent', async () => {
    const { interceptor, prisma } = buildInterceptor();
    const req = {
      method: 'GET',
      originalUrl: '/api/programas/11111111-2222-3333-4444-555555555555/sesiones?x=1',
      params: { id: '11111111-2222-3333-4444-555555555555' },
      ip: '10.0.0.9',
      headers: { 'user-agent': 'vitest' },
      user: { sub: 'est1', role: 'estudiante', empresaId: null },
    };
    const result = await lastValueFrom(interceptor.intercept(httpContext(req), NEXT));

    expect(result).toEqual({ ok: true });
    expect(prisma.registroAcceso.create).toHaveBeenCalledWith({
      data: {
        usuarioId: 'est1',
        role: 'estudiante',
        accion: 'ver_sesion',
        tipoRecurso: 'sesion',
        recursoId: '11111111-2222-3333-4444-555555555555',
        ipAddress: '10.0.0.9',
        userAgent: 'vitest',
      },
    });
  });

  it('acciones con nombre propio: POST/DELETE de /portal/usuarios-cliente (RF-44/45)', async () => {
    const { interceptor, prisma } = buildInterceptor();
    await lastValueFrom(interceptor.intercept(
      httpContext({
        method: 'POST',
        originalUrl: '/api/portal/usuarios-cliente',
        params: {},
        ip: '1.1.1.1',
        headers: {},
        user: { sub: 'cli1', role: 'cliente_admin', empresaId: 'emp1' },
      }),
      NEXT,
    ));
    expect(prisma.registroAcceso.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accion: 'invitar_usuario_cliente', tipoRecurso: 'usuario_cliente' }),
      }),
    );
  });

  it('NO registra los GET del admin (solo sus mutaciones — Plan 1 §9)', async () => {
    const { interceptor, prisma } = buildInterceptor();
    await lastValueFrom(interceptor.intercept(
      httpContext({
        method: 'GET',
        originalUrl: '/api/admin/programas',
        params: {},
        headers: {},
        user: { sub: 'adm1', role: 'danalytics_admin', empresaId: null },
      }),
      NEXT,
    ));
    expect(prisma.registroAcceso.create).not.toHaveBeenCalled();

    await lastValueFrom(interceptor.intercept(
      httpContext({
        method: 'POST',
        originalUrl: '/api/admin/usuarios',
        params: {},
        headers: {},
        user: { sub: 'adm1', role: 'danalytics_admin', empresaId: null },
      }),
      NEXT,
    ));
    expect(prisma.registroAcceso.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accion: 'crear_usuario', role: 'danalytics_admin' }),
      }),
    );
  });

  it('NO registra requests sin actor autenticado (rutas públicas)', async () => {
    const { interceptor, prisma } = buildInterceptor();
    await lastValueFrom(interceptor.intercept(
      httpContext({ method: 'POST', originalUrl: '/api/auth/login', params: {}, headers: {} }),
      NEXT,
    ));
    expect(prisma.registroAcceso.create).not.toHaveBeenCalled();
  });

  it('un fallo al escribir el log NUNCA rompe la respuesta (best-effort)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { interceptor } = buildInterceptor({
      prisma: { registroAcceso: { create: vi.fn().mockRejectedValue(new Error('bd caída')) } },
    });
    const result = await lastValueFrom(interceptor.intercept(
      httpContext({
        method: 'GET',
        originalUrl: '/api/facilitador/programas/x/grupos',
        params: {},
        headers: {},
        user: { sub: 'fac1', role: 'facilitador', empresaId: null },
      }),
      NEXT,
    ));
    expect(result).toEqual({ ok: true });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('GET /admin/registro-acceso (RNF-13, solo lectura)', () => {
  function buildController(overrides: Record<string, any> = {}) {
    const prisma = {
      registroAcceso: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'ra1', usuarioId: 'u1', role: 'estudiante', accion: 'ver_programa',
            tipoRecurso: 'programa', recursoId: 'p1', ipAddress: null, userAgent: null,
            creadoEn: new Date('2026-07-09'),
          },
        ]),
      },
      usuario: { findMany: vi.fn().mockResolvedValue([{ id: 'u1', nombre: 'Ana', email: 'ana@x.co' }]) },
      ...overrides.prisma,
    };
    return { controller: new AdminRegistroAccesoController(prisma as any), prisma };
  }

  it('filtra por usuarioId/role/accion/tipoRecurso y pagina', async () => {
    const { controller, prisma } = buildController();
    const result = await controller.list('u1', 'estudiante', 'ver_programa', 'programa', undefined, undefined, '10', '20');

    expect(prisma.registroAcceso.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { usuarioId: 'u1', role: 'estudiante', accion: 'ver_programa', tipoRecurso: 'programa' },
        orderBy: { creadoEn: 'desc' },
        take: 10,
        skip: 20,
      }),
    );
    expect(result.total).toBe(1);
    expect(result.filas[0].usuario).toEqual({ id: 'u1', nombre: 'Ana', email: 'ana@x.co' });
  });

  it('acota el tamaño de página al máximo permitido', async () => {
    const { controller, prisma } = buildController();
    await controller.list(undefined, undefined, undefined, undefined, undefined, undefined, '9999', undefined);
    expect(prisma.registroAcceso.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }));
  });
});
