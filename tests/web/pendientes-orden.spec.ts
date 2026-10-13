/**
 * HU-04: orden y jerarquía de los pendientes del inicio del estudiante.
 * Lógica pura extraída a features/estudiante/pendientes.ts (no hay render de React en el repo).
 */
import { describe, it, expect } from 'vitest';

import {
  ordenarPendientes,
  esBloqueante,
  destinoVerTodos,
} from '../../apps/web/src/features/estudiante/pendientes';
import type { Pendiente, PendienteTipo } from '../../apps/web/src/features/estudiante/pendientes';

const sesion = (numeroSesion: number) => ({ numeroSesion, titulo: `S${numeroSesion}`, fechaProgramada: '2026-01-01' });

const mk = (tipo: PendienteTipo, nombre: string, numeros: number[] = []): Pendiente => ({
  tipo,
  plantillaId: nombre,
  programaId: 'p1',
  programaNombre: 'P',
  nombre,
  sesiones: numeros.map(sesion),
});

const nombres = (items: Pendiente[]) => items.map((p) => p.nombre);

describe('ordenarPendientes', () => {
  it('ordena por tipo: encuesta_inicio → matricula → entregable → formulario', () => {
    const items = [
      mk('formulario', 'f'),
      mk('entregable', 'e'),
      mk('matricula', 'm'),
      mk('encuesta_inicio', 'i'),
    ];
    expect(nombres(ordenarPendientes(items))).toEqual(['i', 'm', 'e', 'f']);
  });

  it('formularios con sesiones distintas: por la sesión más temprana ascendente', () => {
    const items = [mk('formulario', 'f3', [3]), mk('formulario', 'f1', [1]), mk('formulario', 'f2', [2])];
    expect(nombres(ordenarPendientes(items))).toEqual(['f1', 'f2', 'f3']);
  });

  it('usa el mínimo de sus sesiones: [1,3] va antes que [2]', () => {
    const items = [mk('formulario', 'f2', [2]), mk('formulario', 'f13', [3, 1])];
    expect(nombres(ordenarPendientes(items))).toEqual(['f13', 'f2']);
  });

  it('formulario sin sesión va al final del grupo y no lanza', () => {
    const items = [mk('formulario', 'sin'), mk('formulario', 'f2', [2]), mk('formulario', 'f1', [1])];
    expect(nombres(ordenarPendientes(items))).toEqual(['f1', 'f2', 'sin']);
  });

  it('empate de sesión: conserva el orden de entrada', () => {
    const items = [mk('formulario', 'a', [2]), mk('formulario', 'b', [2]), mk('formulario', 'c', [2])];
    expect(nombres(ordenarPendientes(items))).toEqual(['a', 'b', 'c']);
  });

  it('no muta el array original', () => {
    const items = [mk('formulario', 'f'), mk('encuesta_inicio', 'i')];
    const copia = [...items];
    ordenarPendientes(items);
    expect(items).toEqual(copia);
  });

  it('lista vacía → []', () => {
    expect(ordenarPendientes([])).toEqual([]);
  });
});

describe('esBloqueante', () => {
  it('true solo para encuesta_inicio y matricula', () => {
    expect(esBloqueante(mk('encuesta_inicio', 'x'))).toBe(true);
    expect(esBloqueante(mk('matricula', 'x'))).toBe(true);
    expect(esBloqueante(mk('entregable', 'x'))).toBe(false);
    expect(esBloqueante(mk('formulario', 'x'))).toBe(false);
  });
});

describe('destinoVerTodos', () => {
  it('un solo programa → su vista de pendientes', () => {
    expect(destinoVerTodos([{ id: 'abc' }])).toBe('/estudiante/programas/abc/pendientes');
  });

  it('varios programas → listado de programas', () => {
    expect(destinoVerTodos([{ id: 'a' }, { id: 'b' }])).toBe('/estudiante/programas');
  });

  it('sin programas → listado de programas', () => {
    expect(destinoVerTodos([])).toBe('/estudiante/programas');
  });
});
