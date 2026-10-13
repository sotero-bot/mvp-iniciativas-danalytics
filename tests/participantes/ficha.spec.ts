/**
 * HU-16 — Ficha del estudiante (facilitador + cliente).
 *
 * Los casos 1-3 son de RECORTE y se afirman sobre `JSON.stringify(resultado)`, no sobre los
 * tipos: un tipo de TypeScript no impide que un campo extra viaje en runtime, y esto es lo que
 * protege RN-06 (feedback anónimo), RN-07 (el cliente no descarga entregables) y RNF-04
 * (scores nunca salen a roles ≠ admin). Los mocks incluyen campos "envenenados" a propósito.
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';

import { RolesGuard, ROLES_KEY } from '../../apps/api/src/modules/auth/guards';
import { CLIENTE_ROLE_SLUGS } from '../../apps/api/src/modules/auth/guards/auth-user';
import { FacilitadorParticipantesController } from '../../apps/api/src/modules/participantes/interfaces/facilitador-participantes.controller';

import { FichaEstudianteService } from '../../apps/api/src/modules/participantes/application/ficha-estudiante.service';

const PROGRAMA_ID = 'prog1';
const USUARIO_ID = 'est1';

function buildService(overrides: { asistencia?: any; plantillas?: any[] } = {}) {
  const prisma = {
    participantePrograma: {
      findFirst: vi.fn().mockResolvedValue({
        activo: true,
        confirmadoEn: new Date('2026-09-01'),
        usuario: {
          id: USUARIO_ID,
          nombre: 'Ana Pérez',
          email: 'ana@acme.com',
          cargo: 'Analista',
          areaCatalogo: { id: 'ar1', nombre: 'Finanzas' },
        },
      }),
    },
    programa: {
      findUnique: vi.fn().mockResolvedValue({
        id: PROGRAMA_ID,
        nombre: 'IA en Acción',
        bitacoraHabilitadaEn: null,
        presentacionDesdeSesion: null,
        sesiones: [{ numeroSesion: 1, fechaProgramada: new Date('2026-09-10') }],
      }),
    },
    plantillaFormulario: {
      findMany: vi.fn().mockResolvedValue(
        overrides.plantillas ?? [
          {
            id: 'pl-final',
            nombre: 'Diagnóstico final',
            programaId: PROGRAMA_ID,
            tipoFormulario: 'diagnostico_final',
            sesiones: [{ sesion: { numeroSesion: 3 } }],
            respuestas: [
              {
                estado: 'submitted',
                enviadoEn: new Date('2026-09-20'),
                datosRespuestaJson: { secreto: 'POISON_DATOS' },
                scoresPorDimensionJson: { liderazgo: 9 },
              },
            ],
          },
          {
            id: 'pl-feedback',
            nombre: 'Feedback de la sesión',
            programaId: PROGRAMA_ID,
            tipoFormulario: 'feedback',
            sesiones: [{ sesion: { numeroSesion: 1 } }],
            respuestas: [{ estado: 'submitted', enviadoEn: new Date('2026-09-11') }],
          },
          {
            id: 'pl-snapshot',
            nombre: 'Snapshot diagnóstico inicial',
            programaId: PROGRAMA_ID,
            tipoFormulario: 'diagnostico_inicial',
            sesiones: [],
            respuestas: [],
          },
        ],
      ),
    },
    grupo: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'g1',
        nombre: 'Grupo 1',
        finalizadoEn: null,
        miembros: [
          { usuario: { id: USUARIO_ID, nombre: 'Ana Pérez', email: 'ana@acme.com' } },
          { usuario: { id: 'est2', nombre: 'Luis Gómez', email: 'luis@acme.com' } },
        ],
        presentacionFinal: {
          entregadoEn: new Date('2026-10-01'),
          urlPresentacion: 'https://slides.example/deck',
          archivoKey: 'secret/key.pdf',
        },
        respuestasFormulario: [{ id: 'r1' }],
      }),
    },
  };
  const asistenciaResumen = {
    build: vi.fn().mockResolvedValue(
      overrides.asistencia ?? {
        sesiones: [
          { id: 's1', numeroSesion: 1, titulo: 'Intro', fechaProgramada: new Date('2026-09-10') },
        ],
        filas: [{ usuarioId: USUARIO_ID, nombre: 'Ana Pérez', email: 'ana@acme.com', area: 'Finanzas', porSesion: { s1: true }, porcentaje: 1 }],
      },
    ),
  };
  return { service: new FichaEstudianteService(prisma as any, asistenciaResumen as any), prisma, asistenciaResumen };
}

describe('Ficha del estudiante — recorte (RN-06 / RN-07 / RNF-04)', () => {
  it('1. ficha de CLIENTE: el JSON no contiene entregable, archivo, scores ni respuestas', async () => {
    const { service } = buildService();
    const ficha = await service.build(PROGRAMA_ID, USUARIO_ID, { verEntregable: false });
    const json = JSON.stringify(ficha);
    for (const prohibido of [
      'urlPresentacion',
      'conArchivo',
      'archivoKey',
      'scoresPorDimensionJson',
      'datosRespuestaJson',
      'https://slides.example/deck',
      'secret/key.pdf',
      'POISON_DATOS',
    ]) {
      expect(json).not.toContain(prohibido);
    }
  });

  it('2. ficha de FACILITADOR: ve el entregable, nunca archivoKey ni scores', async () => {
    const { service } = buildService();
    const ficha = await service.build(PROGRAMA_ID, USUARIO_ID, { verEntregable: true });
    const json = JSON.stringify(ficha);
    expect(json).toContain('urlPresentacion');
    expect(json).toContain('conArchivo');
    for (const prohibido of ['archivoKey', 'secret/key.pdf', 'scoresPorDimensionJson', 'datosRespuestaJson', 'POISON_DATOS']) {
      expect(json).not.toContain(prohibido);
    }
  });

  it('3. los formularios de ambas fichas no incluyen feedback (RN-06) ni el snapshot inicial', async () => {
    for (const verEntregable of [true, false]) {
      const { service } = buildService();
      const ficha = await service.build(PROGRAMA_ID, USUARIO_ID, { verEntregable });
      const json = JSON.stringify(ficha);
      expect(json).not.toContain('feedback');
      expect(json).not.toContain('Feedback de la sesión');
      expect(json).not.toContain('Snapshot diagnóstico inicial');
      expect(ficha.formularios.map((f) => f.plantillaId)).toEqual(['pl-final']);
    }
  });
});

// ── Autorización de los endpoints de cliente (C-07 / RN-09) ─────────────────────────────────

import { ClienteParticipantesController } from '../../apps/api/src/modules/participantes/interfaces/cliente-participantes.controller';

const CLIENTE_ADMIN = { sub: 'ca1', role: 'cliente_admin', empresaId: 'emp1' } as any;
const USUARIO_CLIENTE_SIN_ASIGNAR = { sub: 'uc1', role: 'usuario_cliente', empresaId: 'emp1' } as any;
const CLIENTE_OTRA_EMPRESA = { sub: 'ca2', role: 'cliente_admin', empresaId: 'emp-otra' } as any;

/** Prisma que evalúa el scope real de `assertProgramaCliente` (empresa + asignación). */
function buildClienteController() {
  const prisma = {
    programa: {
      findFirst: vi.fn(async ({ where }: any) => {
        const condiciones: any[] = where.AND;
        const scope = condiciones.find((c) => c.empresaId);
        if (scope?.empresaId !== 'emp1') return null; // el programa es de emp1
        if (scope.asignacionesCliente) return null; // usuario_cliente sin UsuarioClientePrograma
        return { id: PROGRAMA_ID };
      }),
    },
  };
  const fichaService = {
    build: vi.fn().mockResolvedValue({ ok: true }),
    resumen: vi.fn().mockResolvedValue([]),
  };
  return { controller: new ClienteParticipantesController(prisma as any, fichaService as any), prisma, fichaService };
}

