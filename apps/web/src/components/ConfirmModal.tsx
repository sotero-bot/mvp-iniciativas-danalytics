import React from 'react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmModal({
    isOpen,
    title,
    message,
    confirmLabel = 'Eliminar',
    onConfirm,
    onCancel
}: ConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'fadeIn 0.15s ease'
            }}
            onClick={onCancel}
        >
            <div
                style={{
                    background: '#fff', borderRadius: 12, padding: '2rem',
                    maxWidth: 440, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                    animation: 'slideUp 0.2s ease'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Icon */}
                <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: '#fee2e2', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '1.5rem', margin: '0 auto 1rem'
                }}>
                    🗑️
                </div>

                <h3 style={{ textAlign: 'center', marginBottom: '0.5rem', color: '#1e293b' }}>{title}</h3>
                <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                    {message}
                </p>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                    <button
                        className="btn btn-secondary"
                        style={{ flex: 1, maxWidth: 160 }}
                        onClick={onCancel}
                    >
                        Cancelar
                    </button>
                    <button
                        className="btn"
                        style={{
                            flex: 1, maxWidth: 160,
                            background: '#dc2626', color: '#fff',
                            border: 'none'
                        }}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
