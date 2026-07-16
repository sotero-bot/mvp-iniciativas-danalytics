import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { concatMap } from 'rxjs/operators';

import { PrismaService } from '../../prisma.service';
import type { AuthUser } from '../auth/guards';

const VERBO_POR_METODO: Record<string, string> = {
  GET: 'ver',
  POST: 'crear',
  PUT: 'guardar',
  PATCH: 'editar',
  DELETE: 'eliminar',
};

// Segmento de ruta → tipoRecurso canónico (ver comentario del modelo
// RegistroAcceso en schema.prisma). Segmentos no mapeados usan su propio
// nombre normalizado (guiones → guiones bajos): la lista crece sin migración.
const TIPO_POR_SEGMENTO: Record<string, string> = {
  programas: 'programa',
  sesiones: 'sesion',
  usuarios: 'usuario',
  'usuarios-cliente': 'usuario_cliente',
  grupos: 'grupo',
  asistencia: 'asistencia',
  observaciones: 'observacion',
  formularios: 'respuesta_formulario',
  'plantillas-formulario': 'plantilla_formulario',
  bitacora: 'respuesta_formulario',
  'plantilla-proyecto': 'respuesta_formulario',
  'presentacion-final': 'presentacion_final',
  'registro-acceso': 'registro_acceso',
  bitacoras: 'respuesta_formulario',
  plantillas: 'respuesta_formulario',
  diagnostico: 'respuesta_formulario',
  feedback: 'respuesta_formulario',
  resultados: 'respuesta_formulario',
  material: 'sesion',
  notificaciones: 'notificacion',
};

// Acciones con nombre propio del requerimiento (RF-44/45), por método + ruta.
const ACCION_OVERRIDES: Array<{ metodo: string; incluye: string; accion: string }> = [
  { metodo: 'POST', incluye: '/portal/usuarios-cliente', accion: 'invitar_usuario_cliente' },
  { metodo: 'DELETE', incluye: '/portal/usuarios-cliente', accion: 'revocar_usuario_cliente' },
  { metodo: 'POST', incluye: '/enviar-invitacion', accion: 'reenviar_invitacion' },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * RNF-13 (Plan 2 §4.1): bitácora de auditoría APPEND-ONLY como interceptor
 * global. Registra cada acción de `facilitador`, `estudiante` y roles cliente
 * (todas), y las MUTACIONES de `danalytics_admin` (create/update/delete/… del
 * módulo de usuarios y demás — Plan 1 §9; sus GET no, para no llenar el log de
 * ruido de navegación). Corre DESPUÉS de los guards (req.user ya existe; las
 * rutas públicas no se registran) y solo tras respuesta exitosa. La escritura
 * se espera antes de responder (en serverless un fire-and-forget se pierde),
 * pero un fallo del log NUNCA rompe la respuesta.
 */
@Injectable()
export class RegistroAccesoInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = req.user;
    if (!user?.sub || !user.role) return next.handle();
    if (user.role === 'danalytics_admin' && req.method === 'GET') return next.handle();

    return next.handle().pipe(
      concatMap(async data => {
        try {
          await this.prisma.registroAcceso.create({ data: this.buildRegistro(req, user) });
        } catch (e) {
          console.error('[RegistroAcceso] no se pudo registrar la acción:', e);
        }
        return data;
      }),
    );
  }

  private buildRegistro(req: Request & { user?: AuthUser }, user: AuthUser) {
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
    const segmentos = path.split('/').filter(s => s && s !== 'api');

    // Último segmento "con nombre" (no-id) identifica el recurso; el id que le
    // sigue (o el param :id de la ruta) es el recursoId.
    let tipoSegmento: string | null = null;
    let recursoId: string | null = null;
    for (let i = segmentos.length - 1; i >= 0; i--) {
      if (UUID_RE.test(segmentos[i])) {
        recursoId = recursoId ?? segmentos[i];
        continue;
      }
      if (!['admin', 'portal', 'facilitador', 'estudiante', 'cliente', 'draft', 'submit', 'resumen', 'export', 'agregado', 'mios'].includes(segmentos[i])) {
        tipoSegmento = segmentos[i];
        break;
      }
    }
    const params = (req.params ?? {}) as Record<string, string>;
    recursoId = params.id ?? recursoId ?? Object.values(params)[0] ?? null;

    const tipoRecurso = tipoSegmento
      ? (TIPO_POR_SEGMENTO[tipoSegmento] ?? tipoSegmento.replace(/-/g, '_'))
      : 'desconocido';

    const override = ACCION_OVERRIDES.find(
      o => o.metodo === req.method && path.includes(o.incluye),
    );
    const accion = override?.accion ?? `${VERBO_POR_METODO[req.method] ?? req.method.toLowerCase()}_${tipoRecurso}`;

    return {
      usuarioId: user.sub,
      role: user.role as string,
      accion,
      tipoRecurso,
      recursoId,
      ipAddress: req.ip ?? null,
      userAgent: (req.headers?.['user-agent'] as string | undefined) ?? null,
    };
  }
}
