/**
 * HU-11 · GET grupos/mios expone el correo de los compañeros de grupo.
 * Decisión de privacidad: el email solo se muestra a miembros del mismo grupo, y eso lo
 * garantiza el WHERE `miembros.some.usuarioId = actor.sub`. El test del WHERE es la barrera.
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';

import { GrupoRecursosController } from '../../apps/api/src/modules/reto/interfaces/grupo-recursos.controller';
import { ROLES_KEY } from '../../apps/api/src/modules/auth/guards';

const ACTOR = { sub: 'est1', role: 'estudiante', empresaId: null } as any;

function grupoRow(miembros: any[]) {
  return {
    id: 'g1',
    programaId: 'prog1',
    nombre: 'Grupo 1',
    orden: 1,
    finalizadoEn: null,
    programa: {
      id: 'prog1',
      nombre: 'Programa IA',
      estado: 'activo',
      presentacionDesdeSesion: null,
      bitacoraHabilitadaEn: null,
      empresa: { nombre: 'Acme' },
      sesiones: [],
    },
    miembros,
    respuestasFormulario: [],
    presentacionFinal: null,
  };
}

function build(rows: any[]) {
  const prisma = { grupo: { findMany: vi.fn().mockResolvedValue(rows) } };
  const scope = { programaScope: vi.fn().mockReturnValue({}) };
  const controller = new GrupoRecursosController(prisma as any, scope as any, {} as any, {} as any);
  return { controller, prisma };
}

describe('HU-11 · GET grupos/mios con email de los integrantes', () => {
  it('pide email en el select de miembros y lo devuelve', async () => {
    const { controller, prisma } = build([
      grupoRow([
        { usuario: { id: 'est1', nombre: 'Ana', email: 'ana@acme.com' } },
        { usuario: { id: 'est2', nombre: 'Luis', email: 'luis@acme.com' } },
      ]),
    ]);
    const [g]: any[] = await controller.misGrupos(ACTOR);

    const select = prisma.grupo.findMany.mock.calls[0][0].select;
    expect(select.miembros.select.usuario.select.email).toBe(true);
    expect(g.miembros).toEqual([
      { id: 'est1', nombre: 'Ana', email: 'ana@acme.com' },
      { id: 'est2', nombre: 'Luis', email: 'luis@acme.com' },
    ]);
  });

  it('el where conserva miembros.some.usuarioId = actor.sub (barrera de privacidad)', async () => {
    const { controller, prisma } = build([]);
    await controller.misGrupos(ACTOR);

    const where = prisma.grupo.findMany.mock.calls[0][0].where;
    expect(where.miembros).toEqual({ some: { usuarioId: 'est1' } });
  });

  it('un miembro con email null se serializa como null', async () => {
    const { controller } = build([grupoRow([{ usuario: { id: 'est2', nombre: 'Luis', email: null } }])]);
    const [g]: any[] = await controller.misGrupos(ACTOR);
    expect(g.miembros[0].email).toBeNull();
  });

  it('metadata de roles: solo estudiante', () => {
    expect(Reflect.getMetadata(ROLES_KEY, GrupoRecursosController)).toEqual(['estudiante']);
  });

  it('estudiante sin grupo → [] sin lanzar', async () => {
    const { controller } = build([]);
    await expect(controller.misGrupos(ACTOR)).resolves.toEqual([]);
  });
});
