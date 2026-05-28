export class PreguntaActividadResponseDto {
  id: string;
  pasoId: string;
  orden: number;
  enunciado: string;
  permitirArchivo: boolean;
  soloArchivo: boolean;
  subirArchivoS3: boolean;
  usarIa: boolean;
  iaAutomatica: boolean;
  promptIa?: string | null;
  urlPlantilla?: string | null;
}

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
  ejemploKey?: string;
  preguntas?: PreguntaActividadResponseDto[];

  constructor(partial: Partial<PasoActividadResponseDto>) {
    Object.assign(this, partial);
  }
}
