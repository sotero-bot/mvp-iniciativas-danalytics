export class AgregarPasoDto {
  titulo: string;
  orden: number;
  usarIa?: boolean;
  iaAutomatica?: boolean;
  objetivo?: string;
  instrucciones?: string;
  promptIa?: string;
  permitirArchivo?: boolean;
  soloArchivo?: boolean;
  urlPlantilla?: string;
}
