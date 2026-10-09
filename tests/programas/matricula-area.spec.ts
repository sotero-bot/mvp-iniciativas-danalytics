/**
 * HU-14: resolución de área en la matrícula individual y la importación masiva.
 *  - Importación: find-or-create del área en el catálogo de la empresa del programa.
 *  - `areasNuevas` es un campo TOP-LEVEL de la respuesta, nunca un `aviso` por fila
 *    (los avisos bloquean el "todo o nada" del importador).
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx');

import { AdminProgramasController } from '../../apps/api/src/modules/programas/interfaces/admin-programas.controller';

const PROGRAMA = { id: 'p1', empresaId: 'e1', timezone: 'America/Bogota' };

function build(areasIniciales: Array<{ id: string; empresaId: string; nombre: string; activo?: boolean }> = []) {
  const areas = areasIniciales.map(a => ({ activo: true, ...a }));
  const prisma: any = {
    programa: { findUnique: vi.fn().mockResolvedValue(PROGRAMA) },
    usuario: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'u-new', ...data })),
    },
    role: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'role-estudiante' }) },
    participantePrograma: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'part1', ...data })),
    },
    areaEmpresa: {
      findMany: vi.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(
          areas.filter(a => a.empresaId === where.empresaId && (where.activo === undefined || a.activo === where.activo)),
        ),
      ),
      findUnique: vi.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(areas.find(a => a.id === where.id) ?? null),
      ),
      create: vi.fn().mockImplementation(({ data }: any) => {
        const nueva = { id: `a-${areas.length + 1}`, activo: true, ...data };
        areas.push(nueva);
        return Promise.resolve(nueva);
      }),
      update: vi.fn().mockImplementation(({ where, data }: any) => {
        const a = areas.find(x => x.id === where.id)!;
        Object.assign(a, data);
        return Promise.resolve(a);
      }),
    },
  };
  prisma.$transaction = vi.fn().mockImplementation((cb: any) => cb(prisma));
  const controller = new AdminProgramasController(
    prisma,
    { createAndSend: vi.fn().mockResolvedValue(undefined) } as any,
    {} as any,
    {} as any,
  );
  return { controller, prisma, areas };
}

function excel(filas: Array<[string, string, string, string]>) {
  const file = path.join(os.tmpdir(), `matricula-area-${randomUUID()}.xlsx`);
  const ws = XLSX.utils.aoa_to_sheet([['email', 'nombre', 'cargo', 'area'], ...filas]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Participantes');
  XLSX.writeFile(wb, file);
  return { path: file, originalname: 'participantes.xlsx' } as any;
}

const importar = (c: AdminProgramasController, file: any, validarSolo = false) =>
  c.importarParticipantes('p1', file, { validarSolo: validarSolo ? '1' : '0', enviarInvitacion: '0' });

describe('Importación masiva — find-or-create de área', () => {
  it('área inexistente: la crea al registrar y la reporta en areasNuevas', async () => {
    const { controller, prisma } = build();
    const res: any = await importar(controller, excel([['a@x.com', 'Ana', 'Analista', 'Diseño']]));
    expect(res.registrado).toBe(true);
    expect(prisma.areaEmpresa.create).toHaveBeenCalledTimes(1);
    expect(prisma.areaEmpresa.create.mock.calls[0][0].data).toMatchObject({ empresaId: 'e1', nombre: 'Diseño' });
    expect(res.areasNuevas).toEqual(['Diseño']);
    // Se setean AMBOS campos en el usuario nuevo.
    expect(prisma.usuario.create.mock.calls[0][0].data).toMatchObject({ area: 'Diseño', areaId: 'a-1' });
  });

  it('dry-run: reporta areasNuevas pero NO escribe nada', async () => {
    const { controller, prisma } = build();
    const res: any = await importar(controller, excel([['a@x.com', 'Ana', '', 'Diseño']]), true);
    expect(res.registrado).toBe(false);
    expect(res.areasNuevas).toEqual(['Diseño']);
    expect(prisma.areaEmpresa.create).not.toHaveBeenCalled();
    expect(prisma.usuario.create).not.toHaveBeenCalled();
  });

  it('área existente con otra grafía: la reutiliza, no duplica ni la reporta', async () => {
    const { controller, prisma } = build([{ id: 'a-diseno', empresaId: 'e1', nombre: 'Diseño' }]);
    const res: any = await importar(controller, excel([['a@x.com', 'Ana', '', '  diseño ']]));
    expect(prisma.areaEmpresa.create).not.toHaveBeenCalled();
    expect(res.areasNuevas).toEqual([]);
    expect(prisma.usuario.create.mock.calls[0][0].data).toMatchObject({ area: 'Diseño', areaId: 'a-diseno' });
  });

  it('grafías distintas de la misma área nueva en el mismo archivo: se crea UNA sola', async () => {
    const { controller, prisma } = build();
    const res: any = await importar(
      controller,
      excel([
        ['a@x.com', 'Ana', '', 'Operaciones'],
        ['b@x.com', 'Beto', '', 'operaciones'],
      ]),
    );
    expect(prisma.areaEmpresa.create).toHaveBeenCalledTimes(1);
    expect(res.areasNuevas).toEqual(['Operaciones']);
  });

  it('un área de OTRA empresa con el mismo nombre no cuenta como existente', async () => {
    const { controller, prisma } = build([{ id: 'a-otra', empresaId: 'e2', nombre: 'Diseño' }]);
    const res: any = await importar(controller, excel([['a@x.com', 'Ana', '', 'Diseño']]));
    expect(prisma.areaEmpresa.create).toHaveBeenCalledTimes(1);
    expect(res.areasNuevas).toEqual(['Diseño']);
  });

  it('areasNuevas es top-level: no genera avisos/errores por fila ni bloquea el todo-o-nada', async () => {
    const { controller } = build();
    const res: any = await importar(controller, excel([['a@x.com', 'Ana', '', 'Diseño']]), true);
    expect(Array.isArray(res.areasNuevas)).toBe(true);
    expect(res.filas[0].estado).toBe('ok');
    expect(res.filas[0].errores).toEqual([]);
    expect(res.resumen).toEqual({ total: 1, ok: 1, error: 0 });
    expect(res.filas[0]).not.toHaveProperty('areasNuevas');
  });

  it('sin áreas nuevas: areasNuevas es [] (siempre presente)', async () => {
    const { controller } = build();
    const res: any = await importar(controller, excel([['a@x.com', 'Ana', '', '']]), true);
    expect(res.areasNuevas).toEqual([]);
  });
});

describe('Matrícula individual — areaId', () => {
  it('areaId de OTRA empresa → AREA_EMPRESA_INVALIDA y no matricula', async () => {
    const { controller, prisma } = build([{ id: 'a-otra', empresaId: 'e2', nombre: 'Diseño' }]);
    await expect(
      controller.matricular('p1', { email: 'a@x.com', nombre: 'Ana', areaId: 'a-otra', enviarInvitacion: false } as any),
    ).rejects.toMatchObject({ code: 'AREA_EMPRESA_INVALIDA', statusCode: 409 });
    expect(prisma.usuario.create).not.toHaveBeenCalled();
    expect(prisma.participantePrograma.create).not.toHaveBeenCalled();
  });

  it('areaId inexistente → AREA_EMPRESA_INVALIDA', async () => {
    const { controller } = build();
    await expect(
      controller.matricular('p1', { email: 'a@x.com', nombre: 'Ana', areaId: 'nope', enviarInvitacion: false } as any),
    ).rejects.toMatchObject({ code: 'AREA_EMPRESA_INVALIDA' });
  });

  it('areaId válido: setea areaId y mantiene `area` (texto) sincronizado con el catálogo', async () => {
    const { controller, prisma } = build([{ id: 'a1', empresaId: 'e1', nombre: 'Diseño' }]);
    await controller.matricular('p1', { email: 'a@x.com', nombre: 'Ana', areaId: 'a1', enviarInvitacion: false } as any);
    expect(prisma.usuario.create.mock.calls[0][0].data).toMatchObject({ areaId: 'a1', area: 'Diseño' });
  });
});

describe('Plantilla Excel — hoja Areas', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ExcelJS = require('exceljs');

  async function descargar(controller: AdminProgramasController, programaId?: string) {
    const headers: Record<string, string> = {};
    let body: Buffer | undefined;
    const res: any = {
      setHeader: (k: string, v: string) => (headers[k] = v),
      end: (b: Buffer) => (body = b),
    };
    await (controller as any).descargarPlantillaParticipantes(res, programaId);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(body!);
    return wb;
  }

  it('sin ?programaId= queda intacta: una sola hoja y sin validación', async () => {
    const { controller } = build();
    const wb = await descargar(controller);
    expect(wb.worksheets.map((w: any) => w.name)).toEqual(['Participantes']);
    expect(wb.getWorksheet('Participantes').getCell('D2').dataValidation?.type).toBeUndefined();
  });

  it('con ?programaId=: añade la hoja Areas con las áreas ACTIVAS de la empresa y un dataValidation de lista', async () => {
    const { controller } = build([
      { id: 'a1', empresaId: 'e1', nombre: 'Diseño' },
      { id: 'a2', empresaId: 'e1', nombre: 'Operaciones' },
      { id: 'a3', empresaId: 'e1', nombre: 'Vieja', activo: false },
      { id: 'a4', empresaId: 'e2', nombre: 'De otra empresa' },
    ]);
    const wb = await descargar(controller, 'p1');
    expect(wb.worksheets.map((w: any) => w.name)).toEqual(['Participantes', 'Areas']);
    const nombres = wb.getWorksheet('Areas').getColumn(1).values.slice(2).filter(Boolean); // sin índice 0 ni cabecera
    expect(nombres).toEqual(['Diseño', 'Operaciones']);
    const dv = wb.getWorksheet('Participantes').getCell('D2').dataValidation;
    expect(dv.type).toBe('list');
    expect(dv.formulae[0]).toContain('Areas!');
    // No debe impedir escribir un área nueva (find-or-create).
    expect(dv.errorStyle).toBe('warning');
  });

  it('la cabecera de la columna sigue siendo `area` (alias de importación intactos)', async () => {
    const { controller } = build([{ id: 'a1', empresaId: 'e1', nombre: 'Diseño' }]);
    const wb = await descargar(controller, 'p1');
    expect(wb.getWorksheet('Participantes').getRow(1).getCell(4).value).toBe('area');
  });
});
