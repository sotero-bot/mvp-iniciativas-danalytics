/**
 * Seed de datos demo para IA en Acción (Fase 1).
 *
 * Crea (idempotente por email/nombre):
 *   - 1 Empresa "Danalytics Demo" (si no existe).
 *   - 1 Facilitador (email demo).
 *   - 5 Estudiantes.
 *   - 1 Programa activo con 3 sesiones y todos los estudiantes matriculados.
 *
 * NO se ejecuta en Vercel. Manual:
 *   npm run seed:demo-programa
 */

import { PrismaClient, EstadoPrograma } from '@prisma/client';
import { randomUUID } from 'crypto';

// 🔒 Seed de datos DEMO/prueba. NUNCA debe correr en producción/Vercel.
if (process.env.VERCEL || process.env.CI || process.env.NODE_ENV === 'production') {
  console.error('⛔  seed:demo-programa está bloqueado en producción/Vercel/CI. Abortado.');
  process.exit(1);
}

const prisma = new PrismaClient();

const EMPRESA_NOMBRE = 'Danalytics Demo';
const FACILITADOR_EMAIL = 'facilitador.demo@danalytics.co';
const FACILITADOR_NOMBRE = 'Facilitador Demo';
const PROGRAMA_NOMBRE = 'Programa Demo IA en Acción';

const ESTUDIANTES = [
  { email: 'ana.demo@danalytics.co',      nombre: 'Ana Demo',      cargo: 'Analista' },
  { email: 'bruno.demo@danalytics.co',    nombre: 'Bruno Demo',    cargo: 'Coordinador' },
  { email: 'carla.demo@danalytics.co',    nombre: 'Carla Demo',    cargo: 'Product Manager' },
  { email: 'diego.demo@danalytics.co',    nombre: 'Diego Demo',    cargo: 'Data Scientist' },
  { email: 'elena.demo@danalytics.co',    nombre: 'Elena Demo',    cargo: 'Gerente' },
];

async function main() {
  console.log('🌱  Seed demo IA en Acción');

  const roles = await prisma.role.findMany();
  const bySlug = (slug: string) => {
    const r = roles.find(x => x.slug === slug);
    if (!r) throw new Error(`Falta el role ${slug}. Corre npm run seed:admin primero.`);
    return r;
  };
  const facilitadorRoleId = bySlug('facilitador').id;
  const estudianteRoleId = bySlug('estudiante').id;

  // 1. Empresa
  let empresa = await prisma.empresa.findFirst({ where: { nombre: EMPRESA_NOMBRE } });
  if (!empresa) {
    empresa = await prisma.empresa.create({
      data: {
        id: randomUUID(),
        nombre: EMPRESA_NOMBRE,
      },
    });
    console.log(`  Empresa creada: ${empresa.nombre}`);
  } else {
    console.log(`  Empresa existente: ${empresa.nombre}`);
  }

  // 2. Facilitador (email único sin empresa)
  let facilitador = await prisma.usuario.findFirst({
    where: { email: FACILITADOR_EMAIL, empresaId: null },
  });
  if (!facilitador) {
    facilitador = await prisma.usuario.create({
      data: {
        id: randomUUID(),
        email: FACILITADOR_EMAIL,
        nombre: FACILITADOR_NOMBRE,
        roleId: facilitadorRoleId,
        puedeIniciarSesion: true,
      },
    });
    console.log(`  Facilitador creado: ${facilitador.email}`);
  } else {
    console.log(`  Facilitador existente: ${facilitador.email}`);
  }

  // 3. Estudiantes (email único por empresa)
  const estudiantes = await Promise.all(ESTUDIANTES.map(async e => {
    let u = await prisma.usuario.findFirst({
      where: { email: e.email, empresaId: empresa!.id },
    });
    if (!u) {
      u = await prisma.usuario.create({
        data: {
          id: randomUUID(),
          email: e.email,
          nombre: e.nombre,
          cargo: e.cargo,
          empresaId: empresa!.id,
          roleId: estudianteRoleId,
          puedeIniciarSesion: true,
        },
      });
    }
    return u;
  }));
  console.log(`  Estudiantes asegurados: ${estudiantes.length}`);

  // 4. Programa
  let programa = await prisma.programa.findFirst({
    where: { nombre: PROGRAMA_NOMBRE, empresaId: empresa.id },
  });
  if (!programa) {
    programa = await prisma.programa.create({
      data: {
        id: randomUUID(),
        nombre: PROGRAMA_NOMBRE,
        descripcion: 'Programa demo con datos ficticios para desarrollo local.',
        empresaId: empresa.id,
        facilitadorId: facilitador.id,
        estado: EstadoPrograma.activo,
        timezone: 'America/Bogota',
        diasGracia: 7,
        fechaInicio: new Date(),
      },
    });
    console.log(`  Programa creado: ${programa.nombre}`);
  } else {
    console.log(`  Programa existente: ${programa.nombre}`);
  }

  // 5. Sesiones. S1 en el pasado para que el estudiante vea una sesión DESBLOQUEADA
  // (RF-09: el material se ve desde el día siguiente a la sesión).
  const sesiones = [
    { numeroSesion: 1, titulo: 'Kickoff — Introducción al reto con IA', dias: -7 },
    { numeroSesion: 2, titulo: 'Diagnóstico inicial y grupos de trabajo', dias: 0 },
    { numeroSesion: 3, titulo: 'Prototipado con IA y presentación final', dias: 7 },
  ];
  // ~00:01 del día siguiente a `fecha` (aprox. de startOfNextDayInTimeZone, RF-09).
  const nextDayUnlock = (fecha: Date): Date => {
    const x = new Date(fecha);
    x.setDate(x.getDate() + 1);
    x.setHours(0, 1, 0, 0);
    return x;
  };
  for (const s of sesiones) {
    const existing = await prisma.sesion.findFirst({
      where: { programaId: programa.id, numeroSesion: s.numeroSesion },
    });
    if (existing) continue;
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + s.dias);
    await prisma.sesion.create({
      data: {
        id: randomUUID(),
        programaId: programa.id,
        numeroSesion: s.numeroSesion,
        titulo: s.titulo,
        fechaProgramada: fecha,
        // RF-09: sin este campo el material queda bloqueado para el estudiante
        // PARA SIEMPRE (el gating exige materialDesbloqueoEn <= ahora).
        materialDesbloqueoEn: nextDayUnlock(fecha),
      },
    });
  }
  console.log(`  Sesiones aseguradas: ${sesiones.length}`);

  // 6. Matriculación de todos los estudiantes
  for (const u of estudiantes) {
    const existing = await prisma.participantePrograma.findUnique({
      where: { programaId_usuarioId: { programaId: programa.id, usuarioId: u.id } },
    });
    if (!existing) {
      await prisma.participantePrograma.create({
        data: {
          id: randomUUID(),
          programaId: programa.id,
          usuarioId: u.id,
        },
      });
    }
  }
  console.log(`  Participantes matriculados: ${estudiantes.length}`);

  console.log('✅  Seed demo completado');
  console.log(`\n   Programa: ${programa.nombre}`);
  console.log(`   Empresa:  ${empresa.nombre}`);
  console.log(`   URL:      /admin/programas (buscar el programa demo)\n`);
}

main()
  .catch(err => {
    console.error('❌  Seed demo falló:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
