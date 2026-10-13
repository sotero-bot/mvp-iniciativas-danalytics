import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Breadcrumb, PageHeader } from '../../components/ui';
import { ParticipantesPanel } from '../participantes/ParticipantesPanel';

// HU-16: roster del programa + ficha por estudiante (con el entregable del reto, RN-07).
export function FacilitadorParticipantesPage() {
  const { id: programaId = '' } = useParams();
  const { t } = useTranslation(['participantes', 'facilitador', 'admin']);
  return (
    <div>
      <Breadcrumb
        items={[
          { label: t('admin:sidebar.home'), to: '/inicio' },
          { label: t('facilitador:programas.title'), to: '/facilitador/programas' },
          { label: t('participantes:list_title') },
        ]}
      />
      <PageHeader title={t('participantes:list_title')} />
      <ParticipantesPanel programaId={programaId} variant="facilitador" />
    </div>
  );
}
