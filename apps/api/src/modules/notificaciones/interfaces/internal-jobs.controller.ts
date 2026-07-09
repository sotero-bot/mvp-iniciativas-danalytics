import { Controller, Get, Headers } from '@nestjs/common';

import { PrismaService } from '../../../prisma.service';
import { EmailService } from '../../email/email.service';
import { AppError } from '../../../shared/errors/AppError';

const VENTANA_MS = 60 * 60 * 1000; // el cron corre cada hora (granularidad mínima de Vercel Cron)

/**
 * RF-40/§8: batch "material disponible" — sin infraestructura de cron persistente en
 * el proyecto (serverless), se dispara vía Vercel Cron (GET, convención de Vercel) llamando
 * a este endpoint interno. Vercel firma sus llamadas de cron con
 * `Authorization: Bearer $CRON_SECRET` automáticamente cuando esa env var existe en el
 * proyecto — no hay JWT de usuario para un job de máquina, por eso no usa JwtAuthGuard.
 */
@Controller('internal/jobs')
export class InternalJobsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  @Get('material-disponible')
  async notificarMaterialDisponible(@Headers('authorization') authorization?: string) {
    const expected = process.env.CRON_SECRET;
    if (!expected || authorization !== `Bearer ${expected}`) throw new AppError('FORBIDDEN');

    const now = new Date();
    const ventanaInicio = new Date(now.getTime() - VENTANA_MS);

    const sesiones = await this.prisma.sesion.findMany({
      where: { materialDesbloqueoEn: { gte: ventanaInicio, lte: now } },
      select: {
        id: true,
        numeroSesion: true,
        programaId: true,
        programa: {
          select: {
            nombre: true,
            activo: true,
            participantes: {
              where: { activo: true },
              select: { usuarioId: true, usuario: { select: { nombre: true, email: true } } },
            },
          },
        },
      },
    });

    let notificados = 0;
    for (const sesion of sesiones) {
      if (!sesion.programa.activo) continue;
      for (const participante of sesion.programa.participantes) {
        const yaNotificado = await this.prisma.notificacionEmail.findFirst({
          where: {
            tipo: 'material_disponible',
            usuarioId: participante.usuarioId,
            programaId: sesion.programaId,
            createdAt: { gte: ventanaInicio },
          },
        });
        if (yaNotificado) continue;
        try {
          await this.email.sendMaterialDisponible(
            participante.usuario.email,
            'es',
            {
              nombreUsuario: participante.usuario.nombre,
              programa: sesion.programa.nombre,
              numeroSesion: sesion.numeroSesion,
            },
            { programaId: sesion.programaId, usuarioId: participante.usuarioId },
          );
          notificados++;
        } catch (err) {
          console.error('[material-disponible] fallo al notificar:', err);
        }
      }
    }

    return { sesionesEnVentana: sesiones.length, notificados };
  }
}
