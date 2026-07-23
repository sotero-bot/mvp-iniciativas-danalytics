import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { PageHeader, Loading, EmptyState, StatusBadge } from '../../components/ui';
import type { StatusVariant } from '../../components/ui';
import { toast } from '../../components/toast-store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface FormularioDisponible {
  id: string;
  programaId: string | null;
  programa: { id: string; nombre: string } | null;
  tipoFormulario: string;
  nombre: string;
  descripcion: string | null;
  estado: 'pendiente' | 'en_progreso' | 'enviado';
  enviadoEn: string | null;
}

const ESTADO_VARIANT: Record<string, StatusVariant> = {
  pendiente: 'warning',
  en_progreso: 'info',
  enviado: 'success',
};

// RF-28: dashboard de formularios del estudiante con su estado.
export function EstudianteFormulariosPage() {
  const { t } = useTranslation(['formularios', 'common']);
  const [formularios, setFormularios] = useState<FormularioDisponible[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/formularios/disponibles`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setFormularios(data); })
      .catch((err) => { if (!cancelled) toast.error(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="page">
      <PageHeader title={t('formularios:estudiante.title')} />
      {loading && <Loading label={t('common:loading')} />}
      {!loading && formularios.length === 0 && <EmptyState title={t('formularios:estudiante.empty')} />}

      <div className="card-grid">
        {formularios.map((f) => {
          return (
            <div key={f.id} className="card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#14B8A6', textTransform: 'uppercase' }}>
                {t(`formularios:tipos.${f.tipoFormulario}`)}
              </div>
              <div style={{ fontWeight: 600, margin: '4px 0' }}>{f.nombre}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 10 }}>
                {f.programa?.nombre ?? t('formularios:estudiante.global')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <StatusBadge variant={ESTADO_VARIANT[f.estado] ?? 'neutral'}>
                  {t(`formularios:estudiante.estado.${f.estado}`)}
                </StatusBadge>
                <Link className="btn" to={`/estudiante/formularios/${f.id}`}>
                  {f.estado === 'pendiente'
                    ? t('formularios:estudiante.responder')
                    : f.estado === 'en_progreso'
                      ? t('formularios:estudiante.continuar')
                      : t('formularios:estudiante.ver_estado')}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
