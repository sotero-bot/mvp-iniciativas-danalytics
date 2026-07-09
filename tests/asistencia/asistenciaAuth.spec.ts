/**
 * Autorización (Plan 2 §0.1) de los controllers de Asistencia (RF-17..RF-21, RN-07).
 */

import 'reflect-metadata';
import { describe, it, expect } from 'vitest';

import { ROLES_KEY } from '../../apps/api/src/modules/auth/guards';
import { FacilitadorAsistenciaController } from '../../apps/api/src/modules/asistencia/interfaces/facilitador-asistencia.controller';
import { AdminAsistenciaController } from '../../apps/api/src/modules/asistencia/interfaces/admin-asistencia.controller';

describe('Autorización de Asistencia', () => {
  it('FacilitadorAsistenciaController declara @Roles(facilitador)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, FacilitadorAsistenciaController)).toEqual(['facilitador']);
  });

  it('AdminAsistenciaController.updateAsistencia declara @Roles(danalytics_admin)', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AdminAsistenciaController.prototype.updateAsistencia,
    );
    expect(roles).toEqual(['danalytics_admin']);
  });

  it('AdminAsistenciaController.resumen incluye admin + roles cliente, NO facilitador (RN-07)', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AdminAsistenciaController.prototype.resumen);
    expect(roles).toEqual(['danalytics_admin', 'cliente_admin', 'usuario_cliente']);
    expect(roles).not.toContain('facilitador');
  });

  it('AdminAsistenciaController.exportar es exclusivo de danalytics_admin (RN-07)', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AdminAsistenciaController.prototype.exportar);
    expect(roles).toEqual(['danalytics_admin']);
  });
});
