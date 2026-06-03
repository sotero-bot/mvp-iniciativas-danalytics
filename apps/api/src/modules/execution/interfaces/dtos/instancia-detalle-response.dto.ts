export class InstanciaDetalleResponseDto {
  id: string;
  estado: string;
  fechaInicio?: Date;
  fechaFin?: Date;
  actividad: {
    id: string;
    nombre: string;
    plantillaOrigen?: { id: string; nombre: string } | null;
  };
  usuario: {
    id: string;
    nombre: string;
    email?: string;
    cargo?: string;
    area?: string;
  } | null;
  emailReferencia?: string | null;
  canvasBloques?: Array<{ pasoId: string; resumen: string }>;
  pasos: Array<{
    pasoId: string;
    orden: number;
    titulo: string;
    objetivo?: string;
    instrucciones?: string;
    promptIa?: string | null;
    respuesta: string | null;
    fechaRespuesta: Date | null;
    archivoNombre?: string | null;
    contenidoArchivo?: string | null;
    preguntas: Array<{
      preguntaId: string;
      orden: number;
      enunciado: string;
      respuesta?: string | null;
      respuestaUsuario?: string | null;
      respuestaIa?: string | null;
      archivoNombre?: string | null;
      contenidoArchivo?: string | null;
      fechaRespuesta?: Date | null;
    }>;
  }>;

  constructor(partial: Partial<InstanciaDetalleResponseDto>) {
    Object.assign(this, partial);
  }
}
