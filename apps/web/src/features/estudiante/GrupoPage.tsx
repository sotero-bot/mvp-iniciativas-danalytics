import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { PageHeader, Loading, EmptyState, StatusBadge } from '../../components/ui';
import { toast } from '../../components/toast-store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface RecursoEstado {
  iniciada: boolean;
  entregada: boolean;
  ultimaEdicionEn: string | null;
}

interface MiGrupo {
  id: string;
  nombre: string;
  orden: number;
  programa: { id: string; nombre: string; estado: string };
  miembros: { id: string; nombre: string }[];
  recursos: {
    bitacora: RecursoEstado & { habilitada: boolean }; // O-01
    plantillaProyecto: RecursoEstado;
    presentacionFinal: { entregada: boolean; entregadoEn: string | null };
  };
}

// Fase 3 (RF-16/RF-30/RF-31/RF-32): hub "Mi grupo" del estudiante — un card por
// grupo con el estado de bitácora, plantilla del proyecto y presentación final.
export function EstudianteGrupoPage() {
  const { t } = useTranslation(['formularios', 'common']);
  const [grupos, setGrupos] = useState<MiGrupo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/grupos/mios`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setGrupos(data); })
      .catch((err) => { if (!cancelled) toast.error(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const badge = (activo: boolean, textoActivo: string, textoInactivo: string) => (
    <StatusBadge variant={activo ? 'info' : 'neutral'}>
      {activo ? textoActivo : textoInactivo}
    </StatusBadge>
  );

  // Estado de un recurso de grupo: Entregado (enviado) / En progreso / Sin iniciar.
  const recursoBadge = (rec: RecursoEstado) =>
    rec.entregada ? (
      <StatusBadge variant="success">{t('formularios:grupo.estado_entregado')}</StatusBadge>
    ) : (
      badge(rec.iniciada, t('formularios:grupo.estado_en_progreso'), t('formularios:grupo.estado_sin_iniciar'))
    );

  return (
    <div className="page">
      <PageHeader title={t('formularios:grupo.title')} />
      {loading && <Loading label={t('common:loading')} />}
      {!loading && grupos.length === 0 && <EmptyState title={t('formularios:grupo.empty')} />}

      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {grupos.map((g) => (
          <div key={g.id} className="card" style={{ padding: '1.1rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#14B8A6', textTransform: 'uppercase' }}>
              {g.programa.nombre}
            </div>
            <div style={{ fontWeight: 600, margin: '4px 0 6px', fontSize: '1.05rem' }}>{g.nombre}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 14 }}>
              {t('formularios:grupo.miembros')}: {g.miembros.map(m => m.nombre).join(', ') || '—'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem' }}>📓 {t('formularios:tipos.bitacora')}</span>
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  {/* O-01: la bitácora solo se abre cuando el facilitador/admin la habilita. */}
                  {!g.recursos.bitacora.habilitada ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      🔒 {t('formularios:grupo.bitacora_bloqueada')}
                    </span>
                  ) : (
                    <>
                      {recursoBadge(g.recursos.bitacora)}
                      <Link className="btn" to={`/estudiante/grupos/${g.id}/bitacora`}>{t('formularios:grupo.abrir')}</Link>
                    </>
                  )}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem' }}>📐 {t('formularios:tipos.plantilla_proyecto')}</span>
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  {recursoBadge(g.recursos.plantillaProyecto)}
                  <Link className="btn" to={`/estudiante/grupos/${g.id}/plantilla-proyecto`}>{t('formularios:grupo.abrir')}</Link>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem' }}>🎤 {t('formularios:presentacion.title')}</span>
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  {g.recursos.presentacionFinal.entregada ? (
                    <StatusBadge variant="success">
                      {t('formularios:presentacion.entregada')}
                    </StatusBadge>
                  ) : (
                    badge(false, '', t('formularios:grupo.estado_sin_iniciar'))
                  )}
                  <Link className="btn" to={`/estudiante/grupos/${g.id}/presentacion`}>{t('formularios:grupo.abrir')}</Link>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
