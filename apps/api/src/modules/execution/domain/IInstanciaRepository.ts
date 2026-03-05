import { InstanciaActividad } from './InstanciaActividad';

export interface IInstanciaRepository {
  save(instancia: InstanciaActividad): Promise<void>;
  findById(id: string): Promise<InstanciaActividad | null>;
  findByIdWithRelations(id: string): Promise<any | null>;
  findByUsuario(usuarioId: string): Promise<InstanciaActividad[]>;
  findByAccessToken(token: string): Promise<InstanciaActividad | null>;
}
