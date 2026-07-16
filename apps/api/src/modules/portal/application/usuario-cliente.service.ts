import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../prisma.service';
import { AppError } from '../../../shared/errors/AppError';
import { MagicLinkService } from '../../auth/application/magic-link.service';

const USUARIO_CLIENTE_SLUG = 'usuario_cliente';
const CLIENTE_SLUGS = new Set(['cliente_admin', 'usuario_cliente']);
const CLIENTE_ADMIN_INDEX = 'usuario_cliente_admin_unico_por_empresa';

export interface InvitarUsuarioClienteInput {
  empresaId: string;
  invitadoPorId: string;
  nombre: string;
  email: string;
  locale?: 'es' | 'pt';
  ip?: string;
}

const MIEMBRO_SELECT = {
  id: true,
  activo: true,
  invitadoEn: true,
  invitadoPor: { select: { id: true, nombre: true } },
  usuario: {
    select: {
      id: true,
      nombre: true,
      email: true,
      activo: true,
      puedeIniciarSesion: true,
      role: { select: { slug: true, nombre: true } },
    },
  },
} as const;

/**
 * RF-44/RF-45 (Plan 2 §4.1) — gestión de `usuario_cliente` por el `cliente_admin`
 * y sincronización de la tabla puente `UsuarioCliente` desde el módulo admin
 * (Plan 1 §9 / Plan 2 §4.2). La revocación NUNCA borra la fila: `activo=false`
 * conserva quién invitó y cuándo (auditoría RF-44).
 */
