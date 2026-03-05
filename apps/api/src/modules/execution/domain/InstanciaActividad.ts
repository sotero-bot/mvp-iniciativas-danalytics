import { BusinessRuleViolationError } from '../../../shared/domain/DomainError';
import { randomUUID } from 'crypto';

export enum InstanciaEstado {
  GENERADO = 'generado',
  INICIADO = 'iniciado',
  FINALIZADO = 'finalizado',
  CANCELADO = 'cancelado',
}

export interface InteraccionProps {
  pasoId: string;
  contenido: string;
  fecha: Date;
}

export class Interaccion {
  constructor(
    public readonly pasoId: string,
    private _contenido: string,
    public readonly fecha: Date
  ) {}

  get contenido(): string {
    return this._contenido;
  }

  public actualizarContenido(nuevoContenido: string): void {
    if (!nuevoContenido || nuevoContenido.trim().length === 0) {
      throw new BusinessRuleViolationError('El contenido de la respuesta no puede estar vacío.');
    }
    this._contenido = nuevoContenido;
  }
}

export class InstanciaActividad {
  private _estado: InstanciaEstado;
  private _accessToken: string;
  private _interacciones: Interaccion[];
  private _fechaInicio?: Date;
  private _fechaFin?: Date;

  private constructor(
    public readonly id: string,
    public readonly actividadId: string,
    private _usuarioId: string | undefined, // Cambiado a mutable y opcional
    accessToken: string,
    estado: InstanciaEstado = InstanciaEstado.GENERADO,
    fechaInicio?: Date,
    fechaFin?: Date,
    interacciones: Interaccion[] = [],
    private _emailReferencia?: string
  ) {
    this._accessToken = accessToken;
    this._estado = estado;
    this._fechaInicio = fechaInicio;
    this._fechaFin = fechaFin;
    this._interacciones = interacciones;
  }

  // --- Factory Method ---
  public static crear(id: string, actividadId: string, usuarioId?: string, emailReferencia?: string): InstanciaActividad {
    if (!id || !actividadId) {
      throw new BusinessRuleViolationError('ID y ActividadID son obligatorios para crear una instancia.');
    }
    const accessToken = randomUUID();
    return new InstanciaActividad(id, actividadId, usuarioId, accessToken, InstanciaEstado.GENERADO, undefined, undefined, [], emailReferencia);
  }

  // --- Reconstitución (para repositorios) ---
  public static reconstituir(
    id: string,
    actividadId: string,
    usuarioId: string | undefined,
    accessToken: string,
    estado: InstanciaEstado,
    fechaInicio: Date | undefined,
    fechaFin: Date | undefined,
    interacciones: InteraccionProps[],
    emailReferencia?: string
  ): InstanciaActividad {
    const interaccionesObj = interacciones.map(
      (i) => new Interaccion(i.pasoId, i.contenido, i.fecha)
    );
    if (!accessToken) {
      throw new BusinessRuleViolationError('El token de acceso es obligatorio para reconstituir la instancia.');
    }
    return new InstanciaActividad(id, actividadId, usuarioId, accessToken, estado, fechaInicio, fechaFin, interaccionesObj, emailReferencia);
  }

  // --- Public Getters (Read-only) ---
  get usuarioId(): string | undefined {
    return this._usuarioId;
  }
  get emailReferencia(): string | undefined {
    return this._emailReferencia;
  }
  get accessToken(): string {
    return this._accessToken;
  }

  get estado(): InstanciaEstado {
    return this._estado;
  }

  get interacciones(): ReadonlyArray<Interaccion> {
    return this._interacciones; // Devuelve referencia al array, pero las entidades dentro son mutables solo vía métodos
  }

  get fechaInicio(): Date | undefined {
    return this._fechaInicio;
  }

  get fechaFin(): Date | undefined {
    return this._fechaFin;
  }

  // --- Métodos de Transición y Comportamiento ---

  /**
   * Transición: Generado -> Iniciado
   * @throws BusinessRuleViolationError si el estado no es válido.
   */
  public iniciar(): void {
    if (this._estado === InstanciaEstado.INICIADO) {
      // Idempotencia: Si ya está iniciado, no hacemos nada.
      return;
    }

    if (this._estado !== InstanciaEstado.GENERADO) {
      throw new BusinessRuleViolationError(
        `No se puede iniciar la actividad. Estado actual: ${this._estado}. Solo instancias en estado 'generado' pueden iniciarse.`
      );
    }

    this._estado = InstanciaEstado.INICIADO;
    this._fechaInicio = new Date();
  }

  /**
   * Registro o actualización de una respuesta a un paso.
   * Regla: Solo se pueden registrar respuestas si la instancia está en estado INICIADO.
   */
  public registrarRespuesta(pasoId: string, contenido: string): void {
    if (this._estado !== InstanciaEstado.INICIADO) {
      throw new BusinessRuleViolationError(
        `No se pueden registrar respuestas en estado: ${this._estado}. La actividad debe estar iniciada.`
      );
    }

    const interaccionExistente = this._interacciones.find((i) => i.pasoId === pasoId);

    if (interaccionExistente) {
      interaccionExistente.actualizarContenido(contenido);
    } else {
      // Validar contenido inicial
      if (!contenido || contenido.trim().length === 0) {
        throw new BusinessRuleViolationError('El contenido de la respuesta no puede estar vacío.');
      }
      this._interacciones.push(new Interaccion(pasoId, contenido, new Date()));
    }
  }

  /**
   * Transición: Iniciado -> Finalizado
   * Cierra la actividad e impide futuras modificaciones.
   */
  public finalizar(): void {
    if (this._estado !== InstanciaEstado.INICIADO) {
      throw new BusinessRuleViolationError(
        `No se puede finalizar la actividad. Estado actual: ${this._estado}. Solo instancias iniciadas pueden finalizarse.`
      );
    }

    // Regla opcional: Validar completitud (si hubiera lógica de pasos obligatorios, iría aquí)

    this._estado = InstanciaEstado.FINALIZADO;
    this._fechaFin = new Date();
  }

  /**
   * Asigna un usuario a la instancia.
   * Regla: Solo si no tiene uno ya asignado y no está finalizado.
   */
  public asignarUsuario(usuarioId: string): void {
    if (this._usuarioId) {
      throw new BusinessRuleViolationError('La instancia ya tiene un usuario asignado.');
    }
    if (this._estado === InstanciaEstado.FINALIZADO) {
      throw new BusinessRuleViolationError('No se puede asignar un usuario a una actividad finalizada.');
    }
    this._usuarioId = usuarioId;
  }

  /**
   * Transición: Cualquier Estado (menos Finalizado) -> Cancelado
   */
  public cancelar(): void {
    if (this._estado === InstanciaEstado.FINALIZADO) {
      throw new BusinessRuleViolationError('No se puede cancelar una actividad que ya ha sido finalizada.');
    }
    
    // Idempotencia de cancelación
    if (this._estado === InstanciaEstado.CANCELADO) return;

    this._estado = InstanciaEstado.CANCELADO;
    this._fechaFin = new Date(); // Registramos cuándo se canceló
  }
}
