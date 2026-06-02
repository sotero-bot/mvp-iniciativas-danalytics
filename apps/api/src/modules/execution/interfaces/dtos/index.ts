export class RespuestaPlantillaAnteriorDto {
  pasoTitulo: string;
  pasoOrden: number;
  contenido?: string;
  respuestaUsuario?: string;
  respuestaIa?: string;
  contenidoArchivo?: string;
}

export class PlantillaAnteriorDto {
  nombre: string;
  respuestas: RespuestaPlantillaAnteriorDto[];
}

export class PreguntaDto {
  id: string;
  orden: number;
  enunciado: string;
  permitirArchivo: boolean;
  soloArchivo: boolean;
  usarIa: boolean;
  iaAutomatica: boolean;
  promptIa?: string;
  urlPlantilla?: string;
  urlPromptTemplate?: string;
  /** Texto del prompt resuelto cuando urlPromptTemplate apunta a S3.
   *  Si el campo viene seteado, el runner debe usarlo directamente sin hacer fetch. */
  promptIaInline?: string;
}

export class PasoRunnerDto {
  id: string;
  titulo: string;
  objetivo?: string;
  instrucciones?: string;
  usarIa?: boolean;
  iaAutomatica?: boolean;
  promptIa?: string;
  permitirArchivo?: boolean;
  soloArchivo?: boolean;
  urlPlantilla?: string;
  ejemploKey?: string;
  preguntas: PreguntaDto[];
}

export class RunnerResponseDto {
  estado: string;
  nombreActividad: string;
  descripcionActividad?: string;
  nombreEmpresa?: string;
  sectorEmpresa?: string;
  tipoOrganizacionEmpresa?: string;
  logoEmpresa?: string;
  usuarioId?: string;
  pasos: PasoRunnerDto[];
  fechaInicio?: string;
  fechaFin?: string;
  usuario?: { nombre: string; email: string; cargo?: string | null; area?: string | null };
  interacciones: InteraccionDto[];
  respuestas: RespuestaDto[];
  plantillaAnterior?: PlantillaAnteriorDto;

  constructor(partial: Partial<RunnerResponseDto>) {
    Object.assign(this, partial);
  }
}

export class InteraccionDto {
  pasoId: string;
  contenido: string;
  respuestaUsuario?: string;
  respuestaIa?: string;
  archivoNombre?: string;
  contenidoArchivo?: string;
  fecha: string;
}

export class RespuestaDto {
  preguntaId: string;
  contenido?: string;
  respuestaUsuario?: string;
  respuestaIa?: string;
  archivoNombre?: string;
  contenidoArchivo?: string;
  archivoKey?: string;
  fecha: string;
}

export class IniciarResponseDto {
  estado: string;
  fechaInicio: string;
}

export class FinalizarResponseDto {
  estado: string;
  fechaFin: string;
}

export class RegistrarRespuestaDto {
  pasoId: string;
  contenido: string;
  respuestaUsuario?: string;
  respuestaIa?: string;
  archivoNombre?: string;
}
