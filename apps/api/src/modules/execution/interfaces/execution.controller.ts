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
import { S3Service } from '../../storage/S3Service';

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
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
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
          pasos: {
            orderBy: { orden: 'asc' },
            include: { preguntas: { where: { activo: true }, orderBy: { orden: 'asc' } } },
          },
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
        select: { pasoId: true, contenido: true, respuestaUsuario: true, respuestaIa: true, archivoNombre: true, contenidoArchivo: true, fecha: true },
      }).then(rows => rows.map(i => ({
        pasoId: i.pasoId,
        contenido: i.contenido,
        respuestaUsuario: i.respuestaUsuario ?? undefined,
        respuestaIa: i.respuestaIa ?? undefined,
        archivoNombre: i.archivoNombre ?? undefined,
        contenidoArchivo: i.contenidoArchivo ?? undefined,
        fecha: i.fecha.toISOString(),
      })));

      const respuestas = await this.prisma.respuesta.findMany({
        where: { instanciaId: instancia.id },
        select: { preguntaId: true, contenido: true, respuestaUsuario: true, respuestaIa: true, archivoNombre: true, contenidoArchivo: true, archivoKey: true, fecha: true },
      }).then(rows => rows.map(r => ({
        preguntaId: r.preguntaId,
        contenido: r.contenido ?? undefined,
        respuestaUsuario: r.respuestaUsuario ?? undefined,
        respuestaIa: r.respuestaIa ?? undefined,
        archivoNombre: r.archivoNombre ?? undefined,
        contenidoArchivo: r.contenidoArchivo ?? undefined,
        archivoKey: r.archivoKey ?? undefined,
        fecha: r.fecha.toISOString(),
      })));

      return new RunnerResponseDto({
        estado: instancia.estado,
        nombreActividad: actividad.nombre,
        descripcionActividad: actividad.descripcion || undefined,
        nombreEmpresa: (actividad as any).iniciativa?.empresa?.nombre || undefined,
        sectorEmpresa: (actividad as any).iniciativa?.empresa?.sector || undefined,
        tipoOrganizacionEmpresa: (actividad as any).iniciativa?.empresa?.tipoOrganizacion || undefined,
        logoEmpresa: (actividad as any).iniciativa?.empresa?.logoUrl || undefined,
        usuarioId: instancia.usuarioId,
        pasos: actividad.pasos.map(p => ({
          id: p.id,
          titulo: p.titulo,
          objetivo: p.objetivo || undefined,
          instrucciones: p.instrucciones || undefined,
          usarIa: p.usarIa,
          iaAutomatica: p.iaAutomatica || false,
          promptIa: p.promptIa || undefined,
          permitirArchivo: p.permitirArchivo || false,
          soloArchivo: p.soloArchivo || false,
          urlPlantilla: p.urlPlantilla || undefined,
          ejemploKey: (p as any).ejemploKey || undefined,
          preguntas: (p as any).preguntas?.map((q: any) => ({
            id: q.id,
            orden: q.orden,
            enunciado: q.enunciado,
            permitirArchivo: q.permitirArchivo,
            soloArchivo: q.soloArchivo,
            usarIa: q.usarIa,
            iaAutomatica: q.iaAutomatica,
            promptIa: q.promptIa || undefined,
            urlPlantilla: q.urlPlantilla || undefined,
            urlPromptTemplate: q.urlPromptTemplate || undefined,
          })) ?? [],
        })),
        fechaInicio: instancia.fechaInicio?.toISOString(),
        fechaFin: instancia.fechaFin?.toISOString(),
        usuario: usuarioData,
        interacciones,
        respuestas,
        plantillaAnterior: plantillaAnteriorData ?? undefined,
      });
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  @Post(':token/plantilla-prefilled/:pasoId')
  @HttpCode(HttpStatus.OK)
  async plantillaPrefilled(
    @Param('token') token: string,
    @Param('pasoId') pasoId: string,
    @Body() body: { respuestaIa?: string },
    @Res() res: Response
  ): Promise<void> {
    const instancia = await this.prisma.instanciaActividad.findUnique({
      where: { accessToken: token },
      include: { interacciones: true },
    });
    if (!instancia) throw new NotFoundException('Instancia no encontrada');

    const pasoActual = await this.prisma.pasoActividad.findUnique({ where: { id: pasoId } });
    if (!pasoActual) throw new NotFoundException('Paso no encontrado');

    // Si el paso actual ya tiene IA, usa su propia interacción; si no, busca el anterior más cercano
    const pasoIaSource = pasoActual.usarIa
      ? pasoActual
      : await this.prisma.pasoActividad.findFirst({
          where: { actividadId: pasoActual.actividadId, usarIa: true, orden: { lt: pasoActual.orden } },
          orderBy: { orden: 'desc' },
        });

    const HEADERS = [
      'Área',
      'Dolor identificado',
      'Proceso relacionado',
      'Tipo de problema',
      'Oportunidad de mejora',
      'Tipo de solución sugerida',
      '¿Requiere IA?',
      '¿IA generativa aplica?',
      'Justificación de la solución sugerida',
      'Alternativa más simple a evaluar',
      'Qué debe estar ordenado antes de implementar',
      'Qué aportaría la IA si esas condiciones existen',
      'Datos, documentos o insumos necesarios',
      'Orientación sobre esfuerzo técnico',
      'Hipótesis de impacto esperado',
    ];

    // Mapeo 1:1 — el prompt genera las columnas con los mismos nombres que los headers
    const COLUMN_MAP: Record<string, string> = {
      'Área':                                            'Área',
      'Dolor identificado':                              'Dolor identificado',
      'Proceso relacionado':                             'Proceso relacionado',
      'Tipo de problema':                                'Tipo de problema',
      'Oportunidad de mejora':                           'Oportunidad de mejora',
      'Tipo de solución sugerida':                       'Tipo de solución sugerida',
      '¿Requiere IA?':                                   '¿Requiere IA?',
      '¿IA generativa aplica?':                          '¿IA generativa aplica?',
      'Justificación de la solución sugerida':           'Justificación de la solución sugerida',
      'Alternativa más simple a evaluar':                'Alternativa más simple a evaluar',
      'Qué debe estar ordenado antes de implementar':    'Qué debe estar ordenado antes de implementar',
      'Qué aportaría la IA si esas condiciones existen': 'Qué aportaría la IA si esas condiciones existen',
      'Datos, documentos o insumos necesarios':          'Datos, documentos o insumos necesarios',
      'Orientación sobre esfuerzo técnico':              'Orientación sobre esfuerzo técnico',
      'Hipótesis de impacto esperado':                   'Hipótesis de impacto esperado',
    };

    // Prioridad 1: parámetro enviado en el body (sesión actual, IA recién ejecutada)
    // Prioridad 2: interacción ya guardada en BD (sesión anterior)
    let contenidoIa = body?.respuestaIa?.trim() ?? '';

    if (!contenidoIa && pasoIaSource) {
      const interaccion = instancia.interacciones.find(i => i.pasoId === pasoIaSource.id);
      contenidoIa = (interaccion as any)?.respuestaIa || interaccion?.contenido || '';
    }

    if (!contenidoIa) {
      res.status(422).json({ message: 'El asistente IA aún no ha generado una respuesta para este paso.' });
      return;
    }

    // Cargar plantilla base — conserva hoja 2 "Criterios", estilos, columnas 16-27, etc.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const templatePath = path.resolve(process.cwd(), 'apps/web/public/templates/plantilla-priorizacion-mapa-oportunidades.xlsx');
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Plantilla base no encontrada en ${templatePath}`);
    }
    await wb.xlsx.readFile(templatePath);

    const ws = wb.worksheets[0]; // Primera hoja: "Priorización"
    if (!ws) {
      throw new Error('La plantilla base no tiene hojas');
    }

    // Filas 1 y 2 son cabeceras/descripciones de la plantilla → empezamos a escribir en fila 3.
    // Solo escribimos columnas 1..15 (las que llena la IA); 16..27 quedan intactas para el equipo.
    const filas = parseTableFromContent(contenidoIa);
    const filasNoVacias = filas.filter(fila => !Object.values(fila).every(v => !v));

    filasNoVacias.forEach((fila, i) => {
      const row = ws.getRow(3 + i);
      HEADERS.forEach((h, c) => {
        const valor = COLUMN_MAP[h] ? (fila[COLUMN_MAP[h]] ?? '') : '';
        const cell = row.getCell(c + 1);
        cell.value = valor;
        cell.alignment = { vertical: 'top', wrapText: true };
      });
      row.height = 60;
      row.commit();
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
    @Body() body: { pasoId: string; preguntaId?: string; contenido: string; respuestaUsuario?: string; respuestaIa?: string },
    @UploadedFile() file?: Express.Multer.File
  ): Promise<void> {
    try {
      let contenido = body.contenido;
      let archivoNombre: string | undefined;
      let contenidoArchivo: string | undefined;
      let archivoKey: string | undefined;

      if (file) {
        archivoNombre = file.originalname;
        try {
          const ext = path.extname(file.originalname).toLowerCase();
          const isExcel = ['.xlsx', '.xls'].includes(ext);
          const textoArchivo = isExcel
            ? excelToMarkdown(file.path)
            : await extractTextFromFile(file.path, file.mimetype, file.originalname);
          contenidoArchivo = textoArchivo;
          contenido = contenido?.trim() ? `${contenido}\n\n---\n\n${textoArchivo}` : textoArchivo;

          // Solo subir a S3 si la pregunta lo tiene marcado (típicamente la pregunta final/entregable).
          // Para preguntas intermedias, contenidoArchivo en BD ya es suficiente.
          let subirAS3 = false;
          let actividadCtx: any = null;
          if (body.preguntaId) {
            const pregunta = await this.prisma.preguntaActividad.findUnique({
              where: { id: body.preguntaId },
              select: {
                subirArchivoS3: true,
                paso: {
                  select: {
                    actividad: {
                      select: {
                        nombre: true,
                        plantillaOrigen: { select: { nombre: true } },
                        iniciativa: { select: { empresa: { select: { nombre: true } } } },
                      },
                    },
                  },
                },
              },
            });
            subirAS3 = !!pregunta?.subirArchivoS3;
            actividadCtx = pregunta?.paso?.actividad;
          }

          if (this.s3.isConfigured && subirAS3 && actividadCtx) {
            // Path S3: <empresa>/<plantilla|actividad>/respuesta/<archivo>
            const empresa = S3Service.slugifyPathSegment(actividadCtx?.iniciativa?.empresa?.nombre || '') || 'empresa';
            const plantillaOActividad = S3Service.slugifyPathSegment(
              actividadCtx?.plantillaOrigen?.nombre || actividadCtx?.nombre || ''
            ) || 'actividad';
            const prefix = `${empresa}/${plantillaOActividad}/respuesta`;
            const key = this.s3.generateKey(prefix, file.originalname);
            await this.s3.uploadFile(key, file.path, file.mimetype);
            archivoKey = key;
          }
        } finally {
          fs.unlink(file.path, () => {});
        }
      }

      await this.registrarUseCase.execute(token, body.pasoId, contenido, body.respuestaUsuario, body.respuestaIa, archivoNombre, contenidoArchivo, body.preguntaId, archivoKey);
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
  // TODO(IA-por-pregunta): revisar al implementar — añadir preguntaId al body y pasarlo a ConsultarIaPorTokenUseCase.
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
        contenidoArchivo: i.contenidoArchivo ?? undefined,
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

  /** Presigned PUT URL para que el admin suba archivo de ejemplo de un paso directamente a S3 */
  @Post(':token/presign-ejemplo')
  @HttpCode(HttpStatus.OK)
  async presignEjemplo(
    @Body() body: { filename: string; contentType: string }
  ): Promise<{ uploadUrl: string; key: string }> {
    if (!this.s3.isConfigured) throw new BadRequestException('S3 no configurado');
    const key = this.s3.generateKey('ejemplos', body.filename);
    const uploadUrl = await this.s3.getPresignedPutUrl(key, body.contentType);
    return { uploadUrl, key };
  }

  /** Presigned GET URL para descargar el archivo de ejemplo de un paso */
  @Get(':token/pasos/:pasoId/ejemplo-url')
  async pasoEjemploUrl(
    @Param('token') token: string,
    @Param('pasoId') pasoId: string,
  ): Promise<{ url: string }> {
    if (!this.s3.isConfigured) throw new BadRequestException('S3 no configurado');
    const instancia = await this.prisma.instanciaActividad.findUnique({ where: { accessToken: token } });
    if (!instancia) throw new NotFoundException('Instancia no encontrada');
    const paso = await this.prisma.pasoActividad.findUnique({ where: { id: pasoId } });
    if (!paso?.ejemploKey) throw new NotFoundException('Archivo de ejemplo no encontrado');
    const url = await this.s3.getPresignedGetUrl(paso.ejemploKey);
    return { url };
  }

  /** Presigned GET URL para descargar el archivo de respuesta de una pregunta */
  @Get(':token/respuestas/:preguntaId/archivo-url')
  async archivoUrl(
    @Param('token') token: string,
    @Param('preguntaId') preguntaId: string
  ): Promise<{ url: string }> {
    if (!this.s3.isConfigured) throw new BadRequestException('S3 no configurado');
    const instancia = await this.prisma.instanciaActividad.findUnique({ where: { accessToken: token } });
    if (!instancia) throw new NotFoundException('Instancia no encontrada');
    const respuesta = await this.prisma.respuesta.findUnique({
      where: { instanciaId_preguntaId: { instanciaId: instancia.id, preguntaId } },
    });
    if (!respuesta?.archivoKey) throw new NotFoundException('Archivo no encontrado');
    const url = await this.s3.getPresignedGetUrl(respuesta.archivoKey);
    return { url };
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
