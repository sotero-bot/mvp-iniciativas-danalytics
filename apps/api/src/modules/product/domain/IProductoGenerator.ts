export interface IProductoGenerator {
  generarPdf(instanciaId: string): Promise<Buffer>;
}
