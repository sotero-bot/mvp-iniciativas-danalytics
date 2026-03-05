export class InstanciaDetalleResponseDto {
  id: string;
  estado: string;
  fechaInicio?: Date;
  fechaFin?: Date;
  actividad: {
    id: string;
    nombre: string;
  };
  usuario: {
    id: string;
    nombre: string;
  };
  pasos: Array<{
    pasoId: string;
    orden: number;
    titulo: string;
    objetivo?: string;
    instrucciones?: string;
    promptIa?: string | null;
    respuesta: string | null;
    fechaRespuesta: Date | null;
  }>;

  constructor(partial: Partial<InstanciaDetalleResponseDto>) {
    Object.assign(this, partial);
  }
}
