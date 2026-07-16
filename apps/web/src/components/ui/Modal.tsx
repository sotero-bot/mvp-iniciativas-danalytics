import type { ReactNode } from 'react';
import { useCallback, useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Título ya traducido; sirve de `aria-labelledby`. Omitir para diálogos sin encabezado. */
  title?: ReactNode;
  children: ReactNode;
  /** Pie de acciones (botones). */
  footer?: ReactNode;
  /** Ancho máximo en px (por defecto 480). En móvil se muestra como hoja inferior. */
  maxWidth?: number;
  /** Cerrar al hacer clic en el fondo (por defecto true). */
  closeOnOverlay?: boolean;
  /** Mostrar botón ✕ de cierre en la esquina (por defecto true si hay título). */
  showClose?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo modal accesible: `role="dialog"`, `aria-modal`, `aria-labelledby`,
 * cierre con Escape, trampa de foco, foco inicial, restauración del foco previo
 * y bloqueo de scroll del body. Base para ConfirmModal y los modales de las
 * páginas. Usa `.modal-overlay` / `.modal-box` de index.css.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 480,
  closeOnOverlay = true,
  showClose,
}: ModalProps) {
  const { t } = useTranslation('common');
  const boxRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const resolvedShowClose = showClose ?? Boolean(title);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const box = boxRef.current;
        if (!box) return;
        const nodes = box.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (nodes.length === 0) {
          e.preventDefault();
          box.focus();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  // Foco inicial + restauración + bloqueo de scroll del body.
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const box = boxRef.current;
    const firstFocusable = box?.querySelector<HTMLElement>(FOCUSABLE);
    (firstFocusable ?? box)?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onMouseDown={closeOnOverlay ? e => { if (e.target === e.currentTarget) onClose(); } : undefined}
    >
      <div
        className="modal-box"
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        style={{ maxWidth }}
      >
        {(title || resolvedShowClose) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '1rem',
              marginBottom: title ? '1rem' : 0,
            }}
          >
            {title ? <h3 id={titleId} style={{ margin: 0 }}>{title}</h3> : <span />}
            {resolvedShowClose && (
              <button
                type="button"
                className="btn-link"
                onClick={onClose}
                aria-label={t('a11y.close_dialog')}
                style={{ fontSize: '1.25rem', lineHeight: 1, color: 'var(--color-text-tertiary)' }}
              >
                ✕
              </button>
            )}
          </div>
        )}
        {children}
        {footer && (
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end',
              marginTop: '1.5rem',
              flexWrap: 'wrap',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
