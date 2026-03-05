export interface IGenerarInstanciaUseCase {
  execute(usuarioId: string, actividadId: string): Promise<string>;
}

export interface IRegistrarRespuestaUseCase {
  execute(instanciaId: string, pasoId: string, contenido: string): Promise<void>;
}
