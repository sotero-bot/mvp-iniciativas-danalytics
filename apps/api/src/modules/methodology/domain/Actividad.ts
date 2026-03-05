export class Actividad {
  constructor(
    public id: string,
    public nombre: string,
    public estado: string,
    public config: any
  ) {}
}

export interface IActividadRepository {
  save(actividad: Actividad): Promise<void>;
  findById(id: string): Promise<Actividad | null>;
}
