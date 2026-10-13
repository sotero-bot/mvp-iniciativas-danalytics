import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Breadcrumb, PageHeader, Loading, EmptyState, StatusBadge } from '../../components/ui';
import { toast } from '../../components/toast-store';
import { pendienteTo } from './pendientes';
import type { Pendiente, PendientesAgrupados } from './pendientes';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// HU-13: pendientes del estudiante en un programa, divididos por sesión; lo que no
// pertenece a una sesión concreta va aparte en "Sin sesión asociada".
export function EstudiantePendientesPage() {
  const { id: programaId = '' } = useParams();
  const { t } = useTranslation(['estudiante', 'common', 'admin']);
  const [data, setData] = useState<PendientesAgrupados | null>(null);
  const [programaNombre, setProgramaNombre] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchWithErrorMapping(`${API_URL}/estudiante/programas/${programaId}/pendientes`).then((r) => r.json()),
      fetchWithErrorMapping(`${API_URL}/programas/${programaId}/resumen`).then((r) => r.json()),
    ])
      .then(([pendientes, programa]: [PendientesAgrupados, { nombre: string }]) => {
        if (cancelled) return;
        setData(pendientes);
        setProgramaNombre(programa.nombre);
      })
      .catch((err) => { if (!cancelled) toast.error(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [programaId]);

  const etiqueta = (p: Pendiente): string => {
    switch (p.tipo) {
      case 'encuesta_inicio':
        return t('estudiante:home.pendiente_encuesta');
      case 'matricula':
        return t('estudiante:home.pendiente_matricula', { programa: p.programaNombre });
      case 'entregable':
        return t('estudiante:home.pendiente_entregable', { programa: p.programaNombre });
      case 'formulario':
        return p.nombre ?? '';
    }
  };

  const lista = (items: Pendiente[]) => (
    <div className="home-list">
      {items.map((p, i) => (
        <Link
          key={`${p.tipo}-${p.plantillaId ?? p.programaId ?? i}`}
          to={pendienteTo(p)}
          className="home-list-row"
        >
          <span className="home-list-row-dot" aria-hidden="true" />
          <span className="home-list-row-text">{etiqueta(p)}</span>
          <span className="home-list-row-arrow" aria-hidden="true">›</span>
        </Link>
      ))}
    </div>
  );

  return (
    <div>
      <Breadcrumb
        items={[
          { label: t('admin:sidebar.home'), to: '/inicio' },
          { label: t('estudiante:programas.title'), to: '/estudiante/programas' },
          { label: programaNombre || t('estudiante:programas.title'), to: `/estudiante/programas/${programaId}/sesiones` },
          { label: t('estudiante:pendientes.title') },
        ]}
      />
      <PageHeader
        eyebrow={programaNombre}
        title={t('estudiante:pendientes.title')}
        description={data ? t('estudiante:pendientes.total', { count: data.total }) : undefined}
      />
      {loading && <Loading label={t('common:loading')} />}

      {!loading && data && data.total === 0 && <EmptyState title={t('estudiante:pendientes.empty')} />}

      {!loading && data && data.total > 0 && (
        <div className="home-stack">
          {data.porSesion.map((s) => (
            <div key={s.numeroSesion} className="section-card home-panel">
              <div className="section-card-header">
                <span className="section-card-title">
                  {t('estudiante:pendientes.sesion_prefix', { n: s.numeroSesion })} · {s.titulo}
                </span>
                {s.realizada && <StatusBadge variant="neutral">{t('estudiante:pendientes.sesion_realizada')}</StatusBadge>}
                <span className="count-badge">{s.items.length}</span>
              </div>
              <div className="section-card-body">{lista(s.items)}</div>
            </div>
          ))}

          {data.generales.length > 0 && (
            <div className="section-card home-panel">
              <div className="section-card-header">
                <span className="section-card-title">{t('estudiante:pendientes.generales_title')}</span>
                <span className="count-badge">{data.generales.length}</span>
              </div>
              <div className="section-card-body">
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-3)' }}>{t('estudiante:pendientes.generales_hint')}</p>
                {lista(data.generales)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
