export class Empresa {
  constructor(public id: string, public nombre: string) {}
}

export interface IEmpresaRepository {
  save(empresa: Empresa): Promise<void>;
  findAll(): Promise<Empresa[]>;
}
