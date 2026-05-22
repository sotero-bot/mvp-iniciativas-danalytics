import { Controller, Get, Post, Body, Param, Query, NotFoundException, BadRequestException, ForbiddenException, HttpCode, HttpStatus, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { extractTextFromFile } from '../../../shared/utils/extractTextFromFile';
import { excelToMarkdown } from '../../../shared/utils/excelToMarkdown';
import { parseTableFromContent } from '../../../shared/utils/parseTableFromContent';
import { AccederInstanciaPorTokenUseCase } from '../application/AccederInstanciaPorTokenUseCase';
import { IniciarInstanciaPorTokenUseCase } from '../application/IniciarInstanciaPorTokenUseCase';
import { RegistrarRespuestaPorTokenUseCase } from '../application/RegistrarRespuestaPorTokenUseCase';
import { FinalizarInstanciaPorTokenUseCase } from '../application/FinalizarInstanciaPorTokenUseCase';
import { AsignarUsuarioPorTokenUseCase } from '../application/AsignarUsuarioPorTokenUseCase';
import { IniciarSesionPorEnlaceUseCase } from '../application/IniciarSesionPorEnlaceUseCase';
import { ConsultarIaPorTokenUseCase } from '../application/ConsultarIaPorTokenUseCase';
import { RunnerResponseDto, IniciarResponseDto, FinalizarResponseDto, RegistrarRespuestaDto } from './dtos';
import { IdentificarResult } from '../application/AsignarUsuarioPorTokenUseCase';
import { ResourceNotFoundError } from '../../../shared/domain/ResourceNotFoundError';
import { BusinessRuleViolationError } from '../../../shared/domain/DomainError';
import { PrismaService } from '../../../prisma.service';

@Controller('execution')
export class ExecutionController {
  constructor(
    private readonly accederUseCase: AccederInstanciaPorTokenUseCase,
    private readonly iniciarUseCase: IniciarInstanciaPorTokenUseCase,
    private readonly registrarUseCase: RegistrarRespuestaPorTokenUseCase,
    private readonly finalizarUseCase: FinalizarInstanciaPorTokenUseCase,
    private readonly identificarUseCase: AsignarUsuarioPorTokenUseCase,
    private readonly sesionPorEnlaceUseCase: IniciarSesionPorEnlaceUseCase,
    private readonly consultarIaUseCase: ConsultarIaPorTokenUseCase,
    private readonly prisma: PrismaService
  ) { }

  /** Resuelve un enlace permanente → crea una nueva InstanciaActividad y devuelve su token */
  @Post('enlace/:token/sesion')
  @HttpCode(HttpStatus.CREATED)
  async sesionDesdeEnlace(@Param('token') token: string): Promise<{ instanceToken: string }> {
    try {
      return await this.sesionPorEnlaceUseCase.execute(token);
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  @Get(':token')
  async getByToken(@Param('token') token: string): Promise<RunnerResponseDto> {
    try {
      const instancia = await this.accederUseCase.execute(token);

      const actividad = await this.prisma.actividad.findUnique({
        where: { id: instancia.actividadId },
        include: {
          pasos: { orderBy: { orden: 'asc' } },
          iniciativa: { include: { empresa: true } }
        }
      });

      if (!actividad) {
        throw new NotFoundException('Actividad no encontrada para esta instancia');
      }

      // Obtener respuestas de la plantilla anterior si corresponde
      const plantillaAnteriorData = await this.obtenerRespuestasPlantillaAnterior(
        instancia.id,
        instancia.emailReferencia,
        instancia.usuarioId,
        actividad.plantillaOrigenId,
        (actividad as any).iniciativa?.empresaId
      );

      const usuarioData = instancia.usuarioId
        ? await this.prisma.usuario.findUnique({ where: { id: instancia.usuarioId } })
            .then(u => u ? { nombre: u.nombre, email: u.email, cargo: u.cargo, area: u.area } : undefined)
        : undefined;

      const interacciones = await this.prisma.interaccion.findMany({
        where: { instanciaId: instancia.id },
        select: { pasoId: true, contenido: true, respuestaUsuario: true, respuestaIa: true, archivoNombre: true, fecha: true },
      }).then(rows => rows.map(i => ({
        pasoId: i.pasoId,
        contenido: i.contenido,
        respuestaUsuario: i.respuestaUsuario ?? undefined,
        respuestaIa: i.respuestaIa ?? undefined,
        archivoNombre: i.archivoNombre ?? undefined,
        fecha: i.fecha.toISOString(),
      })));

      return new RunnerResponseDto({
        estado: instancia.estado,
        nombreActividad: actividad.nombre,
        descripcionActividad: actividad.descripcion || undefined,
        nombreEmpresa: (actividad as any).iniciativa?.empresa?.nombre || undefined,
        logoEmpresa: (actividad as any).iniciativa?.empresa?.logoUrl || undefined,
        usuarioId: instancia.usuarioId,
        pasos: actividad.pasos.map(p => ({
          id: p.id,
          titulo: p.titulo,
          objetivo: p.objetivo || undefined,
          instrucciones: p.instrucciones || undefined,
          usarIa: p.usarIa,
          promptIa: p.promptIa || undefined,
          permitirArchivo: (p as any).permitirArchivo || false,
          soloArchivo: (p as any).soloArchivo || false,
          urlPlantilla: (p as any).urlPlantilla || undefined,
        })),
        fechaInicio: instancia.fechaInicio?.toISOString(),
        fechaFin: instancia.fechaFin?.toISOString(),
        usuario: usuarioData,
        interacciones,
        plantillaAnterior: plantillaAnteriorData ?? undefined,
      });
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  @Get(':token/plantilla-prefilled/:pasoId')
  async plantillaPrefilled(
    @Param('token') token: string,
    @Param('pasoId') pasoId: string,
    @Res() res: Response
  ): Promise<void> {
    const instancia = await this.prisma.instanciaActividad.findUnique({
      where: { accessToken: token },
      include: { interacciones: true },
    });
    if (!instancia) throw new NotFoundException('Instancia no encontrada');

    const pasoActual = await this.prisma.pasoActividad.findUnique({ where: { id: pasoId } });
    if (!pasoActual) throw new NotFoundException('Paso no encontrado');

    // Busca el paso IA anterior más cercano
    const pasoIaAnterior = await this.prisma.pasoActividad.findFirst({
      where: { actividadId: pasoActual.actividadId, usarIa: true, orden: { lt: pasoActual.orden } },
      orderBy: { orden: 'desc' },
    });

    const HEADERS = [
      'Tipo de IA', 'Idea de Proyecto', '¿Qué permite o resuelve?', '¿Qué valor tendría?',
      'Valor potencial', 'Disponibilidad de datos', 'Esfuerzo técnico / complejidad',
      'Alineación estratégica', 'Escalabilidad / replicabilidad', 'Patrocinio / apoyo interno', 'TOTAL',
    ];

    // Mapeo: columna del Excel → columna del AI response
    const COLUMN_MAP: Record<string, string> = {
      'Tipo de IA':                   'Tipo de IA',
      'Idea de Proyecto':             'Oportunidad de IA',
      '¿Qué permite o resuelve?':     'Por qué ese tipo',
      '¿Qué valor tendría?':          'Impacto potencial',
    };

    const DESCRIPTIONS: (string | number)[] = [
      'Ej: IA Tradicional / IA Generativa',
      'Nombre o descripción breve de la iniciativa',
      'Problema o necesidad que aborda',
      'Beneficio esperado para la empresa',
      '1-3', '1-3', '1-3', '1-3', '1-3', '1-3', '',
    ];

    const wsData: (string | number)[][] = [HEADERS, DESCRIPTIONS];

    if (pasoIaAnterior) {
      const interaccion = instancia.interacciones.find(i => i.pasoId === pasoIaAnterior.id);
      const contenido = (interaccion as any)?.respuestaIa || interaccion?.contenido || '';

      if (contenido) {
        const filas = parseTableFromContent(contenido);
        for (const fila of filas) {
          if (Object.values(fila).every(v => !v)) continue;
          wsData.push(HEADERS.map(h => COLUMN_MAP[h] ? (fila[COLUMN_MAP[h]] ?? '') : ''));
        }
      }
    }

    // Si no se parsearon filas de datos, agregar filas vacías de ejemplo
    if (wsData.length === 2) {
      wsData.push(Array(HEADERS.length).fill(''));
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();

    // --- Hoja Priorización ---
    const ws = wb.addWorksheet('Priorización');
    ws.columns = [20, 30, 30, 30, 12, 18, 18, 16, 16, 14, 8].map(w => ({ width: w }));

    wsData.forEach((rowValues, rowIndex) => {
      const row = ws.addRow(rowValues);
      if (rowIndex === 0) {
        row.height = 22;
        for (let c = 1; c <= HEADERS.length; c++) {
          const cell = row.getCell(c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.alignment = { vertical: 'middle', wrapText: true };
        }
      } else if (rowIndex === 1) {
        row.height = 18;
        for (let c = 1; c <= HEADERS.length; c++) {
          const cell = row.getCell(c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
          cell.font = { italic: true, color: { argb: 'FF444444' } };
          cell.alignment = { vertical: 'middle', wrapText: true };
        }
      }
    });

    // --- Hoja Criterios ---
    const wsCriterios = wb.addWorksheet('Criterios');
    wsCriterios.columns = [28, 10, 45].map(w => ({ width: w }));

    const criteriosData: (string | number)[][] = [
      ['Criterio', 'Puntaje', 'Descripción'],
      ['Valor potencial', 1, 'Impacto marginal'],
      ['Valor potencial', 2, 'Mejoras moderadas'],
      ['Valor potencial', 3, 'Beneficios claros, medibles y estratégicos'],
      ['Disponibilidad de datos', 1, 'No hay datos o son de mala calidad'],
      ['Disponibilidad de datos', 2, 'Algunos disponibles pero incompletos'],
      ['Disponibilidad de datos', 3, 'Datos existentes, accesibles y confiables'],
      ['Esfuerzo técnico / complejidad', 1, 'Gran esfuerzo o desarrollo especializado'],
      ['Esfuerzo técnico / complejidad', 2, 'Trabajo medio, con apoyo técnico'],
      ['Esfuerzo técnico / complejidad', 3, 'Fácil o rápido con recursos actuales'],
      ['Alineación estratégica', 1, 'Aporte indirecto o limitado'],
      ['Alineación estratégica', 2, 'Alineada parcialmente'],
      ['Alineación estratégica', 3, 'Altamente alineada con objetivos clave'],
      ['Escalabilidad / replicabilidad', 1, 'Aplicación muy puntual'],
      ['Escalabilidad / replicabilidad', 2, 'Replicable con ajustes menores'],
      ['Escalabilidad / replicabilidad', 3, 'Altamente escalable'],
      ['Patrocinio / apoyo interno', 1, 'Bajo o incierto'],
      ['Patrocinio / apoyo interno', 2, 'Interés parcial o condicional'],
      ['Patrocinio / apoyo interno', 3, 'Alto respaldo de liderazgo'],
    ];
    criteriosData.forEach((rowValues, rowIndex) => {
      const row = wsCriterios.addRow(rowValues);
      if (rowIndex === 0) {
        for (let c = 1; c <= 3; c++) {
          const cell = row.getCell(c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        }
      }
    });

    const buffer: Buffer = await wb.xlsx.writeBuffer();

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-priorizacion.xlsx"',
    });
    res.send(buffer);
  }

  @Post(':token/iniciar')
  @HttpCode(HttpStatus.OK)
  async iniciar(@Param('token') token: string): Promise<IniciarResponseDto> {
    try {
      await this.verificarBloqueoPlantillaAnterior(token);
      const fechaInicio = await this.iniciarUseCase.execute(token);
      return { estado: 'iniciado', fechaInicio: fechaInicio.toISOString() };
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  @Post(':token/responder')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: diskStorage({
        destination: os.tmpdir(),
        filename: (_req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + path.extname(file.originalname));
        }
      }),
      limits: { fileSize: 10 * 1024 * 1024 }
    })
  )
  async responder(
    @Param('token') token: string,
    @Body() body: { pasoId: string; contenido: string; respuestaUsuario?: string; respuestaIa?: string },
    @UploadedFile() file?: Express.Multer.File
  ): Promise<void> {
    try {
      let contenido = body.contenido;
      let archivoNombre: string | undefined;

      if (file) {
        archivoNombre = file.originalname;
        try {
          const ext = path.extname(file.originalname).toLowerCase();
          const isExcel = ['.xlsx', '.xls'].includes(ext);
          const textoArchivo = isExcel
            ? excelToMarkdown(file.path)
            : await extractTextFromFile(file.path, file.mimetype, file.originalname);
          contenido = contenido?.trim() ? `${contenido}\n\n---\n\n${textoArchivo}` : textoArchivo;
        } finally {
          fs.unlink(file.path, () => {});
        }
      }

      await this.registrarUseCase.execute(token, body.pasoId, contenido, body.respuestaUsuario, body.respuestaIa, archivoNombre);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Post(':token/ia')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: diskStorage({
        destination: os.tmpdir(),
        filename: (_req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + path.extname(file.originalname));
        }
      }),
      limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
    })
  )
  async consultarIa(
    @Param('token') token: string,
    @Body() body: { pasoId: string; respuesta: string; customPrompt?: string },
    @UploadedFile() file?: Express.Multer.File
  ): Promise<{ respuestaIa: string }> {
    try {
      const fileInfo = file
        ? { path: file.path, mimetype: file.mimetype, originalname: file.originalname }
        : undefined;
      const gptResponse = await this.consultarIaUseCase.execute(
        token,
        body.pasoId,
        body.respuesta,
        body.customPrompt,
        fileInfo
      );
      return { respuestaIa: gptResponse };
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  @Post(':token/finalizar')
  @HttpCode(HttpStatus.OK)
  async finalizar(@Param('token') token: string): Promise<FinalizarResponseDto> {
    try {
      const fechaFin = await this.finalizarUseCase.execute(token);
      return { estado: 'finalizado', fechaFin: fechaFin.toISOString() };
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  @Get(':token/usuario')
  async buscarUsuario(
    @Param('token') token: string,
    @Query('email') email: string
  ): Promise<{ nombre: string; cargo?: string; area?: string; email: string } | null> {
    if (!email) return null;
    const instancia = await this.prisma.instanciaActividad.findUnique({ where: { accessToken: token } });
    if (!instancia) throw new NotFoundException('Instancia no encontrada');
    const actividad = await this.prisma.actividad.findUnique({
      where: { id: instancia.actividadId },
      include: { iniciativa: true }
    });
    if (!actividad) throw new NotFoundException('Actividad no encontrada');
    const usuario = await this.prisma.usuario.findUnique({
      where: { empresa_email_unico: { empresaId: actividad.iniciativa.empresaId, email: email.toLowerCase().trim() } }
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return { nombre: usuario.nombre, cargo: usuario.cargo ?? undefined, area: usuario.area ?? undefined, email: usuario.email };
  }

  @Post(':token/identificar')
  async identificar(
    @Param('token') token: string,
    @Body() body: { nombre: string; email: string; cargo?: string; area?: string }
  ): Promise<IdentificarResult> {
    try {
      return await this.identificarUseCase.execute(token, body);
    } catch (error) {
      this.handleError(error);
    }
  }

  private async verificarBloqueoPlantillaAnterior(token: string): Promise<void> {
    const instanciaRaw = await this.prisma.instanciaActividad.findUnique({
      where: { accessToken: token },
      include: { actividad: { include: { plantillaOrigen: true, iniciativa: true } } }
    });
    if (!instanciaRaw) return;

    const plantilla = instanciaRaw.actividad.plantillaOrigen;
    if (!plantilla || plantilla.orden === null || plantilla.orden <= 1) return;

    const plantillaAnterior = await this.prisma.plantillaActividad.findFirst({
      where: { orden: plantilla.orden - 1, activo: true }
    });
    if (!plantillaAnterior) return;

    const emailRef = await this.resolverEmailInstancia(instanciaRaw.emailReferencia, instanciaRaw.usuarioId);
    if (!emailRef) return;

    const empresaId = instanciaRaw.actividad.iniciativa.empresaId;
    const instanciaAnteriorFinalizada = await this.prisma.instanciaActividad.findFirst({
      where: {
        estado: 'finalizado',
        actividad: { plantillaOrigenId: plantillaAnterior.id, iniciativa: { empresaId } },
        OR: [{ emailReferencia: emailRef }, { usuario: { email: emailRef } }]
      }
    });

    if (!instanciaAnteriorFinalizada) {
      throw new ForbiddenException(`Debes completar primero la actividad "${plantillaAnterior.nombre}" antes de iniciar esta.`);
    }
  }

  private async obtenerRespuestasPlantillaAnterior(
    instanciaId: string,
    emailReferencia: string | undefined,
    usuarioId: string | undefined,
    plantillaOrigenId: string | null,
    empresaId: string | undefined
  ): Promise<{ nombre: string; respuestas: Array<{ pasoTitulo: string; pasoOrden: number; respuestaUsuario?: string; respuestaIa?: string }> } | null> {
    if (!plantillaOrigenId || !empresaId) return null;

    const plantilla = await this.prisma.plantillaActividad.findUnique({ where: { id: plantillaOrigenId } });
    if (!plantilla || plantilla.orden === null || plantilla.orden <= 1) return null;

    const plantillaAnterior = await this.prisma.plantillaActividad.findFirst({
      where: { orden: plantilla.orden - 1, activo: true }
    });
    if (!plantillaAnterior) return null;

    const emailRef = await this.resolverEmailInstancia(emailReferencia, usuarioId);
    if (!emailRef) return null;

    const instanciaAnterior = await this.prisma.instanciaActividad.findFirst({
      where: {
        estado: 'finalizado',
        actividad: { plantillaOrigenId: plantillaAnterior.id, iniciativa: { empresaId } },
        OR: [{ emailReferencia: emailRef }, { usuario: { email: emailRef } }]
      },
      include: {
        interacciones: {
          include: { paso: { select: { titulo: true, orden: true } } },
          orderBy: { paso: { orden: 'asc' } }
        }
      }
    });

    if (!instanciaAnterior) return null;

    return {
      nombre: plantillaAnterior.nombre,
      respuestas: instanciaAnterior.interacciones.map(i => ({
        pasoTitulo: i.paso.titulo,
        pasoOrden: i.paso.orden,
        contenido: i.contenido ?? undefined,
        respuestaUsuario: i.respuestaUsuario ?? undefined,
        respuestaIa: i.respuestaIa ?? undefined,
      }))
    };
  }

  private async resolverEmailInstancia(emailReferencia: string | undefined, usuarioId: string | undefined): Promise<string | undefined> {
    if (emailReferencia) return emailReferencia;
    if (usuarioId) {
      const u = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
      return u?.email;
    }
    return undefined;
  }

  private handleError(error: unknown): void {
    if (error instanceof ResourceNotFoundError) {
      throw new NotFoundException(error.message);
    }
    if (error instanceof BusinessRuleViolationError) {
      throw new BadRequestException(error.message);
    }
    throw error;
  }
}
