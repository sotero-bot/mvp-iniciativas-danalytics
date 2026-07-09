/**
 * Autorización (Plan 2 §0.1) de `AdminNotificacionesController` (RNF-12/RF-40).
 */

import 'reflect-metadata';
import { describe, it, expect } from 'vitest';

import { ROLES_KEY } from '../../apps/api/src/modules/auth/guards';
import { AdminNotificacionesController } from '../../apps/api/src/modules/notificaciones/interfaces/admin-notificaciones.controller';

describe('Autorización de AdminNotificacionesController', () => {
  it('declara @Roles(danalytics_admin)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminNotificacionesController)).toEqual([
      'danalytics_admin',
    ]);
  });
});
