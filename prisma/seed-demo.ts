import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

async function run() {
  console.log("Seeding demo data...");

  // 1. Empresa
  const empresa = await prisma.empresa.create({
    data: {
      id: randomUUID(),
      nombre: "DAnalytics Demo Corp",
    },
  });

  // 2. Iniciativa
  const iniciativa = await prisma.iniciativa.create({
    data: {
      id: randomUUID(),
      nombre: "Transformación Digital 2026",
      descripcion: "Proyecto piloto de automatización",
      empresaId: empresa.id,
    },
  });

  // 3. Actividad
  const actividad = await prisma.actividad.create({
    data: {
      id: randomUUID(),
      nombre: "Diagnóstico de Madurez IA",
      descripcion: "Evaluación inicial de capacidades",
      iniciativaId: iniciativa.id,
      estado: "inactiva", // Se requiere inactiva para agregar pasos
    },
  });

  // 4. Pasos
  await prisma.pasoActividad.createMany({
    data: [
      {
        id: randomUUID(),
        actividadId: actividad.id,
        titulo: "Infraestructura Actual",
        objetivo: "Conocer el stack técnico",
        orden: 1,
      },
      {
        id: randomUUID(),
        actividadId: actividad.id,
        titulo: "Equipo Humano",
        objetivo: "Evaluar talento disponible",
        orden: 2,
      },
    ],
  });

  // 5. Usuario
  const usuario = await prisma.usuario.create({
    data: {
      id: randomUUID(),
      nombre: "Juan Perez",
      cargo: "CTO",
      empresaId: empresa.id,
    },
  });

  console.log("Demo data seeded!");
  console.log({
    empresa: empresa.nombre,
    usuario: usuario.nombre,
    actividad: actividad.nombre,
  });

  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
