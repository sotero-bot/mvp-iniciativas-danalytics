import { randomUUID } from 'crypto';

export class EnlaceActividad {
    constructor(
        public readonly id: string,
        public readonly actividadId: string,
        public readonly accessToken: string,
        public readonly nombre: string | undefined,
        public readonly activo: boolean,
        public readonly createdAt: Date
    ) { }

    public static crear(actividadId: string, nombre?: string): EnlaceActividad {
        return new EnlaceActividad(
            randomUUID(),
            actividadId,
            randomUUID(),
            nombre,
            true,
            new Date()
        );
    }
}
