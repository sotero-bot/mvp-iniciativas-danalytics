import { PasoActividad } from './PasoActividad';

export interface IPasoActividadRepository {
  create(paso: PasoActividad): Promise<void>;
  findByActividadId(actividadId: string): Promise<PasoActividad[]>;
  existsByActividadIdAndOrden(actividadId: string, orden: number): Promise<boolean>;
}
