/**
 * Autorización (Plan 2 §0.1) de los controllers de la Fase 2 (form builder,
 * respuesta de formularios y resultados).
 */

import 'reflect-metadata';
import { describe, it, expect } from 'vitest';

import { ROLES_KEY } from '../../apps/api/src/modules/auth/guards';
import { AdminFormulariosController } from '../../apps/api/src/modules/formularios/interfaces/admin-formularios.controller';
import { EstudianteFormulariosController } from '../../apps/api/src/modules/formularios/interfaces/estudiante-formularios.controller';
import { FacilitadorResultadosController } from '../../apps/api/src/modules/formularios/interfaces/facilitador-resultados.controller';
import { ClienteResultadosController } from '../../apps/api/src/modules/formularios/interfaces/cliente-resultados.controller';
import { AdminResultadosController } from '../../apps/api/src/modules/formularios/interfaces/admin-resultados.controller';

describe('Autorización Fase 2 (RF-22…RF-36, RNF-04, RN-07)', () => {
  it('AdminFormulariosController declara @Roles(danalytics_admin)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminFormulariosController)).toEqual(['danalytics_admin']);
  });

  it('EstudianteFormulariosController declara @Roles(estudiante)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, EstudianteFormulariosController)).toEqual(['estudiante']);
  });

  it('FacilitadorResultadosController declara @Roles(facilitador)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, FacilitadorResultadosController)).toEqual(['facilitador']);
  });

  it('ClienteResultadosController declara @Roles(cliente_admin, usuario_cliente)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ClienteResultadosController)).toEqual([
      'cliente_admin',
      'usuario_cliente',
    ]);
  });

  it('AdminResultadosController declara @Roles(danalytics_admin) — RN-07: solo admin exporta', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminResultadosController)).toEqual(['danalytics_admin']);
  });
});
