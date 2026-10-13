import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Breadcrumb, PageHeader } from '../../components/ui';
import { ParticipantesPanel } from '../participantes/ParticipantesPanel';

// HU-16: roster + ficha para el cliente. Sin entregable del reto (RN-07).
export function PortalParticipantesPage() {
  const { id: programaId = '' } = useParams();
  const { t } = useTranslation(['participantes', 'portal', 'admin']);
  return (
    <div className="page">
      <Breadcrumb
        items={[
          { label: t('admin:sidebar.home'), to: '/inicio' },
          { label: t('portal:programas.title'), to: '/portal/programas' },
          { label: t('participantes:list_title') },
        ]}
      />
      <PageHeader title={t('participantes:list_title')} />
      <ParticipantesPanel programaId={programaId} variant="cliente" />
    </div>
  );
}
