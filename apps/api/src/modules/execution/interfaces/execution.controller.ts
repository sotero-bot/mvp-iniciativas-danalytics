import { Controller, Get, Post, Body, Param, NotFoundException, BadRequestException, HttpCode, HttpStatus, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as os from 'os';
import { AccederInstanciaPorTokenUseCase } from '../application/AccederInstanciaPorTokenUseCase';
import { IniciarInstanciaPorTokenUseCase } from '../application/IniciarInstanciaPorTokenUseCase';
import { RegistrarRespuestaPorTokenUseCase } from '../application/RegistrarRespuestaPorTokenUseCase';
import { FinalizarInstanciaPorTokenUseCase } from '../application/FinalizarInstanciaPorTokenUseCase';
import { AsignarUsuarioPorTokenUseCase } from '../application/AsignarUsuarioPorTokenUseCase';
import { IniciarSesionPorEnlaceUseCase } from '../application/IniciarSesionPorEnlaceUseCase';
import { ConsultarIaPorTokenUseCase } from '../application/ConsultarIaPorTokenUseCase';
import { RunnerResponseDto, IniciarResponseDto, FinalizarResponseDto, RegistrarRespuestaDto } from './dtos';
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

      // Enriquecer con datos de la actividad
      const actividad = await this.prisma.actividad.findUnique({
        where: { id: instancia.actividadId },
        include: { pasos: { orderBy: { orden: 'asc' } } }
      });

      if (!actividad) {
        throw new NotFoundException('Actividad no encontrada para esta instancia');
      }

      return new RunnerResponseDto({
        estado: instancia.estado,
        nombreActividad: actividad.nombre,
        descripcionActividad: actividad.descripcion || undefined,
        usuarioId: instancia.usuarioId,
        pasos: actividad.pasos.map(p => ({
          id: p.id,
          titulo: p.titulo,
          objetivo: p.objetivo || undefined,
          instrucciones: p.instrucciones || undefined,
          usarIa: p.usarIa,
          promptIa: p.promptIa || undefined
        })),
        fechaInicio: instancia.fechaInicio?.toISOString(),
        fechaFin: instancia.fechaFin?.toISOString(),
        interacciones: instancia.interacciones.map(i => ({
          pasoId: i.pasoId,
          contenido: i.contenido,
          fecha: i.fecha.toISOString()
        }))
      });
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  @Post(':token/iniciar')
  @HttpCode(HttpStatus.OK)
  async iniciar(@Param('token') token: string): Promise<IniciarResponseDto> {
    try {
      const fechaInicio = await this.iniciarUseCase.execute(token);
      return { estado: 'iniciado', fechaInicio: fechaInicio.toISOString() };
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  @Post(':token/responder')
  @HttpCode(HttpStatus.NO_CONTENT)
  async responder(
    @Param('token') token: string,
    @Body() dto: RegistrarRespuestaDto
  ): Promise<void> {
    try {
      await this.registrarUseCase.execute(token, dto.pasoId, dto.contenido);
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

  @Post(':token/identificar')
  async identificar(
    @Param('token') token: string,
    @Body() body: { nombre: string; email?: string; cargo?: string }
  ): Promise<void> {
    try {
      await this.identificarUseCase.execute(token, body);
    } catch (error) {
      this.handleError(error);
    }
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