describe('Endpoints de cliente — scope (C-07 / RN-09)', () => {
  it('4. usuario_cliente SIN UsuarioClientePrograma → PORTAL_ACCESO_DENEGADO (ficha y listado)', async () => {
    const { controller, fichaService } = buildClienteController();
    await expect(controller.ficha(PROGRAMA_ID, USUARIO_ID, USUARIO_CLIENTE_SIN_ASIGNAR)).rejects.toMatchObject({
      code: 'PORTAL_ACCESO_DENEGADO',
    });
    await expect(controller.listar(PROGRAMA_ID, USUARIO_CLIENTE_SIN_ASIGNAR)).rejects.toMatchObject({
      code: 'PORTAL_ACCESO_DENEGADO',
    });
    expect(fichaService.build).not.toHaveBeenCalled();
    expect(fichaService.resumen).not.toHaveBeenCalled();
  });

  it('5. cliente_admin con programa de su empresa → responde, y sin entregable', async () => {
    const { controller, fichaService } = buildClienteController();
    await expect(controller.ficha(PROGRAMA_ID, USUARIO_ID, CLIENTE_ADMIN)).resolves.toEqual({ ok: true });
    expect(fichaService.build).toHaveBeenCalledWith(PROGRAMA_ID, USUARIO_ID, { verEntregable: false });
  });

  it('6. programa de otra empresa → el MISMO PORTAL_ACCESO_DENEGADO (RN-09)', async () => {
    const { controller } = buildClienteController();
    await expect(controller.ficha(PROGRAMA_ID, USUARIO_ID, CLIENTE_OTRA_EMPRESA)).rejects.toMatchObject({
      code: 'PORTAL_ACCESO_DENEGADO',
    });
  });
});

