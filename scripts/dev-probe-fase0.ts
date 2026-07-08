/**
 * Prueba de lógica de Fase 0 (§0.1) SIN base de datos.
 * Ejercita RolesGuard y ActorScopeService directamente, porque todavía no
 * están montados en ningún endpoint (adopción = Fase 1).
 *
 *   npx tsx scripts/dev-probe-fase0.ts
 */
import { RolesGuard } from '../apps/api/src/modules/auth/guards/roles.guard';
import { ActorScopeService } from '../apps/api/src/modules/auth/scoping/actor-scope.service';
import { AppError } from '../apps/api/src/shared/errors/AppError';
import type { AuthUser } from '../apps/api/src/modules/auth/guards/auth-user';

let ok = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  console.log(`${cond ? '✅' : '❌'} ${label}`);
  cond ? ok++ : fail++;
}

const actor = (role: AuthUser['role'], empresaId: string | null = null): AuthUser => ({
  sub: 's1', userId: 's1', role, empresaId,
});

// Contexto Nest simulado con @Roles(...) via metadata inyectada.
let meta: string[] | undefined;
const reflector = { getAllAndOverride: () => meta } as any;
const ctx = (user: any) => ({
  switchToHttp: () => ({ getRequest: () => ({ user }) }),
  getHandler: () => 'h', getClass: () => 'c',
}) as any;
const guard = new RolesGuard(reflector);
const throwsForbidden = (fn: () => unknown) => {
  try { fn(); return false; } catch (e) { return e instanceof AppError && e.code === 'FORBIDDEN'; }
};

console.log('\n— RolesGuard —');
meta = undefined;
check('sin @Roles → pasa cualquier autenticado', guard.canActivate(ctx(actor('estudiante'))) === true);
meta = ['danalytics_admin'];
check('rol permitido → pasa', guard.canActivate(ctx(actor('danalytics_admin'))) === true);
check('rol NO permitido → FORBIDDEN', throwsForbidden(() => guard.canActivate(ctx(actor('facilitador')))));
check('sin rol → FORBIDDEN', throwsForbidden(() => guard.canActivate(ctx({}))));

console.log('\n— ActorScopeService.programaScope —');
const scope = new ActorScopeService();
check('admin → sin filtro {}', JSON.stringify(scope.programaScope(actor('danalytics_admin'))) === '{}');
check('facilitador → { facilitadorId: sub }',
  JSON.stringify(scope.programaScope(actor('facilitador'))) === JSON.stringify({ facilitadorId: 's1' }));
check('estudiante → participantes.some activo',
  JSON.stringify(scope.programaScope(actor('estudiante'))) ===
  JSON.stringify({ participantes: { some: { usuarioId: 's1', activo: true } } }));
check('cliente_admin → { empresaId } (RN-09)',
  JSON.stringify(scope.programaScope(actor('cliente_admin', 'e1'))) === JSON.stringify({ empresaId: 'e1' }));
check('cliente sin empresa → FORBIDDEN', throwsForbidden(() => scope.programaScope(actor('cliente_admin', null))));

console.log('\n— ActorScopeService.empresaScope —');
check('admin → {} (no se filtra)', JSON.stringify(scope.empresaScope(actor('danalytics_admin'))) === '{}');
check('usuario_cliente → { empresaId }',
  JSON.stringify(scope.empresaScope(actor('usuario_cliente', 'e1'))) === JSON.stringify({ empresaId: 'e1' }));

console.log(`\n${fail === 0 ? '🎉 TODO OK' : '⚠️  HAY FALLOS'} — ${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
