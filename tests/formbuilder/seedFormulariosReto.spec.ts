/**
 * Seed de los templates globales del Reto con IA (scripts/seed-formularios-reto.ts):
 * cada campo definido debe pasar la validación de config del form builder
 * (RF-24, misma regla que impone POST /admin/.../campos) y la estructura debe
 * ser la que esperan /grupos/:id/bitacora y /grupos/:id/plantilla-proyecto
 * (RF-30/RF-31: grupo_repetible con hijos, tablas con columnas).
 */

import { describe, it, expect } from 'vitest';

import {
  BITACORA,
  PLANTILLA_PROYECTO,
  PLANTILLAS,
  CampoSeed,
} from '../../scripts/seed-formularios-reto';
import { validarConfigCampo } from '../../apps/api/src/modules/formularios/application/form-config';

function aplanar(campos: CampoSeed[]): CampoSeed[] {
  return campos.flatMap(c => [c, ...aplanar(c.hijos ?? [])]);
}

describe('seed-formularios-reto — definiciones de campos', () => {
  it('cubre los dos tipos grupales de la Fase 3', () => {
    expect(PLANTILLAS.map(p => p.tipoFormulario)).toEqual(['bitacora', 'plantilla_proyecto']);
  });

  it('todos los campos (incluidos hijos) pasan validarConfigCampo (CAMPO_CONFIG_INVALIDA)', () => {
    for (const plantilla of PLANTILLAS) {
      for (const campo of aplanar(plantilla.campos)) {
        expect(() => validarConfigCampo(campo.tipoCampo, campo.configJson ?? {}),
          `${plantilla.tipoFormulario} → campo "${campo.etiqueta}"`).not.toThrow();
      }
    }
  });

  it('la bitácora registra iteraciones con UN grupo_repetible y sus hijos (RF-30, §2.0)', () => {
    const repetibles = BITACORA.campos.filter(c => c.tipoCampo === 'grupo_repetible');
    expect(repetibles).toHaveLength(1);
    const [registro] = repetibles;
    const etiquetasHijos = (registro.hijos ?? []).map(h => h.etiqueta);
    expect(etiquetasHijos).toEqual([
      'Prompt',
      'Evaluación del resultado',
      'Problemas detectados',
      'Ajustes para la siguiente iteración',
      'IA generativa utilizada',
    ]);
    // El prompt es el corazón de la iteración (documento fuente lo pide completo).
    expect(registro.hijos?.[0].esObligatorio).toBe(true);
  });

  it('solo el grupo_repetible tiene hijos; ningún hijo anida a su vez', () => {
    for (const plantilla of PLANTILLAS) {
      for (const campo of aplanar(plantilla.campos)) {
        if (campo.tipoCampo !== 'grupo_repetible') {
          expect(campo.hijos ?? [], `campo "${campo.etiqueta}"`).toHaveLength(0);
        } else {
          for (const hijo of campo.hijos ?? []) {
            expect(hijo.hijos ?? [], `hijo "${hijo.etiqueta}"`).toHaveLength(0);
            expect(hijo.tipoCampo).not.toBe('grupo_repetible');
          }
        }
      }
    }
  });

  it('las tablas del documento traen sus columnas (RF-31: filas dinámicas)', () => {
    const insumos = BITACORA.campos.find(c => c.tipoCampo === 'tabla');
    expect(insumos?.configJson?.columnas).toHaveLength(4);

    const tablas = PLANTILLA_PROYECTO.campos.filter(c => c.tipoCampo === 'tabla');
    expect(tablas.map(t => t.etiqueta)).toEqual(['Integrantes del equipo', 'Plan de próximos pasos']);
    expect(tablas[1].configJson?.columnas).toEqual([
      'Paso',
      'Responsable',
      'Actividad',
      'Tiempo estimado',
      'Indicador de éxito',
    ]);
  });

  it('las secciones del documento aparecen exactamente una vez (agrupador §2.0 #3)', () => {
    for (const plantilla of PLANTILLAS) {
      const secciones = aplanar(plantilla.campos)
        .map(c => c.configJson?.seccion)
        .filter(Boolean) as string[];
      expect(new Set(secciones).size, plantilla.tipoFormulario).toBe(secciones.length);
    }
    expect(BITACORA.campos[0].configJson?.seccion).toBe('Registro de iteraciones');
    expect(PLANTILLA_PROYECTO.campos[0].configJson?.seccion).toBe('Datos del proyecto');
  });

  it('los formularios grupales no puntúan: sin dimension ni score (RF-29 no aplica)', () => {
    for (const plantilla of PLANTILLAS) {
      for (const campo of aplanar(plantilla.campos)) {
        expect((campo as { dimension?: string }).dimension, `campo "${campo.etiqueta}"`).toBeUndefined();
        expect(JSON.stringify(campo.configJson ?? {}), `campo "${campo.etiqueta}"`).not.toContain('score');
      }
    }
  });

  it('los campos calculados del documento quedan opcionales con la fórmula en la descripción', () => {
    const ahorro = PLANTILLA_PROYECTO.campos.find(c => c.etiqueta === 'Ahorro anual estimado (horas)');
    expect(ahorro).toBeDefined();
    expect(ahorro!.esObligatorio ?? false).toBe(false);
    expect(ahorro!.descripcion).toContain('×');
  });
});
