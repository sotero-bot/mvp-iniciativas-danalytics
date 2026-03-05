export class PasoActividadResponseDto {
  id: string;
  actividadId: string;
  titulo: string;
  orden: number;
  usarIa: boolean;
  objetivo?: string;
  instrucciones?: string;
  promptIa?: string;

  constructor(partial: Partial<PasoActividadResponseDto>) {
    Object.assign(this, partial);
  }
}
