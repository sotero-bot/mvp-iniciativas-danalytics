/**
 * HU-01: entradas del menú lateral para el programa elegido.
 * Lógica pura extraída a components/sidebar-programas.ts (no hay render de React en el repo).
 */
import { describe, it, expect } from 'vitest';

import { construirEntradasPrograma } from '../../apps/web/src/components/sidebar-programas';

describe('construirEntradasPrograma', () => {
  it('estudiante: Sesiones, Grupo y Pendientes con sus rutas', () => {
    expect(construirEntradasPrograma('estudiante', 'p1')).toEqual([
      { key: 'programa_sesiones', to: '/estudiante/programas/p1/sesiones' },
      { key: 'programa_grupo', to: '/estudiante/programas/p1/grupo' },
      { key: 'programa_pendientes', to: '/estudiante/programas/p1/pendientes' },
    ]);
  });

  it('todas las rutas contienen el programaId recibido y son distintas', () => {
    for (const rol of ['estudiante', 'facilitador', 'cliente_admin', 'usuario_cliente']) {
      const entradas = construirEntradasPrograma(rol, 'abc-123');
      expect(entradas.length, rol).toBeGreaterThan(0);
      for (const e of entradas) expect(e.to).toContain('/abc-123');
      expect(new Set(entradas.map((e) => e.to)).size).toBe(entradas.length);
    }
  });

  it('facilitador: sus 6 vistas del programa, todas bajo /facilitador', () => {
    expect(construirEntradasPrograma('facilitador', 'p1')).toEqual([
      { key: 'programa_sesiones', to: '/facilitador/programas/p1/sesiones' },
      { key: 'programa_grupos', to: '/facilitador/programas/p1/grupos' },
      { key: 'programa_participantes', to: '/facilitador/programas/p1/participantes' },
      { key: 'programa_reto', to: '/facilitador/programas/p1/reto' },
      { key: 'programa_observaciones', to: '/facilitador/programas/p1/observaciones' },
      { key: 'programa_resultados', to: '/facilitador/programas/p1/resultados' },
    ]);
  });

  it('cliente_admin: Resumen y Participantes bajo /portal', () => {
    expect(construirEntradasPrograma('cliente_admin', 'p1')).toEqual([
      { key: 'programa_resumen', to: '/portal/programas/p1' },
      { key: 'programa_participantes', to: '/portal/programas/p1/participantes' },
    ]);
  });

  it('usuario_cliente tiene las mismas entradas que cliente_admin (el filtro C-07 es de servidor, no de menú)', () => {
    expect(construirEntradasPrograma('usuario_cliente', 'p1')).toEqual(construirEntradasPrograma('cliente_admin', 'p1'));
  });

  it('las rutas de cada rol no se mezclan con las de otro', () => {
    for (const e of construirEntradasPrograma('cliente_admin', 'p1')) expect(e.to).not.toMatch(/\/(estudiante|facilitador)\//);
    for (const e of construirEntradasPrograma('facilitador', 'p1')) expect(e.to).not.toMatch(/\/(estudiante|portal)\//);
    for (const e of construirEntradasPrograma('estudiante', 'p1')) expect(e.to).not.toMatch(/\/(facilitador|portal)\//);
  });

  it('danalytics_admin no tiene entradas (su sidebar ya trae Programas)', () => {
    expect(construirEntradasPrograma('danalytics_admin', 'p1')).toEqual([]);
  });

  it('rol desconocido devuelve [] sin lanzar', () => {
    expect(construirEntradasPrograma('rol_inexistente', 'p1')).toEqual([]);
  });
});
