// TODO: Este archivo sería ideal que esté en un módulo 'core' compartido o similar.
// Por brevedad del MVP, simulamos una interfaz muy básica para el PrismaClient.
// En un proyecto real, se inyectaría `PrismaService` generado por @prisma/client.

export type PrismaClientMock = {
  instanciaActividad: {
    findUnique: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any>;
    upsert: (args: any) => Promise<any>;
  };
};
