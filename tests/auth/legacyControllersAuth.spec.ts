/**
 * Regresión de autorización (RNF-01/02): los controllers legacy (`/organization/*`,
 * `/methodology/actividades`) quedaron históricamente SIN guard, lo que permitía a
 * cualquier actor —incluido `facilitador` o un anónimo— registrar usuarios
 * (`POST /organization/usuarios`) o mutar empresas/iniciativas/actividades.
 *
 * Regla de negocio: el registro de usuarios y la matrícula de estudiantes son
 * EXCLUSIVOS de `danalytics_admin`. El facilitador NO puede registrar ni matricular.
 *
 * Este spec verifica la metadata real de cada controller: guards montados
 * (JwtAuthGuard + RolesGuard) y `@Roles('danalytics_admin')` a nivel de clase.
 */

import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import {
  JwtAuthGuard,
  RolesGuard,
  ROLES_KEY,
} from '../../apps/api/src/modules/auth/guards';
import { UsuariosController } from '../../apps/api/src/modules/organization/interfaces/usuarios.controller';
import { EmpresasController } from '../../apps/api/src/modules/organization/interfaces/empresas.controller';
import { IniciativasController } from '../../apps/api/src/modules/organization/interfaces/iniciativas.controller';
import { ActividadesController } from '../../apps/api/src/modules/methodology/interfaces/actividades.controller';

const LEGACY_CONTROLLERS = [
  ['UsuariosController', UsuariosController],
  ['EmpresasController', EmpresasController],
  ['IniciativasController', IniciativasController],
  ['ActividadesController', ActividadesController],
] as const;

describe('Controllers legacy protegidos como danalytics_admin (RNF-01/02)', () => {
  for (const [nombre, controller] of LEGACY_CONTROLLERS) {
    it(`${nombre}: monta JwtAuthGuard + RolesGuard`, () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
    });

    it(`${nombre}: declara @Roles(danalytics_admin) — facilitador queda excluido`, () => {
      const roles = Reflect.getMetadata(ROLES_KEY, controller);
      expect(roles).toEqual(['danalytics_admin']);
    });
  }
});
