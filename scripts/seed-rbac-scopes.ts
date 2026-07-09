/**
 * Seed de escenarios RBAC — usuarios, roles y ALCANCES (Fase 1).
 *
 * A diferencia de `seed:demo-programa` (un programa "feliz"), este script arma
 * una matriz de DOS empresas + facilitadores externos pensada para PROBAR los
 * límites de autorización que valida la Fase 1:
 *
 *   - RNF-02  aislamiento entre programas/facilitadores (facilitador A no ve B).
 *   - RF-03   revocación de facilitador tras la gracia vencida (programa finalizado).
 *   - RN-09   scoping por empresa del cliente_admin / usuario_cliente.
 *   - RN-07   export solo admin (facilitador/cliente → 403).
 *   - RF-08/09 gating de sesiones (futura/hoy) para facilitador y estudiante.
 *   - RN-04   un estudiante en un solo grupo por programa.
 *
 * TODOS los usuarios se crean con contraseña (bcrypt) + `username` = email +
 * `puedeIniciarSesion`, así que entran por `POST /auth/login` con cualquier rol
 * (requiere el login generalizado en auth.service `validateUser`).
 *
 * Idempotente (create-if-missing por email/nombre). NO borra nada.
 * NO se ejecuta en Vercel. Uso local:
 *   TEST_PASSWORD='Prueba123*' npx tsx scripts/seed-rbac-scopes.ts
 */

import { PrismaClient, EstadoPrograma, EstadoSesion } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

// 🔒 Este seed crea usuarios de PRUEBA con contraseña conocida. NUNCA debe correr
// en producción/Vercel (mismo criterio que el veto a reset-data en el deploy).
if (process.env.VERCEL || process.env.CI || process.env.NODE_ENV === 'production') {
  console.error('⛔  seed:rbac-scopes está bloqueado en producción/Vercel/CI. Abortado.');
  process.exit(1);
}

const prisma = new PrismaClient();

const PASSWORD = process.env.TEST_PASSWORD ?? 'Prueba123*';

// Dominios .test para no colisionar con datos reales ni con el demo seed.
const EMP_A = { nombre: 'Acme Corp (RBAC test)', dominio: 'acme-rbac.test' };
const EMP_B = { nombre: 'Globex (RBAC test)', dominio: 'globex-rbac.test' };

// ─── helpers de fecha ────────────────────────────────────────────────────────
const now = new Date();
function daysFromNow(d: number): Date {
  const x = new Date(now);
  x.setDate(x.getDate() + d);
  return x;
}
function startOfToday(): Date {
  const x = new Date(now);
  x.setHours(0, 1, 0, 0); // 00:01 de hoy → siempre <= now para el facilitador
  return x;
}
/** ~00:01 del día siguiente (aprox. la lógica de startOfNextDayInTimeZone). */
function nextDayUnlock(from: Date): Date {
  const x = new Date(from);
  x.setDate(x.getDate() + 1);
  x.setHours(0, 1, 0, 0);
  return x;
}

// ─── helpers idempotentes ─────────────────────────────────────────────────────
async function ensureEmpresa(nombre: string, dominio: string) {
  const found = await prisma.empresa.findFirst({ where: { nombre } });
  if (found) {
    if (found.dominioGoogleWorkspace !== dominio) {
      await prisma.empresa.update({ where: { id: found.id }, data: { dominioGoogleWorkspace: dominio } });
    }
    return found;
  }
  return prisma.empresa.create({
    data: { id: randomUUID(), nombre, dominioGoogleWorkspace: dominio },
  });
}

async function ensureUsuario(opts: {
  email: string;
  nombre: string;
  roleSlug: string;
  empresaId: string | null;
  cargo?: string;
}) {
  const roleIds = await getRoleIds();
  const hashed = await bcrypt.hash(PASSWORD, 10);
  const existing = await prisma.usuario.findFirst({
    where: { email: opts.email, empresaId: opts.empresaId },
  });
  const data = {
    email: opts.email,
    username: opts.email, // login por username == email
    nombre: opts.nombre,
    cargo: opts.cargo ?? null,
    password: hashed,
    roleId: roleIds[opts.roleSlug],
    empresaId: opts.empresaId,
    puedeIniciarSesion: true,
    activo: true,
  };
  if (existing) {
    return prisma.usuario.update({ where: { id: existing.id }, data });
  }
  return prisma.usuario.create({ data: { id: randomUUID(), ...data } });
}

