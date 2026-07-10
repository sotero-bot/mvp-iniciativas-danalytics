import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface FormularioDisponible {
  id: string;
  programaId: string;
  programa: { id: string; nombre: string };
  tipoFormulario: string;
  nombre: string;
  descripcion: string | null;
  estado: 'pendiente' | 'en_progreso' | 'enviado';
  enviadoEn: string | null;
}

const ESTADO_STYLE: Record<string, { bg: string; fg: string }> = {
  pendiente: { bg: 'rgba(245,158,11,0.15)', fg: '#B45309' },
  en_progreso: { bg: 'rgba(59,130,246,0.15)', fg: '#1D4ED8' },
  enviado: { bg: 'rgba(34,197,94,0.15)', fg: '#15803D' },
};

// RF-28: dashboard de formularios del estudiante con su estado.
export function EstudianteFormulariosPage() {
  const { t } = useTranslation(['formularios', 'common']);
  const [formularios, setFormularios] = useState<FormularioDisponible[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/formularios/disponibles`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setFormularios(data); })
      .catch((err) => { if (!cancelled) setToast(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '1.4rem', marginBottom: '1.25rem' }}>{t('formularios:estudiante.title')}</h1>
      {toast && <div className="toast">{toast}</div>}
      {loading && <p>{t('common:loading')}</p>}
      {!loading && formularios.length === 0 && <p>{t('formularios:estudiante.empty')}</p>}

      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {formularios.map((f) => {
          const estilo = ESTADO_STYLE[f.estado];
          return (
            <div key={f.id} className="card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#14B8A6', textTransform: 'uppercase' }}>
                {t(`formularios:tipos.${f.tipoFormulario}`)}
              </div>
              <div style={{ fontWeight: 600, margin: '4px 0' }}>{f.nombre}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 10 }}>
                {f.programa?.nombre}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600, borderRadius: 999, background: estilo.bg, color: estilo.fg }}>
                  {t(`formularios:estudiante.estado.${f.estado}`)}
                </span>
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
