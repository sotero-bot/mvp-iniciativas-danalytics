/**
 * Autorización (Plan 2 §0.1) de los controllers de Observaciones (RF-39/40/41).
 */

import 'reflect-metadata';
import { describe, it, expect } from 'vitest';

import { ROLES_KEY } from '../../apps/api/src/modules/auth/guards';
import { FacilitadorObservacionesController } from '../../apps/api/src/modules/observaciones/interfaces/facilitador-observaciones.controller';
import { AdminObservacionesController } from '../../apps/api/src/modules/observaciones/interfaces/admin-observaciones.controller';

describe('Autorización de Observaciones', () => {
  it('FacilitadorObservacionesController declara @Roles(facilitador)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, FacilitadorObservacionesController)).toEqual([
      'facilitador',
    ]);
  });

  it('AdminObservacionesController declara @Roles(danalytics_admin)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminObservacionesController)).toEqual([
      'danalytics_admin',
    ]);
  });
});