let _roleIds: Record<string, string> | null = null;
async function getRoleIds() {
  if (_roleIds) return _roleIds;
  const roles = await prisma.role.findMany();
  _roleIds = Object.fromEntries(roles.map((r) => [r.slug, r.id]));
  for (const slug of ['danalytics_admin', 'facilitador', 'estudiante', 'cliente_admin', 'usuario_cliente']) {
    if (!_roleIds[slug]) throw new Error(`Falta el role ${slug}. Corre "npm run seed:admin" primero.`);
  }
  return _roleIds;
}

async function ensurePrograma(opts: {
  nombre: string;
  empresaId: string;
  facilitadorId: string;
  estado: EstadoPrograma;
  fechaInicio?: Date;
  fechaFin?: Date;
  diasGracia?: number;
  marcarSesionAutomatica?: boolean;
  totalSesionesEsperadas?: number;
}) {
  const existing = await prisma.programa.findFirst({
    where: { nombre: opts.nombre, empresaId: opts.empresaId },
  });
  const data = {
    nombre: opts.nombre,
    descripcion: 'Programa de prueba de alcances RBAC (Fase 1).',
    empresaId: opts.empresaId,
    facilitadorId: opts.facilitadorId,
    estado: opts.estado,
    timezone: 'America/Bogota',
    diasGracia: opts.diasGracia ?? 3,
    marcarSesionAutomatica: opts.marcarSesionAutomatica ?? false,
    totalSesionesEsperadas: opts.totalSesionesEsperadas ?? null,
    fechaInicio: opts.fechaInicio ?? null,
    fechaFin: opts.fechaFin ?? null,
  };
  if (existing) {
    return prisma.programa.update({ where: { id: existing.id }, data });
  }
  return prisma.programa.create({ data: { id: randomUUID(), ...data } });
}

async function ensureSesion(opts: {
  programaId: string;
  numeroSesion: number;
  titulo: string;
  fechaProgramada: Date;
  estado?: EstadoSesion;
  materialArchivoKey?: string;
  urlGrabacion?: string;
  materialDesbloqueoEn?: Date;
}) {
  const existing = await prisma.sesion.findFirst({
    where: { programaId: opts.programaId, numeroSesion: opts.numeroSesion },
  });
  const data = {
    programaId: opts.programaId,
    numeroSesion: opts.numeroSesion,
    titulo: opts.titulo,
    fechaProgramada: opts.fechaProgramada,
    estado: opts.estado ?? EstadoSesion.pendiente,
    materialArchivoKey: opts.materialArchivoKey ?? null,
    urlGrabacion: opts.urlGrabacion ?? null,
    materialDesbloqueoEn: opts.materialDesbloqueoEn ?? null,
  };
  if (existing) return prisma.sesion.update({ where: { id: existing.id }, data });
  return prisma.sesion.create({ data: { id: randomUUID(), ...data } });
}

async function ensureParticipante(programaId: string, usuarioId: string) {
  const existing = await prisma.participantePrograma.findUnique({
    where: { programaId_usuarioId: { programaId, usuarioId } },
  });
  if (existing) return existing;
  return prisma.participantePrograma.create({
    data: { id: randomUUID(), programaId, usuarioId },
  });
}

async function ensureGrupo(programaId: string, nombre: string, orden: number, creadoPorId: string) {
  const existing = await prisma.grupo.findFirst({ where: { programaId, nombre } });
  if (existing) return existing;
  return prisma.grupo.create({
    data: { id: randomUUID(), programaId, nombre, orden, creadoPorId },
  });
}

async function ensureMiembro(grupoId: string, programaId: string, usuarioId: string) {
  const existing = await prisma.miembroGrupo.findFirst({ where: { programaId, usuarioId } });
  if (existing) return existing;
  return prisma.miembroGrupo.create({
    data: { id: randomUUID(), grupoId, programaId, usuarioId },
  });
}

