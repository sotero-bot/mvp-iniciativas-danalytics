/**
 * HU-23 · pantalla de revisión del facilitador: GET facilitador/grupos/:id/revision devuelve lo
 * que el grupo entregó en la fase 3 (bitácora, plantilla del proyecto y presentación final,
 * con URL firmada) en SOLO lectura, escopeado al programa y sin configJson (RNF-04).
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';

import { FacilitadorRetoController } from '../../apps/api/src/modules/reto/interfaces/facilitador-reto.controller';
import { AppError } from '../../apps/api/src/shared/errors/AppError';

const ACTOR = { sub: 'fac1', role: 'facilitador', empresaId: null } as any;

const CAMPOS = [
  {
    id: 'c1', campoPadreId: null, tipoCampo: 'opcion_multiple', etiqueta: 'Herramienta', descripcion: null,
    esObligatorio: false, orden: 1, configJson: { opciones: [{ valor: 'gpt', etiqueta: 'ChatGPT', score: 5 }] },
  },
];

const GRUPO = {
  id: 'g1',
  programaId: 'p1',
  nombre: 'Grupo 1',
  orden: 1,
  finalizadoEn: null,
  finalizadoPor: null,
  miembros: [{ usuario: { id: 'u1', nombre: 'Ana' } }],
  presentacionFinal: {
    archivoKey: 'acme/prog/grupo_1/presentacion_final/demo-3f2b1c0e-1111-2222-3333-444455556666.pdf',
    entregadoEn: new Date('2026-10-01'),
    entregadoPor: { id: 'u1', nombre: 'Ana' },
  },
  respuestasFormulario: [
    { datosRespuestaJson: { c1: 'gpt' }, ultimaEdicionEn: new Date('2026-09-30'), ultimoEditor: { id: 'u1', nombre: 'Ana' }, plantilla: { tipoFormulario: 'bitacora' } },
    { datosRespuestaJson: { c1: 'gpt' }, ultimaEdicionEn: new Date('2026-09-29'), ultimoEditor: { id: 'u1', nombre: 'Ana' }, plantilla: { tipoFormulario: 'plantilla_proyecto' } },
  ],
};

function build(over: Record<string, any> = {}) {
  const prisma: any = {
    grupo: { findUnique: vi.fn().mockResolvedValue(GRUPO) },
    plantillaFormulario: {
      findFirst: vi.fn().mockImplementation(({ where }: any) =>
        Promise.resolve({ id: `pl-${where.tipoFormulario}`, tipoFormulario: where.tipoFormulario, nombre: where.tipoFormulario, descripcion: null }),
      ),
    },
    campoFormulario: { findMany: vi.fn().mockResolvedValue(CAMPOS) },
    ...over.prisma,
  };
  const scope: any = { assertProgramaAccessible: vi.fn().mockResolvedValue(undefined), ...over.scope };
  const translations: any = { applyOverlay: vi.fn().mockResolvedValue({}) };
  const s3: any = { getPresignedGetUrl: vi.fn().mockResolvedValue('https://signed/demo.pdf'), ...over.s3 };
  return { controller: new FacilitadorRetoController(prisma, scope, translations, s3), prisma, scope, s3 };
}

describe('GET facilitador/grupos/:id/revision', () => {
  it('es una lectura: solo facilitador y sin escritura sobre el grupo', async () => {
    await import('reflect-metadata');
    const { ROLES_KEY } = await import('../../apps/api/src/modules/auth/guards');
    expect(Reflect.getMetadata(ROLES_KEY, FacilitadorRetoController)).toEqual(['facilitador']);
    const { controller, prisma } = build();
    prisma.grupo.update = vi.fn();
    await controller.getRevisionGrupo('g1', ACTOR);
    expect(prisma.grupo.update).not.toHaveBeenCalled();
  });

  it('presentación sin archivoKey no firma ni rompe (entrega sin archivo)', async () => {
    const { controller, s3 } = build({
      prisma: { grupo: { findUnique: vi.fn().mockResolvedValue({ ...GRUPO, presentacionFinal: { archivoKey: null, entregadoEn: new Date(), entregadoPor: null } }) } },
    });
    const r: any = await controller.getRevisionGrupo('g1', ACTOR);
    expect(r.presentacion).toBeNull();
    expect(s3.getPresignedGetUrl).not.toHaveBeenCalled();
  });

  it('ignora respuestas de otros tipos de formulario al armar bitácora y plantilla', async () => {
    const extra = { datosRespuestaJson: { x: 1 }, ultimaEdicionEn: null, ultimoEditor: null, plantilla: { tipoFormulario: 'feedback' } };
    const { controller } = build({
      prisma: { grupo: { findUnique: vi.fn().mockResolvedValue({ ...GRUPO, respuestasFormulario: [extra, ...GRUPO.respuestasFormulario] }) } },
    });
    const r: any = await controller.getRevisionGrupo('g1', ACTOR);
    expect(r.bitacora.respuesta.datos).toEqual({ c1: 'gpt' });
    expect(JSON.stringify(r)).not.toContain('"x":1');
  });

  it('GRUPO_NOT_FOUND antes de cualquier scope', async () => {
    const { controller, scope } = build({ prisma: { grupo: { findUnique: vi.fn().mockResolvedValue(null) } } });
    await expect(controller.getRevisionGrupo('g1', ACTOR)).rejects.toMatchObject({ code: 'GRUPO_NOT_FOUND' });
    expect(scope.assertProgramaAccessible).not.toHaveBeenCalled();
  });

  it('facilitador de otro programa → 403 y no lee plantillas ni firma URLs', async () => {
    const { controller, prisma, s3 } = build({ scope: { assertProgramaAccessible: vi.fn().mockRejectedValue(new AppError('FORBIDDEN')) } });
    await expect(controller.getRevisionGrupo('g1', ACTOR)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.plantillaFormulario.findFirst).not.toHaveBeenCalled();
    expect(s3.getPresignedGetUrl).not.toHaveBeenCalled();
  });

  it('aplica el scope de lectura sobre el programa del grupo', async () => {
    const { controller, scope } = build();
    await controller.getRevisionGrupo('g1', ACTOR);
    expect(scope.assertProgramaAccessible).toHaveBeenCalledWith(expect.anything(), ACTOR, 'p1');
  });

  it('devuelve grupo, bitácora, plantilla del proyecto y presentación', async () => {
    const { controller } = build();
    const r: any = await controller.getRevisionGrupo('g1', ACTOR);
    expect(r.grupo).toMatchObject({ id: 'g1', nombre: 'Grupo 1', miembros: [{ id: 'u1', nombre: 'Ana' }] });
    expect(r.bitacora.plantilla.tipoFormulario).toBe('bitacora');
    expect(r.bitacora.respuesta.datos).toEqual({ c1: 'gpt' });
    expect(r.plantillaProyecto.plantilla.tipoFormulario).toBe('plantilla_proyecto');
    expect(r.plantillaProyecto.respuesta.ultimoEditor).toEqual({ id: 'u1', nombre: 'Ana' });
  });

  it('la presentación trae nombre legible, quién entregó y URL firmada', async () => {
    const { controller, s3 } = build();
    const r: any = await controller.getRevisionGrupo('g1', ACTOR);
    expect(r.presentacion).toMatchObject({
      archivoNombre: 'demo.pdf',
      entregadoPor: { nombre: 'Ana' },
      url: 'https://signed/demo.pdf',
    });
    expect(s3.getPresignedGetUrl).toHaveBeenCalledWith(GRUPO.presentacionFinal.archivoKey, 3600);
  });

  it('sin presentación → presentacion null y no firma nada', async () => {
    const { controller, s3 } = build({ prisma: { grupo: { findUnique: vi.fn().mockResolvedValue({ ...GRUPO, presentacionFinal: null }) } } });
    const r: any = await controller.getRevisionGrupo('g1', ACTOR);
    expect(r.presentacion).toBeNull();
    expect(s3.getPresignedGetUrl).not.toHaveBeenCalled();
  });

  it('puedeFinalizar es true solo con la entrega completa y el grupo abierto', async () => {
    const ok: any = await build().controller.getRevisionGrupo('g1', ACTOR);
    expect(ok.puedeFinalizar).toBe(true);
    const parcial: any = await build({ prisma: { grupo: { findUnique: vi.fn().mockResolvedValue({ ...GRUPO, respuestasFormulario: [GRUPO.respuestasFormulario[0]] }) } } })
      .controller.getRevisionGrupo('g1', ACTOR);
    expect(parcial.puedeFinalizar).toBe(false);
    expect(parcial.faltante).toEqual({ presentacion: false, bitacora: false, plantillaProyecto: true });
    const cerrado: any = await build({ prisma: { grupo: { findUnique: vi.fn().mockResolvedValue({ ...GRUPO, finalizadoEn: new Date() }) } } })
      .controller.getRevisionGrupo('g1', ACTOR);
    expect(cerrado.puedeFinalizar).toBe(false);
  });

  it('nunca serializa configJson ni score (RNF-04/RN-02)', async () => {
    const { controller } = build();
    const json = JSON.stringify(await controller.getRevisionGrupo('g1', ACTOR));
    expect(json).not.toContain('configJson');
    expect(json).not.toContain('score');
  });

  it('programa sin snapshots de plantilla → plantilla null, sin error', async () => {
    const { controller } = build({ prisma: { plantillaFormulario: { findFirst: vi.fn().mockResolvedValue(null) } } });
    const r: any = await controller.getRevisionGrupo('g1', ACTOR);
    expect(r.bitacora.plantilla).toBeNull();
  });
});
