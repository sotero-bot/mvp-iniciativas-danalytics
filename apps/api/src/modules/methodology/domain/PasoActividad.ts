export class PasoActividad {
  constructor(
    public readonly id: string,
    public readonly actividadId: string,
    public readonly titulo: string,
    public readonly orden: number,
    public readonly usarIa: boolean = false,
    public readonly objetivo?: string,
    public readonly instrucciones?: string,
    public readonly promptIa?: string,
    public readonly permitirArchivo: boolean = false,
    public readonly soloArchivo: boolean = false,
    public readonly urlPlantilla?: string,
    public readonly iaAutomatica: boolean = false,
  ) { }
}
