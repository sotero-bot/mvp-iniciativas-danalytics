export class RespuestaPlantillaAnteriorDto {
  pasoTitulo: string;
  pasoOrden: number;
  contenido?: string;
  respuestaUsuario?: string;
  respuestaIa?: string;
}

export class PlantillaAnteriorDto {
  nombre: string;
  respuestas: RespuestaPlantillaAnteriorDto[];
}

export class RunnerResponseDto {
  estado: string;
  nombreActividad: string;
  descripcionActividad?: string;
  nombreEmpresa?: string;
  logoEmpresa?: string;
  usuarioId?: string;
  pasos: Array<{
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
  }>;
  fechaInicio?: string;
  fechaFin?: string;
  usuario?: { nombre: string; email: string; cargo?: string | null; area?: string | null };
  interacciones: InteraccionDto[];
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
