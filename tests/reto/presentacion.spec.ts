/**
 * Presentación final del grupo (Plan 2 §3.1 — RF-32):
 * link O archivo (PDF/PPT), bloqueada antes de la fase de cierre
 * (PRESENTACION_NO_HABILITADA), formato inválido (PRESENTACION_FORMATO_INVALIDO),
 * key S3 con la convención del proyecto.
 */

import { describe, it, expect, vi } from 'vitest';

import { GrupoRecursosController } from '../../apps/api/src/modules/reto/interfaces/grupo-recursos.controller';

const ACTOR = { sub: 'est1', role: 'estudiante', empresaId: null } as any;

function grupoConGating(presentacionDesdeSesion: number | null) {
  return {
    id: 'g1',
    programaId: 'prog1',
    nombre: 'Grupo 1',
    orden: 2,
    programa: {
      id: 'prog1',
      nombre: 'Programa IA en Acción',
      estado: 'activo',
      presentacionDesdeSesion,
      empresa: { nombre: 'Acme Córp' },
    },
  };
}

function buildController(overrides: Record<string, any> = {}) {
  const prisma = {
    grupo: { findUnique: vi.fn().mockResolvedValue(grupoConGating(null)), findMany: vi.fn() },
    miembroGrupo: { findFirst: vi.fn().mockResolvedValue({ id: 'm1' }) },
    sesion: { findFirst: vi.fn().mockResolvedValue(null) },
    presentacionFinal: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockImplementation(({ create }: any) => Promise.resolve(create)),
    },
    ...overrides.prisma,
  };
  const scope = {
    assertProgramaAccessible: vi.fn().mockResolvedValue(undefined),
    programaScope: vi.fn().mockReturnValue({}),
    ...overrides.scope,
  };
  const translations = { applyOverlay: vi.fn().mockResolvedValue({}) };
  const s3 = {
    isConfigured: true,
    generateKey: vi.fn((prefix: string, filename: string) => `${prefix}/123-${filename}`),
    getPresignedPutUrl: vi.fn().mockResolvedValue('https://s3/upload'),
    ...overrides.s3,
  };
  return {
    controller: new GrupoRecursosController(prisma as any, scope as any, translations as any, s3 as any),
    prisma,
    s3,
  };
}

describe('Gating por sesión (RF-32)', () => {
  it('sin presentacionDesdeSesion configurada → habilitada', async () => {
    const { controller } = buildController();
    const result = await controller.getPresentacion('g1', ACTOR);
    expect(result.habilitada).toBe(true);
  });

  it('bloqueada antes del cierre → PRESENTACION_NO_HABILITADA en la entrega', async () => {
    const { controller } = buildController({
      prisma: {
        grupo: { findUnique: vi.fn().mockResolvedValue(grupoConGating(4)), findMany: vi.fn() },
        sesion: { findFirst: vi.fn().mockResolvedValue(null) }, // la sesión 4 no ha ocurrido
      },
    });
    await expect(
      controller.entregarPresentacion('g1', { urlPresentacion: 'https://slides.com/x' }, ACTOR),
    ).rejects.toMatchObject({ code: 'PRESENTACION_NO_HABILITADA' });
    // El GET informa el estado sin lanzar error (para que la UI muestre el candado).
    const estado = await controller.getPresentacion('g1', ACTOR);
    expect(estado.habilitada).toBe(false);
    expect(estado.desdeSesion).toBe(4);
  });

  it('habilitada cuando la sesión N ya ocurrió (numeroSesion ≥ N y fecha pasada)', async () => {
    const { controller, prisma } = buildController({
      prisma: {
        grupo: { findUnique: vi.fn().mockResolvedValue(grupoConGating(4)), findMany: vi.fn() },
        sesion: { findFirst: vi.fn().mockResolvedValue({ id: 's4' }) },
      },
    });
    await controller.entregarPresentacion('g1', { urlPresentacion: 'https://slides.com/x' }, ACTOR);
    expect(prisma.sesion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          programaId: 'prog1',
          numeroSesion: { gte: 4 },
          fechaProgramada: { lte: expect.any(Date) },
        }),
      }),
    );
    expect(prisma.presentacionFinal.upsert).toHaveBeenCalled();
  });
});

