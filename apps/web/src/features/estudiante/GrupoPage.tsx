import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Breadcrumb, PageHeader, Loading, EmptyState } from '../../components/ui';
import { toast } from '../../components/toast-store';
import { GrupoIntegrantes } from './GrupoIntegrantes';
import { GrupoRecursosEstado } from './GrupoRecursosEstado';
import type { MiGrupo } from './GrupoRecursosEstado';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// HU-11: integrantes del grupo del estudiante (nombre + correo) y estado del reto.
export function EstudianteGrupoPage({ userId }: { userId: string }) {
  const { id: programaId = '' } = useParams();
  const { t } = useTranslation(['estudiante', 'common', 'admin']);
  const [grupos, setGrupos] = useState<MiGrupo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/grupos/mios`)
      .then((r) => r.json())
      .then((grps: MiGrupo[]) => { if (!cancelled) setGrupos(grps); })
      .catch((err) => { if (!cancelled) toast.error(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [programaId]);

  // RN-04: un estudiante está en un solo grupo por programa.
  const grupo = grupos.find((g) => g.programa.id === programaId);
  const programaNombre = grupo?.programa.nombre ?? t('estudiante:grupo.title');
  const from = `/estudiante/programas/${programaId}/grupo`;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: t('admin:sidebar.home'), to: '/inicio' },
          { label: t('estudiante:programas.title'), to: '/estudiante/programas' },
          { label: programaNombre, to: `/estudiante/programas/${programaId}/sesiones` },
          { label: t('estudiante:grupo.title') },
        ]}
      />
      <PageHeader eyebrow={programaNombre} title={grupo?.nombre ?? t('estudiante:grupo.title')} />
      {loading && <Loading label={t('common:loading')} />}

      {!loading && !grupo && (
        <EmptyState title={t('estudiante:grupo.sin_grupo')} description={t('estudiante:grupo.sin_grupo_hint')} />
      )}

      {!loading && grupo && (
        <div className="home-stack">
          <div className="section-card home-panel">
            <div className="section-card-header">
              <span className="section-card-title">{t('estudiante:grupo.integrantes_title')}</span>
              <span className="count-badge">{grupo.miembros.length}</span>
            </div>
            <div className="section-card-body">
              <GrupoIntegrantes miembros={grupo.miembros} userId={userId} />
            </div>
          </div>

          <div className="section-card home-panel">
            <div className="section-card-header">
              <span className="section-card-title">{t('estudiante:grupo.reto_title')}</span>
            </div>
            <div className="section-card-body">
              <GrupoRecursosEstado grupo={grupo} from={from} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
