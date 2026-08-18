import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Sistema de toasts GLOBAL. Cualquier módulo puede disparar un aviso sin pasar
// props ni contexto: `toast.success(msg)` (verde) o `toast.error(msg)` (rojo).
// Se renderiza una única pila fija en la esquina SUPERIOR DERECHA y cada aviso
// se autodescarta a los 5 segundos. Reemplaza el patrón antiguo por página
// (`useState<string>` + `<div className="toast">`), que salía abajo a la derecha
// y no distinguía éxito de error.

export type ToastVariant = 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

type Listener = (items: ToastItem[]) => void;

const DURATION_MS = 5000;

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<Listener>();

function emit() {
  const snapshot = [...items];
  listeners.forEach(l => l(snapshot));
}

function dismiss(id: number) {
  items = items.filter(i => i.id !== id);
  emit();
}

function push(message: string, variant: ToastVariant) {
  if (!message) return;
  const id = ++seq;
  items = [...items, { id, message, variant }];
  emit();
  setTimeout(() => dismiss(id), DURATION_MS);
}

export const toast = {
  success: (message: string) => push(message, 'success'),
  error: (message: string) => push(message, 'error'),
};

// Fondo sólido (no el fondo apagado de badges/alerts) con texto blanco para
// que el aviso resalte y no se pierda sobre el fondo de la app.
const PALETTE: Record<ToastVariant, { bg: string; border: string; color: string; icon: string }> = {
  success: { bg: 'var(--color-success)', border: 'var(--color-success-strong)', color: '#FFFFFF', icon: '✓' },
  error: { bg: 'var(--color-danger)', border: 'var(--color-danger-strong)', color: '#FFFFFF', icon: '⚠' },
};

// Se monta UNA sola vez (en App.tsx). Se suscribe al store y pinta la pila.
export function ToastHost() {
  const [list, setList] = useState<ToastItem[]>(items);

  useEffect(() => {
    listeners.add(setList);
    setList([...items]);
    return () => { listeners.delete(setList); };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed', top: 20, right: 20, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 10,
        alignItems: 'flex-end', pointerEvents: 'none',
      }}
    >
      {list.map(item => {
        const p = PALETTE[item.variant];
        return (
          <div
            key={item.id}
            role="status"
            onClick={() => dismiss(item.id)}
            style={{
              pointerEvents: 'auto', cursor: 'pointer',
              background: p.bg, border: `2px solid ${p.border}`, color: p.color,
              padding: '14px 20px', borderRadius: 12,
              display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
              fontSize: '0.95rem', fontWeight: 600, maxWidth: 420, minWidth: 260,
              animation: 'toastIn 0.25s ease',
            }}
          >
            <span style={{
              fontSize: '1rem', flexShrink: 0,
              width: 24, height: 24, borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>{p.icon}</span>
            <span>{item.message}</span>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