describe('Entrega link O archivo (RF-32)', () => {
  it('link válido → upsert con entregadoPorId/entregadoEn', async () => {
    const { controller, prisma } = buildController();
    await controller.entregarPresentacion('g1', { urlPresentacion: 'https://slides.com/demo' }, ACTOR);
    const args = (prisma.presentacionFinal.upsert as any).mock.calls[0][0];
    expect(args.where).toEqual({ grupoId: 'g1' });
    expect(args.create).toMatchObject({
      grupoId: 'g1',
      programaId: 'prog1',
      urlPresentacion: 'https://slides.com/demo',
      archivoKey: null,
      entregadoPorId: 'est1',
      entregadoEn: expect.any(Date),
    });
  });

  it('archivo PDF/PPT (key S3) → upsert; reentrega reemplaza (unique por grupo)', async () => {
    const { controller, prisma } = buildController();
    await controller.entregarPresentacion('g1', { archivoKey: 'acme/prog/grupo_2/presentacion_final/1-a.pptx' }, ACTOR);
    const args = (prisma.presentacionFinal.upsert as any).mock.calls[0][0];
    expect(args.create.archivoKey).toMatch(/\.pptx$/);
    expect(args.update).toMatchObject({ entregadoPorId: 'est1' });
  });

  it('sin link ni archivo → VALIDATION_ERROR', async () => {
    const { controller } = buildController();
    await expect(controller.entregarPresentacion('g1', {}, ACTOR)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('link que no es http(s) → PRESENTACION_FORMATO_INVALIDO', async () => {
    const { controller } = buildController();
    await expect(
      controller.entregarPresentacion('g1', { urlPresentacion: 'ftp://x/pres.pdf' }, ACTOR),
    ).rejects.toMatchObject({ code: 'PRESENTACION_FORMATO_INVALIDO' });
  });

  it('archivo con extensión no permitida (.docx) → PRESENTACION_FORMATO_INVALIDO', async () => {
    const { controller } = buildController();
    await expect(
      controller.entregarPresentacion('g1', { archivoKey: 'x/presentacion.docx' }, ACTOR),
    ).rejects.toMatchObject({ code: 'PRESENTACION_FORMATO_INVALIDO' });
  });

  it('no-miembro → GRUPO_RECURSO_NO_MIEMBRO', async () => {
    const { controller } = buildController({
      prisma: { miembroGrupo: { findFirst: vi.fn().mockResolvedValue(null) } },
    });
    await expect(
      controller.entregarPresentacion('g1', { urlPresentacion: 'https://x.com' }, ACTOR),
    ).rejects.toMatchObject({ code: 'GRUPO_RECURSO_NO_MIEMBRO' });
  });
});

describe('Presign de subida (RF-32 + convención s3-key-naming)', () => {
  it('genera la key con segmentos slugificados: empresa/programa/grupo_N/presentacion_final', async () => {
    const { controller, s3 } = buildController();
    const result = await controller.presignPresentacion(
      'g1',
      { filename: 'Presentación Final.pdf', contentType: 'application/pdf' },
      ACTOR,
    );
    expect(s3.generateKey).toHaveBeenCalledWith(
      'acme_corp/programa_ia_en_accion/grupo_2/presentacion_final',
      'Presentación Final.pdf',
    );
    expect(result.uploadUrl).toBe('https://s3/upload');
    expect(result.key).toContain('presentacion_final');
  });

  it('extensión no permitida en el presign → PRESENTACION_FORMATO_INVALIDO (antes de firmar)', async () => {
    const { controller, s3 } = buildController();
    await expect(
      controller.presignPresentacion('g1', { filename: 'demo.zip', contentType: 'application/zip' }, ACTOR),
    ).rejects.toMatchObject({ code: 'PRESENTACION_FORMATO_INVALIDO' });
    expect(s3.getPresignedPutUrl).not.toHaveBeenCalled();
  });

  it('bloqueada antes del cierre → PRESENTACION_NO_HABILITADA (no firma)', async () => {
    const { controller, s3 } = buildController({
      prisma: {
        grupo: { findUnique: vi.fn().mockResolvedValue(grupoConGating(4)), findMany: vi.fn() },
        sesion: { findFirst: vi.fn().mockResolvedValue(null) },
      },
    });
    await expect(
      controller.presignPresentacion('g1', { filename: 'demo.pdf', contentType: 'application/pdf' }, ACTOR),
    ).rejects.toMatchObject({ code: 'PRESENTACION_NO_HABILITADA' });
    expect(s3.getPresignedPutUrl).not.toHaveBeenCalled();
  });
});