describe('Facilitador — roles y metadata', () => {
  it('7. un estudiante contra el endpoint de facilitador → 403', () => {
    const guard = new RolesGuard(new Reflector());
    for (const handler of [
      FacilitadorParticipantesController.prototype.ficha,
      FacilitadorParticipantesController.prototype.resumen,
    ]) {
      const ctx = {
        getHandler: () => handler,
        getClass: () => FacilitadorParticipantesController,
        switchToHttp: () => ({ getRequest: () => ({ user: { role: 'estudiante' } }) }),
      } as unknown as ExecutionContext;
      expect(() => guard.canActivate(ctx)).toThrowError(expect.objectContaining({ code: 'FORBIDDEN' }));
    }
  });

  it('8. metadata de roles: facilitador y CLIENTE_ROLE_SLUGS', () => {
    expect(Reflect.getMetadata(ROLES_KEY, FacilitadorParticipantesController)).toEqual(['facilitador']);
    expect(Reflect.getMetadata(ROLES_KEY, ClienteParticipantesController)).toEqual([...CLIENTE_ROLE_SLUGS]);
  });
});

describe('Ficha — datos', () => {
  it('9. usuario no matriculado en el programa → PARTICIPANTE_NOT_FOUND', async () => {
    const { service, prisma } = buildService();
    prisma.participantePrograma.findFirst.mockResolvedValue(null);
    await expect(service.build(PROGRAMA_ID, 'intruso', { verEntregable: true })).rejects.toMatchObject({
      code: 'PARTICIPANTE_NOT_FOUND',
    });
  });

  it('10. sesión sin fila de asistencia → presente: null (no false); ausente real → false', async () => {
    const { service } = buildService({
      asistencia: {
        sesiones: [
          { id: 's1', numeroSesion: 1, titulo: 'Intro', fechaProgramada: new Date('2026-09-10') },
          { id: 's2', numeroSesion: 2, titulo: 'Práctica', fechaProgramada: new Date('2026-09-17') },
          { id: 's3', numeroSesion: 3, titulo: 'Cierre', fechaProgramada: new Date('2026-09-24') },
        ],
        filas: [{ usuarioId: USUARIO_ID, nombre: 'Ana', email: 'a@x.com', area: null, porSesion: { s1: true, s2: false }, porcentaje: 1 / 3 }],
      },
    });
    const ficha = await service.build(PROGRAMA_ID, USUARIO_ID, { verEntregable: true });
    expect(ficha.asistencia.sesiones.map((s) => s.presente)).toEqual([true, false, null]);
    expect(ficha.asistencia.presentes).toBe(1);
    expect(ficha.asistencia.total).toBe(3);
  });
});
