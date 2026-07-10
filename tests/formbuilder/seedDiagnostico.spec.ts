/**
 * Seed del template global "Diagnóstico inicial" (scripts/seed-diagnostico-inicial.ts):
 * cada campo definido debe pasar la validación de config del form builder
 * (RF-24, misma regla que impone POST /admin/.../campos) y respetar las
 * convenciones del scoring (RF-26/RF-29).
 */

import { describe, it, expect } from 'vitest';

import {
  CAMPOS,
  CAMPOS_IDENTIDAD,
  CampoSeed,
} from '../../scripts/seed-diagnostico-inicial';
import {
  validarConfigCampo,
  OpcionCampo,
} from '../../apps/api/src/modules/formularios/application/form-config';

const TODOS: CampoSeed[] = [...CAMPOS_IDENTIDAD, ...CAMPOS];

describe('seed-diagnostico-inicial — definiciones de campos', () => {
  it('todos los campos pasan validarConfigCampo (CAMPO_CONFIG_INVALIDA)', () => {
    for (const campo of TODOS) {
      expect(() => validarConfigCampo(campo.tipoCampo, campo.configJson ?? {}),
        `campo "${campo.etiqueta}"`).not.toThrow();
    }
  });

  it('las opciones de cada opcion_multiple tienen valores únicos', () => {
    for (const campo of TODOS.filter(c => c.tipoCampo === 'opcion_multiple')) {
      const opciones = (campo.configJson?.opciones ?? []) as OpcionCampo[];
      const valores = opciones.map(o => o.valor);
      expect(new Set(valores).size, `campo "${campo.etiqueta}"`).toBe(valores.length);
    }
  });

  it('los 4 likert del bloque de partida puntúan con dimensión (RF-26)', () => {
    const likerts = CAMPOS.filter(c => c.tipoCampo === 'likert');
    expect(likerts).toHaveLength(4);
    for (const campo of likerts) {
      expect(campo.dimension, `campo "${campo.etiqueta}"`).toBeTruthy();
      expect(campo.configJson).toMatchObject({ min: 1, max: 5 });
    }
  });

  it('todo campo con dimension de opción múltiple trae score en sus opciones', () => {
    for (const campo of CAMPOS.filter(c => c.dimension && c.tipoCampo === 'opcion_multiple')) {
      const opciones = (campo.configJson?.opciones ?? []) as OpcionCampo[];
      expect(opciones.length, `campo "${campo.etiqueta}"`).toBeGreaterThan(0);
      for (const op of opciones) {
        expect(typeof op.score, `campo "${campo.etiqueta}" opción "${op.valor}"`).toBe('number');
      }
    }
  });

  it('los checkboxes del formulario original llevan multiple:true', () => {
    const multiples = CAMPOS.filter(c => c.configJson?.multiple === true);
    // 5 preguntas de selección múltiple: tareas Gemini, herramientas usadas,
    // tareas otras IA, expectativas del programa... (ver Google Form).
    expect(multiples.length).toBeGreaterThanOrEqual(4);
    for (const campo of multiples) {
      expect(campo.tipoCampo, `campo "${campo.etiqueta}"`).toBe('opcion_multiple');
    }
  });

  it('cada sección del Google Form aparece exactamente una vez (agrupador §2.0 #3)', () => {
    const secciones = CAMPOS.map(c => c.configJson?.seccion).filter(Boolean) as string[];
    expect(new Set(secciones).size).toBe(secciones.length);
    expect(secciones).toEqual([
      'Conociendo a los participantes',
      'Tu punto de partida con la IA generativa',
      'Conocimientos y uso actual de Gemini',
      'Uso de otras IA generativas',
      'Conocimiento general IA',
      'Barreras o preocupaciones',
      'Expectativas del programa',
    ]);
  });

  it('las preguntas de ramas condicionales del Google Form quedan opcionales', () => {
    const ramas = [
      '¿Con qué frecuencia utilizas Gemini?',
      'Si no has usado Gemini, ¿cuál es la razón principal?',
      '¿Cuáles herramientas de IA generativa has usado?',
      '¿Cuál capacitación has tomado y en qué IA generativa profundizaste?',
    ];
    for (const etiqueta of ramas) {
      const campo = CAMPOS.find(c => c.etiqueta === etiqueta);
      expect(campo, etiqueta).toBeDefined();
      expect(campo!.esObligatorio ?? false, etiqueta).toBe(false);
    }
  });
});
