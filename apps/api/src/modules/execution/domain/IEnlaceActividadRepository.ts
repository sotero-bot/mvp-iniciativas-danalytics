import { EnlaceActividad } from './EnlaceActividad';

export interface IEnlaceActividadRepository {
    save(enlace: EnlaceActividad): Promise<void>;
    findByToken(token: string): Promise<EnlaceActividad | null>;
    findAll(): Promise<EnlaceActividad[]>;
}
