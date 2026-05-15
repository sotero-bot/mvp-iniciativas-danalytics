import { useEffect, useState } from 'react';

interface Props {
  message: string;
  variant?: 'success' | 'info' | 'error';
  duration?: number;
  onClose?: () => void;
}

const PALETTE = {
  success: { bg: '#ECFDF5', border: '#A7F3D0', color: '#065F46', icon: '✓' },
  info:    { bg: '#EFF6FF', border: '#BFDBFE', color: '#1E40AF', icon: 'ℹ' },
  error:   { bg: '#FEF2F2', border: '#FECACA', color: '#991B1B', icon: '⚠' },
};

export function Toast({ message, variant = 'success', duration = 3500, onClose }: Props) {
  const [visible, setVisible] = useState(true);
  const p = PALETTE[variant];

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(false), duration - 400);
    const t2 = setTimeout(() => onClose?.(), duration);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [duration, onClose]);

  return (
    <div style={{
      position: 'fixed', top: 72, right: 20, zIndex: 1000,
      background: p.bg, border: `1px solid ${p.border}`, color: p.color,
      padding: '10px 16px', borderRadius: 10,
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      fontSize: '0.875rem', fontWeight: 500,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateX(0)' : 'translateX(20px)',
      transition: 'opacity 0.4s ease, transform 0.4s ease',
      maxWidth: 380,
    }}>
      <span style={{ fontSize: '1.1rem' }}>{p.icon}</span>
      <span>{message}</span>
    </div>
  );
}
