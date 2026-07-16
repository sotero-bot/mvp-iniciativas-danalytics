import { useTranslation } from 'react-i18next';
import { Modal } from './ui/Modal';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    /** Variante del botón de confirmación (por defecto destructiva). */
    danger?: boolean;
}

export function ConfirmModal({
    isOpen,
    title,
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    danger = true,
}: ConfirmModalProps) {
    const { t } = useTranslation('common');

    const resolvedConfirm = confirmLabel ?? t('buttons.delete');
    const resolvedCancel = cancelLabel ?? t('buttons.cancel');

    return (
        <Modal
            isOpen={isOpen}
            onClose={onCancel}
            title={title}
            maxWidth={440}
            showClose={false}
            footer={
                <>
                    <button className="btn btn-secondary" onClick={onCancel}>
                        {resolvedCancel}
                    </button>
                    <button
                        className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
                        onClick={onConfirm}
                    >
                        {resolvedConfirm}
                    </button>
                </>
            }
        >
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
                {message}
            </p>
        </Modal>
    );
}