// ─── main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱  Seed de escenarios RBAC (roles + alcances)\n');

  const roleIds = await getRoleIds();
  const admin = await prisma.usuario.findFirst({ where: { roleId: roleIds['danalytics_admin'] } });
  if (!admin) throw new Error('No hay usuario danalytics_admin. Corre "npm run seed:admin" primero.');

  // Empresas
  const empA = await ensureEmpresa(EMP_A.nombre, EMP_A.dominio);
  const empB = await ensureEmpresa(EMP_B.nombre, EMP_B.dominio);

  // Facilitadores (contratistas externos → empresaId null)
  const facA = await ensureUsuario({ email: 'fac.a@rbac.test', nombre: 'Facilitador A', roleSlug: 'facilitador', empresaId: null });
  const facB = await ensureUsuario({ email: 'fac.b@rbac.test', nombre: 'Facilitador B', roleSlug: 'facilitador', empresaId: null });

  // Roles cliente (uno por empresa; cliente_admin único por empresa lo impone la BD)
  const cliA = await ensureUsuario({ email: 'cliente.a@acme-rbac.test', nombre: 'Cliente Admin A', roleSlug: 'cliente_admin', empresaId: empA.id });
  const usrA = await ensureUsuario({ email: 'user.a@acme-rbac.test', nombre: 'Usuario Cliente A', roleSlug: 'usuario_cliente', empresaId: empA.id });
  const cliB = await ensureUsuario({ email: 'cliente.b@globex-rbac.test', nombre: 'Cliente Admin B', roleSlug: 'cliente_admin', empresaId: empB.id });

  // Estudiantes
  const estA: any[] = [];
  for (let i = 1; i <= 4; i++) {
    estA.push(await ensureUsuario({ email: `est.a${i}@acme-rbac.test`, nombre: `Estudiante A${i}`, roleSlug: 'estudiante', empresaId: empA.id }));
  }
  const estB: any[] = [];
  for (let i = 1; i <= 2; i++) {
    estB.push(await ensureUsuario({ email: `est.b${i}@globex-rbac.test`, nombre: `Estudiante B${i}`, roleSlug: 'estudiante', empresaId: empB.id }));
  }
  console.log('  Usuarios asegurados: 2 facilitadores, 3 cliente/usuario, 6 estudiantes\n');

  // ── Programa A1: activo, con gating de sesiones y grupos ──
  const progA1 = await ensurePrograma({
    nombre: 'Acme · Programa Activo', empresaId: empA.id, facilitadorId: facA.id,
    estado: EstadoPrograma.activo, fechaInicio: daysFromNow(-20),
    marcarSesionAutomatica: true, totalSesionesEsperadas: 3,
  });
  // S1 pasada (material desbloqueado), S2 hoy (facilitador ve, estudiante bloqueado hasta mañana), S3 futura (bloqueada)
  await ensureSesion({ programaId: progA1.id, numeroSesion: 1, titulo: 'S1 · Kickoff (pasada)', fechaProgramada: daysFromNow(-14), estado: EstadoSesion.completada, materialArchivoKey: 'programas/rbac/a1/s1/material.pdf', urlGrabacion: 'https://example.test/rec/a1-s1', materialDesbloqueoEn: nextDayUnlock(daysFromNow(-14)) });
  const s2 = startOfToday();
  await ensureSesion({ programaId: progA1.id, numeroSesion: 2, titulo: 'S2 · Diagnóstico (hoy)', fechaProgramada: s2, materialArchivoKey: 'programas/rbac/a1/s2/material.pdf', materialDesbloqueoEn: nextDayUnlock(s2) });
  await ensureSesion({ programaId: progA1.id, numeroSesion: 3, titulo: 'S3 · Prototipado (futura)', fechaProgramada: daysFromNow(7), materialArchivoKey: 'programas/rbac/a1/s3/material.pdf', materialDesbloqueoEn: nextDayUnlock(daysFromNow(7)) });
  for (const e of estA) await ensureParticipante(progA1.id, e.id);
  const g1 = await ensureGrupo(progA1.id, 'Grupo 1', 1, admin.id);
  const g2 = await ensureGrupo(progA1.id, 'Grupo 2', 2, admin.id);
  await ensureMiembro(g1.id, progA1.id, estA[0].id); // est.a1 → G1
  await ensureMiembro(g1.id, progA1.id, estA[1].id); // est.a2 → G1
  await ensureMiembro(g2.id, progA1.id, estA[2].id); // est.a3 → G2
  // est.a4 queda SIN grupo (para probar asignación); est.a1 ya en G1 (para probar RN-04)

  // ── Programa A2: finalizado con gracia VENCIDA (RF-03) ──
  const progA2 = await ensurePrograma({
    nombre: 'Acme · Programa Finalizado (gracia vencida)', empresaId: empA.id, facilitadorId: facA.id,
    estado: EstadoPrograma.finalizado, fechaInicio: daysFromNow(-60), fechaFin: daysFromNow(-30), diasGracia: 3,
  });
  await ensureSesion({ programaId: progA2.id, numeroSesion: 1, titulo: 'S1 · Sesión pasada', fechaProgramada: daysFromNow(-40), estado: EstadoSesion.completada, materialDesbloqueoEn: nextDayUnlock(daysFromNow(-40)) });
  await ensureParticipante(progA2.id, estA[0].id);

  // ── Programa B1: empresa B, facilitador B (aislamiento RNF-02/RN-09) ──
  const progB1 = await ensurePrograma({
    nombre: 'Globex · Programa Activo', empresaId: empB.id, facilitadorId: facB.id,
    estado: EstadoPrograma.activo, fechaInicio: daysFromNow(-10), totalSesionesEsperadas: 2,
  });
  await ensureSesion({ programaId: progB1.id, numeroSesion: 1, titulo: 'S1 · Kickoff (pasada)', fechaProgramada: daysFromNow(-7), estado: EstadoSesion.completada, materialArchivoKey: 'programas/rbac/b1/s1/material.pdf', materialDesbloqueoEn: nextDayUnlock(daysFromNow(-7)) });
  await ensureSesion({ programaId: progB1.id, numeroSesion: 2, titulo: 'S2 · Taller (futura)', fechaProgramada: daysFromNow(5), materialDesbloqueoEn: nextDayUnlock(daysFromNow(5)) });
  for (const e of estB) await ensureParticipante(progB1.id, e.id);
  const gB1 = await ensureGrupo(progB1.id, 'Grupo B1', 1, admin.id);
  await ensureMiembro(gB1.id, progB1.id, estB[0].id);

  console.log('  Programas asegurados: A1 (activo), A2 (finalizado/gracia vencida), B1 (empresa B)\n');

  // ── Resumen imprimible ──
  const line = (r: string, u: string, s: string) => `  ${r.padEnd(16)} ${u.padEnd(34)} ${s}`;
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log(`  CONTRASEÑA (todos):  ${PASSWORD}`);
  console.log('  Login:  POST /api/auth/login  { "username": "<email>", "password": "<contraseña>" }');
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log(line('ROL', 'USERNAME (=email)', 'EMPRESA / ALCANCE'));
  console.log('  ' + '─'.repeat(70));
  console.log(line('danalytics_admin', admin.username ?? '(admin del seed-admin)', 'todo'));
  console.log(line('facilitador', facA.email!, 'A1 (activo) + A2 (finalizado/gracia vencida)'));
  console.log(line('facilitador', facB.email!, 'B1 (empresa B)'));
  console.log(line('cliente_admin', cliA.email!, EMP_A.nombre));
  console.log(line('usuario_cliente', usrA.email!, EMP_A.nombre));
  console.log(line('cliente_admin', cliB.email!, EMP_B.nombre));
  estA.forEach((e) => console.log(line('estudiante', e.email!, 'Acme · matriculado en A1')));
  estB.forEach((e) => console.log(line('estudiante', e.email!, 'Globex · matriculado en B1')));
  console.log('  ' + '─'.repeat(70));
  console.log('\n  IDs útiles:');
  console.log(`    progA1 (activo)      = ${progA1.id}`);
  console.log(`    progA2 (finalizado)  = ${progA2.id}`);
  console.log(`    progB1 (empresa B)   = ${progB1.id}`);
  console.log(`    grupoA1-G1           = ${g1.id}  (est.a1, est.a2)`);
  console.log(`    grupoA1-G2           = ${g2.id}  (est.a3)  · est.a4 sin grupo`);

  console.log('\n  Pruebas de ALCANCE sugeridas (todas contra /api, con Bearer del rol):');
  console.log('    RNF-02  facA → GET /facilitador/programas/' + progB1.id + '/grupos            → 403');
  console.log('    RF-03   facA → GET /facilitador/programas/' + progA2.id + '/grupos            → 403 (gracia vencida)');
  console.log('    RF-08   facA → GET /sesiones/{S3 futura de A1}/material                    → 403 SESION_BLOQUEADA');
  console.log('    RF-09   estA1 → GET /sesiones/{S2 hoy de A1}/material                       → 403 (hasta mañana 00:01)');
  console.log('    RF-09   estA1 → GET /sesiones/{S1 pasada de A1}/material                    → 200 URL firmada');
  console.log('    RN-09   cliA → GET /admin/programas/' + progB1.id + '/asistencia/resumen     → 403 (otra empresa)');
  console.log('    RN-09   cliA → GET /admin/programas/' + progA1.id + '/asistencia/resumen     → 200 (su empresa)');
  console.log('    RN-07   facA/cliA → GET /admin/programas/' + progA1.id + '/asistencia/export → 403 (solo admin)');
  console.log('    RN-04   admin → POST /admin/grupos/' + g2.id + '/miembros {usuarioId: est.a1} → MIEMBRO_YA_EN_GRUPO');
  console.log('    RN-04   admin → POST /admin/grupos/' + g1.id + '/miembros {usuarioId: est.b1} → MIEMBRO_NO_PARTICIPA');

  console.log('\n✅  Seed RBAC completado');
}

main()
  .catch((err) => {
    console.error('❌  Seed RBAC falló:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
