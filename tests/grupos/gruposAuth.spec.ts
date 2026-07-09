/**
 * Autorización (Plan 2 §0.1) de los controllers de Grupos (RF-14/RF-15).
 */

import 'reflect-metadata';
import { describe, it, expect } from 'vitest';

import { ROLES_KEY } from '../../apps/api/src/modules/auth/guards';
import { AdminGruposController } from '../../apps/api/src/modules/grupos/interfaces/admin-grupos.controller';
import { FacilitadorGruposController } from '../../apps/api/src/modules/grupos/interfaces/facilitador-grupos.controller';

describe('Autorización de Grupos', () => {
  it('AdminGruposController declara @Roles(danalytics_admin)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminGruposController)).toEqual(['danalytics_admin']);
  });

  it('FacilitadorGruposController declara @Roles(facilitador)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, FacilitadorGruposController)).toEqual(['facilitador']);
  });
});
