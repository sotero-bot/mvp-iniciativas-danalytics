import type { ReactElement, ReactNode } from 'react';
import { cloneElement, isValidElement, useId } from 'react';

interface FieldProps {
  /** Etiqueta ya traducida. */
  label: ReactNode;
  /** id del control; si se omite se genera uno y se inyecta al hijo. */
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  /**
   * El control del formulario. Si no pasas `htmlFor`, se clona el hijo para
   * asociarlo automáticamente con el label vía `id` (accesibilidad).
   */
  children: ReactNode;
  className?: string;
}

/**
 * Campo de formulario accesible: label asociado al control mediante `htmlFor`
 * (la app tenía 0 `htmlFor`). Reemplaza el patrón inline
 * `<label style={{ fontSize:'0.75rem', color:'#64748B', ... }}>`.
 */
export function Field({ label, htmlFor, required, hint, error, children, className }: FieldProps) {
  const generatedId = useId();
  const controlId = htmlFor ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  // Si no se pasó htmlFor y el hijo es un único elemento, le inyectamos id y
  // aria-describedby para no obligar al llamador a repetirlos.
  let control = children;
  if (!htmlFor && isValidElement(children)) {
    const child = children as ReactElement<Record<string, unknown>>;
    const describedBy =
      [child.props['aria-describedby'] as string | undefined, hintId, errorId]
        .filter(Boolean)
        .join(' ') || undefined;
    control = cloneElement(child, {
      id: child.props.id ?? controlId,
      'aria-describedby': describedBy,
      'aria-invalid': error ? true : child.props['aria-invalid'],
    });
  }

  return (
    <div className={`field${className ? ` ${className}` : ''}`}>
      <label className="field-label" htmlFor={controlId}>
        {label}
        {required && <span className="field-req" aria-hidden="true">*</span>}
      </label>
      {control}
      {hint && <p className="field-hint" id={hintId}>{hint}</p>}
      {error && <p className="field-error" id={errorId}>{error}</p>}
    </div>
  );
}
