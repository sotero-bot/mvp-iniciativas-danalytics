import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Limpieza pre-migración: duplicados de Usuario ===\n');

  // 1. Normalizar emails existentes a lowercase + trim
  const allUsers = await prisma.usuario.findMany({ where: { email: { not: null } } });
  let normalized = 0;
  for (const u of allUsers) {
    const clean = u.email!.toLowerCase().trim();
    if (clean !== u.email) {
      await prisma.usuario.update({ where: { id: u.id }, data: { email: clean } });
      normalized++;
    }
  }
  console.log(`Emails normalizados (lower+trim): ${normalized}`);

  // 2. Detectar y consolidar duplicados (empresaId, email)
  const duplicates = await prisma.$queryRaw<Array<{ empresaId: string; email: string; count: bigint }>>`
    SELECT "empresaId", email, COUNT(*) as count
    FROM "Usuario"
    WHERE email IS NOT NULL
    GROUP BY "empresaId", email
    HAVING COUNT(*) > 1;
  `;

  console.log(`\nGrupos duplicados encontrados: ${duplicates.length}`);

  for (const dup of duplicates) {
    const users = await prisma.usuario.findMany({
      where: { empresaId: dup.empresaId, email: dup.email },
      orderBy: { createdAt: 'asc' },
    });
    const [keep, ...remove] = users;
    const removeIds = remove.map((u) => u.id);

    // Reasignar instancias al usuario más antiguo
    const updated = await prisma.instanciaActividad.updateMany({
      where: { usuarioId: { in: removeIds } },
      data: { usuarioId: keep.id },
    });

    // Hard delete de duplicados (no hay otras FK que referncien Usuario.id)
    await prisma.usuario.deleteMany({ where: { id: { in: removeIds } } });

    console.log(
      `  empresa=${dup.empresaId} email=${dup.email}: conservado=${keep.id}, eliminados=${removeIds.length}, instancias reasignadas=${updated.count}`,
    );
  }

  // 3. Reparar emails NULL con placeholder único
  const nullEmails = await prisma.usuario.findMany({ where: { email: null } });
  for (const u of nullEmails) {
    await prisma.usuario.update({
      where: { id: u.id },
      data: { email: `sin-email-${u.id}@placeholder.local` },
    });
  }
  console.log(`\nUsuarios sin email reparados con placeholder: ${nullEmails.length}`);

  // 4. Validación final
  const remaining = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM "Usuario" WHERE email IS NULL;
  `;
  const stillNull = Number(remaining[0].count);
  if (stillNull > 0) {
    console.error(`\nERROR: Aún quedan ${stillNull} usuarios con email NULL. Revisar manualmente.`);
    process.exit(1);
  }

  const remainingDups = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM (
      SELECT "empresaId", email FROM "Usuario"
      GROUP BY "empresaId", email HAVING COUNT(*) > 1
    ) sub;
  `;
  const dupCount = Number(remainingDups[0].count);
  if (dupCount > 0) {
    console.error(`\nERROR: Aún quedan ${dupCount} grupos duplicados. Revisar manualmente.`);
    process.exit(1);
  }

  console.log('\n✓ BD lista para migrar. Sin duplicados ni emails NULL.');
}

main().finally(() => prisma.$disconnect());