@Injectable()
export class UsuarioClienteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly magicLink: MagicLinkService,
  ) {}

  /** ¿La violación P2002 viene del índice parcial de un solo `cliente_admin` activo por empresa? */
  static esViolacionClienteAdminUnico(e: unknown): boolean {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') return false;
    const target = e.meta?.target;
    const targetStr = Array.isArray(target) ? target.join(',') : String(target ?? '');
    return targetStr.includes(CLIENTE_ADMIN_INDEX) || e.message.includes(CLIENTE_ADMIN_INDEX);
  }

  /** Miembros del portal de una empresa (glue para la UI de gestión, RF-44). */
  async listar(empresaId: string) {
    return this.prisma.usuarioCliente.findMany({
      where: { empresaId },
      select: MIEMBRO_SELECT,
      orderBy: [{ activo: 'desc' }, { invitadoEn: 'desc' }],
    });
  }

  /**
   * RF-44/RF-45: el `cliente_admin` invita un `usuario_cliente` de SU empresa.
   * Regla dura §0.1: esta vía solo crea usuarios con rol `usuario_cliente`
   * (jamás estudiantes/facilitadores/otros cliente_admin) y siempre dentro de
   * la empresa del actor. Si el email ya existe en la empresa, se reutiliza el
   * Usuario persistido (nunca se emite magic link a usuarios no registrados).
   */
  async invitar(input: InvitarUsuarioClienteInput) {
    const email = input.email?.toLowerCase().trim();
    if (!input.nombre?.trim() || !email) {
      throw new AppError('VALIDATION_ERROR', { message: 'nombre y email son requeridos' });
    }

    const role = await this.prisma.role.findUnique({ where: { slug: USUARIO_CLIENTE_SLUG } });
    if (!role) throw new AppError('VALIDATION_ERROR', { message: `Role inválido: ${USUARIO_CLIENTE_SLUG}` });

    let usuario = await this.prisma.usuario.findFirst({
      where: { email, empresaId: input.empresaId },
      include: { role: true },
    });

    if (usuario) {
      // Un usuario existente con otro rol (estudiante, cliente_admin, …) no se
      // "secuestra" hacia usuario_cliente: eso lo decide danalytics_admin.
      if (usuario.role && usuario.role.slug !== USUARIO_CLIENTE_SLUG) {
        throw new AppError('VALIDATION_ERROR', {
          message: 'Ese email pertenece a un usuario con otro rol; contacta a Danalytics.',
        });
      }
      const miembroActivo = await this.prisma.usuarioCliente.findFirst({
        where: { empresaId: input.empresaId, usuarioId: usuario.id, activo: true },
      });
      if (miembroActivo) throw new AppError('USUARIO_CLIENTE_DUPLICADO');
    } else {
      try {
        usuario = await this.prisma.usuario.create({
          data: {
            id: randomUUID(),
            nombre: input.nombre.trim(),
            email,
            username: email,
            roleId: role.id,
            empresaId: input.empresaId,
            puedeIniciarSesion: true,
          },
          include: { role: true },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new AppError('USUARIO_DUPLICATE');
        }
        throw e;
      }
    }

    // Reinvitar a un revocado reactiva la misma fila (unique [empresaId, usuarioId]).
    const miembro = await this.prisma.usuarioCliente.upsert({
      where: { empresaId_usuarioId: { empresaId: input.empresaId, usuarioId: usuario.id } },
      create: {
        empresaId: input.empresaId,
        usuarioId: usuario.id,
        invitadoPorId: input.invitadoPorId,
        activo: true,
      },
      update: { activo: true, invitadoPorId: input.invitadoPorId, invitadoEn: new Date() },
      select: MIEMBRO_SELECT,
    });

    // Reactivar el login si venía de una revocación.
    if (!usuario.activo || !usuario.puedeIniciarSesion) {
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { activo: true, puedeIniciarSesion: true },
      });
    }

    // RF-45: invitación por magic link (u OAuth según dominio al entrar) —
    // best-effort, igual que la matrícula de admin: si el email falla, la
    // membresía ya quedó creada y el admin puede reenviar la invitación.
    let invitacionEnviada = true;
    try {
      await this.magicLink.createAndSend({
        usuarioId: usuario.id,
        locale: input.locale ?? 'es',
        ipCreacion: input.ip,
      });
    } catch {
      invitacionEnviada = false;
    }

    return { ...miembro, invitacionEnviada };
  }

  /**
   * RF-44: revocar acceso. Soft: `UsuarioCliente.activo=false` + apaga el login
   * del usuario (`activo=false, puedeIniciarSesion=false`) para que magic
   * link/OAuth dejen de funcionar. `empresaId` acota a la empresa del actor
   * (RN-09): no se puede revocar a nadie de otra empresa.
   */
  async revocar(usuarioClienteId: string, empresaId: string) {
    const miembro = await this.prisma.usuarioCliente.findFirst({
      where: { id: usuarioClienteId, empresaId },
      include: { usuario: { include: { role: true } } },
    });
    if (!miembro) throw new AppError('USUARIO_CLIENTE_NOT_FOUND');
    // El cliente_admin solo gestiona `usuario_cliente` (matriz de roles §0.1);
    // revocar a un cliente_admin es operación de danalytics_admin.
    if (miembro.usuario.role?.slug !== USUARIO_CLIENTE_SLUG) {
      throw new AppError('FORBIDDEN');
    }

    await this.prisma.usuarioCliente.update({
      where: { id: miembro.id },
      data: { activo: false },
    });
    await this.prisma.usuario.update({
      where: { id: miembro.usuarioId },
      data: { activo: false, puedeIniciarSesion: false },
    });
  }

  // ---- C-07: asignación de programas de IA en Acción a un usuario_cliente ----
  // El usuario_cliente ve SOLO los programas asignados. Asignan tanto el
  // cliente_admin (acotado a su empresa, `empresaGuard`) como danalytics_admin
  // (sin guard de empresa propio, pero el programa y el usuario deben ser de la
  // misma empresa). Solo cubre `Programa` (IA en Acción), no Decisión IA (O-02).

  /** Programas IA en Acción de la empresa + cuáles están asignados al usuario_cliente. */
  async programasAsignables(usuarioId: string, empresaGuard?: string) {
    const usuario = await this.assertUsuarioCliente(usuarioId, empresaGuard);
    const empresaId = usuario.empresaId as string;
    const [programas, asignados] = await Promise.all([
      this.prisma.programa.findMany({
        where: { empresaId, activo: true },
        select: { id: true, nombre: true, estado: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.usuarioClientePrograma.findMany({
        where: { usuarioId },
        select: { programaId: true },
      }),
    ]);
    return { programas, asignados: asignados.map((a) => a.programaId) };
  }

  async asignarPrograma(input: {
    usuarioId: string;
    programaId: string;
    asignadoPorId: string;
    empresaGuard?: string;
  }) {
    const usuario = await this.assertUsuarioCliente(input.usuarioId, input.empresaGuard);
    const programa = await this.prisma.programa.findUnique({ where: { id: input.programaId } });
    // RN-09: el programa debe ser de la misma empresa del usuario_cliente.
    if (!programa || programa.empresaId !== usuario.empresaId) {
      throw new AppError('PROGRAMA_NOT_FOUND');
    }
    try {
      await this.prisma.usuarioClientePrograma.create({
        data: { usuarioId: input.usuarioId, programaId: input.programaId, asignadoPorId: input.asignadoPorId },
      });
    } catch (e) {
      // Idempotente: reasignar lo ya asignado no es error.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
    }
    return this.programasAsignables(input.usuarioId, input.empresaGuard);
  }

  async desasignarPrograma(input: { usuarioId: string; programaId: string; empresaGuard?: string }) {
    await this.assertUsuarioCliente(input.usuarioId, input.empresaGuard);
    await this.prisma.usuarioClientePrograma.deleteMany({
      where: { usuarioId: input.usuarioId, programaId: input.programaId },
    });
  }

  /** El objetivo debe existir, ser `usuario_cliente` y (si hay guard) de esa empresa. */
  private async assertUsuarioCliente(usuarioId: string, empresaGuard?: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: { role: true },
    });
    if (!usuario || usuario.role?.slug !== USUARIO_CLIENTE_SLUG) {
      throw new AppError('USUARIO_CLIENTE_NOT_FOUND');
    }
    if (empresaGuard && usuario.empresaId !== empresaGuard) {
      throw new AppError('USUARIO_CLIENTE_NOT_FOUND');
    }
    if (!usuario.empresaId) throw new AppError('USUARIO_CLIENTE_NOT_FOUND');
    return usuario;
  }

  /**
   * Plan 2 §4.2 / Plan 1 §9: mantiene la tabla puente sincronizada cuando
   * danalytics_admin crea/edita usuarios. Si el usuario tiene rol cliente y
   * empresa → fila activa en esa empresa (y desactiva las de otras empresas);
   * si dejó de ser rol cliente o quedó inactivo → desactiva sus filas.
   */
  async sincronizarDesdeAdmin(
    usuario: { id: string; empresaId: string | null; activo: boolean; role: { slug: string } | null },
    invitadoPorId: string | null,
  ): Promise<void> {
    const esCliente = !!usuario.role && CLIENTE_SLUGS.has(usuario.role.slug);

    if (esCliente && usuario.empresaId && usuario.activo) {
      await this.prisma.usuarioCliente.updateMany({
        where: { usuarioId: usuario.id, empresaId: { not: usuario.empresaId }, activo: true },
        data: { activo: false },
      });
      await this.prisma.usuarioCliente.upsert({
        where: { empresaId_usuarioId: { empresaId: usuario.empresaId, usuarioId: usuario.id } },
        create: { empresaId: usuario.empresaId, usuarioId: usuario.id, invitadoPorId, activo: true },
        update: { activo: true },
      });
    } else {
      await this.prisma.usuarioCliente.updateMany({
        where: { usuarioId: usuario.id, activo: true },
        data: { activo: false },
      });
    }
  }
}
