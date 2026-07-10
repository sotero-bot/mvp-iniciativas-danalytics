/**
 * RNF-04 / RN-02 (Plan 2 §2.1/§2.3): la respuesta a roles ≠ admin NUNCA incluye
 * `configJson` ni ningún `score`; lo que ve el respondiente es `configPublica`
 * sanitizada + etiqueta/descripcion (columnas).
 */

import { describe, it, expect, vi } from 'vitest';

import { derivarConfigPublica } from '../../apps/api/src/modules/formularios/application/form-config';
import { EstudianteFormulariosController } from '../../apps/api/src/modules/formularios/interfaces/estudiante-formularios.controller';

const ACTOR = { sub: 'est1', role: 'estudiante', empresaId: null } as any;

describe('derivarConfigPublica (RNF-04)', () => {
  it('opcion_multiple: expone opciones y flag multiple, SIN score', () => {
    const publica = derivarConfigPublica('opcion_multiple' as any, {
      opciones: [
        { valor: 'a', etiqueta: 'Nunca', score: 0 },
        { valor: 'b', etiqueta: 'Siempre', score: 5 },
      ],
      multiple: true,
    });
    expect(publica).toEqual({
      opciones: [
        { valor: 'a', etiqueta: 'Nunca' },
        { valor: 'b', etiqueta: 'Siempre' },
      ],
      multiple: true,
    });
    expect(JSON.stringify(publica)).not.toContain('score');
  });

  it('likert: expone min/max y etiquetas de extremos', () => {
    expect(
      derivarConfigPublica('likert' as any, { min: 1, max: 5, etiquetaMin: 'Nada' }),
    ).toEqual({ min: 1, max: 5, etiquetaMin: 'Nada' });
  });

  it('tabla: expone columnas', () => {
    expect(derivarConfigPublica('tabla' as any, { columnas: ['Rol', 'Nombre'] })).toEqual({
      columnas: ['Rol', 'Nombre'],
    });
  });
});

describe('GET /formularios/:id — respuesta del estudiante (RNF-04/RN-02)', () => {
  it('no serializa configJson ni score en ningún campo; sí configPublica', async () => {
    const prisma = {
      plantillaFormulario: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'pl1',
          programaId: 'prog1',
          tipoFormulario: 'diagnostico_inicial',
          nombre: 'Diagnóstico',
          descripcion: null,
          activa: true,
        }),
      },
      campoFormulario: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'c1',
            campoPadreId: null,
            tipoCampo: 'opcion_multiple',
            etiqueta: '¿Con qué frecuencia usas IA?',
            descripcion: null,
            esObligatorio: true,
            orden: 1,
            configJson: {
              opciones: [{ valor: 'a', etiqueta: 'Nunca', score: 0 }],
              multiple: false,
            },
          },
        ]),
      },
      respuestaFormulario: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const scope = { assertProgramaAccessible: vi.fn().mockResolvedValue(undefined) };
    const translations = { applyOverlay: vi.fn().mockResolvedValue({}) };
    const controller = new EstudianteFormulariosController(
      prisma as any,
      scope as any,
      translations as any,
    );

    const result = await controller.getFormulario('pl1', ACTOR, undefined);
    const serializado = JSON.stringify(result);

    expect(serializado).not.toContain('configJson');
    expect(serializado).not.toContain('score');
    expect(result.campos[0].configPublica).toEqual({
      opciones: [{ valor: 'a', etiqueta: 'Nunca' }],
      multiple: false,
    });
    // Lo esencial para renderizar viaja en columnas (etiqueta/descripcion).
    expect(result.campos[0].etiqueta).toBe('¿Con qué frecuencia usas IA?');
  });
});
