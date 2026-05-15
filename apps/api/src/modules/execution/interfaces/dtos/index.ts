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
    promptIa?: string;
  }>;
  fechaInicio?: string;
  fechaFin?: string;
  usuario?: { nombre: string; email: string; cargo?: string | null; area?: string | null };
  interacciones: InteraccionDto[];

  constructor(partial: Partial<RunnerResponseDto>) {
    Object.assign(this, partial);
  }
}

export class InteraccionDto {
  pasoId: string;
  contenido: string;
  respuestaUsuario?: string;
  respuestaIa?: string;
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
}
