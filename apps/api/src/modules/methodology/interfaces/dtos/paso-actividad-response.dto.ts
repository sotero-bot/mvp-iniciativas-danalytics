export class PasoActividadResponseDto {
  id: string;
  actividadId: string;
  titulo: string;
  orden: number;
  usarIa: boolean;
  iaAutomatica?: boolean;
  objetivo?: string;
  instrucciones?: string;
  promptIa?: string;
  permitirArchivo?: boolean;
  soloArchivo?: boolean;
  urlPlantilla?: string;

  constructor(partial: Partial<PasoActividadResponseDto>) {
    Object.assign(this, partial);
  }
}
