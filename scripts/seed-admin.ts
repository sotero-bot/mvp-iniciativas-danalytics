/**
 * Semilla de roles y del usuario administrador de Danalytics.
 *
 * Este script:
 *   1. Aplica índices parciales de Postgres que no son expresables en el
 *      schema.prisma (usuario_email_sin_empresa). Idempotente vía IF NOT EXISTS.
 *   2. Upsertea los 6 roles del sistema en la tabla Role.
 *   3. Backfillea Usuario.roleId de los usuarios existentes que aún no
 *      tienen role asignado (les asigna 'participante_legacy').
 *   4. Upsertea el admin en Usuario con role=danalytics_admin.
 *   5. Upsertea las listas de destinatarios de notificaciones (RF-40).
 *
 * Se ejecuta en cada `vercel-build` después de `prisma db push`.
 *
 * Uso:
 *   npx tsx scripts/seed-admin.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ADMIN_USERNAME = 'admin';
const ADMIN_NOMBRE = 'Admin Principal';
const ADMIN_PASSWORD = 'dax1973*';

interface RoleSeed {
  slug: string;
  nombre: string;
  descripcion: string;
}

const ROLES: RoleSeed[] = [
  { slug: 'danalytics_admin',    nombre: 'Admin Danalytics',   descripcion: 'Equipo Danalytics con acceso total al sistema.' },
  { slug: 'facilitador',         nombre: 'Facilitador',        descripcion: 'Contratista externo asignado a uno o más programas.' },
  { slug: 'estudiante',          nombre: 'Estudiante',         descripcion: 'Participante de un programa de IA en Acción.' },
  { slug: 'cliente_admin',       nombre: 'Admin de cliente',   descripcion: 'Gerente designado por la organización cliente.' },
  { slug: 'usuario_cliente',     nombre: 'Usuario cliente',    descripcion: 'Usuario adicional invitado por el cliente_admin.' },
  { slug: 'participante_legacy', nombre: 'Participante legacy', descripcion: 'Usuario preexistente de Decisión IA sin capacidad de login.' },
];

async function ensureIndices() {
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "usuario_email_sin_empresa"
      ON "Usuario"("email")
      WHERE "empresaId" IS NULL AND "email" IS NOT NULL;
  `);
  console.log('  Índice usuario_email_sin_empresa asegurado');
}

async function upsertRoles() {
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { slug: r.slug },
      update: { nombre: r.nombre, descripcion: r.descripcion, activo: true },
      create: { slug: r.slug, nombre: r.nombre, descripcion: r.descripcion, activo: true },
    });
  }
  console.log(`  ${ROLES.length} roles upserteados`);
}

async function backfillLegacyUsers() {
  const legacyRole = await prisma.role.findUniqueOrThrow({
    where: { slug: 'participante_legacy' },
  });
  const result = await prisma.usuario.updateMany({
    where: { roleId: null },
    data: { roleId: legacyRole.id, puedeIniciarSesion: false },
  });
  if (result.count > 0) {
    console.log(`  ${result.count} usuarios existentes marcados como participante_legacy`);
  }
}

function parseEmails(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function upsertConfiguracionNotificaciones() {
  // Configurable en runtime por el admin; el seed solo garantiza que las claves existan.
  // Se pueblan desde env en el primer deploy; upsert no pisa cambios manuales de emails.
  const normales = parseEmails(process.env.NOTIF_ADMIN_EMAILS);
  const urgentes = parseEmails(process.env.NOTIF_ADMIN_EMAILS_URGENTE) ;

  const configs = [
    {
      clave: 'admins_observacion_normal',
      descripcion: 'Destinatarios de observaciones normales del facilitador (RF-40).',
      emailsDefault: normales,
    },
    {
      clave: 'admins_observacion_urgente',
      descripcion: 'Destinatarios de observaciones URGENTES del facilitador (RF-40).',
      emailsDefault: urgentes.length ? urgentes : normales,
    },
  ];

  for (const c of configs) {
    await prisma.configuracionNotificacion.upsert({
      where: { clave: c.clave },
      // No sobreescribimos "emails" en update: el admin puede haberlos editado por UI.
      update: { descripcion: c.descripcion },
      create: { clave: c.clave, descripcion: c.descripcion, emails: c.emailsDefault },
    });
  }
  console.log(`  ${configs.length} claves de ConfiguracionNotificacion aseguradas`);
}

async function upsertAdmin() {
  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { slug: 'danalytics_admin' },
  });
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await prisma.usuario.upsert({
    where: { username: ADMIN_USERNAME },
    update: {
      password: hashedPassword,
      roleId: adminRole.id,
      puedeIniciarSesion: true,
      activo: true,
    },
    create: {
      username: ADMIN_USERNAME,
      nombre: ADMIN_NOMBRE,
      password: hashedPassword,
      roleId: adminRole.id,
      puedeIniciarSesion: true,
      activo: true,
    },
  });

  console.log(`  Admin "${ADMIN_USERNAME}" upserteado en Usuario`);
}

async function main() {
  console.log('🌱  Seed de roles y admin');
  await ensureIndices();
  await upsertRoles();
  await backfillLegacyUsers();
  await upsertAdmin();
  await upsertConfiguracionNotificaciones();
  console.log('✅  Seed completado');
}

main()
  .catch((err) => {
    console.error('❌  Seed falló:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
