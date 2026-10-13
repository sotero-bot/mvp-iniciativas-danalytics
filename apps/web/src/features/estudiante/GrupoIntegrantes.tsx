import { useTranslation } from 'react-i18next';
import { StatusBadge, DataTable } from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
import type { MiGrupo } from './GrupoRecursosEstado';

type Integrante = MiGrupo['miembros'][number];

// HU-11: tabla de integrantes (nombre + correo). Compartida por SesionesPage (tarjeta
// "Mi grupo") y GrupoPage. `userId` marca la fila propia con el badge "Tú".
export function GrupoIntegrantes({ miembros, userId }: { miembros: Integrante[]; userId: string }) {
  const { t } = useTranslation(['estudiante']);

  const columns: DataTableColumn<Integrante>[] = [
    {
      key: 'nombre',
      header: t('estudiante:grupo.nombre'),
      align: 'left',
      render: (m) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {m.nombre}
          {m.id === userId && <StatusBadge variant="info">{t('estudiante:grupo.yo')}</StatusBadge>}
        </span>
      ),
    },
    {
      key: 'correo',
      header: t('estudiante:grupo.correo'),
      align: 'left',
      // Usuario.email es nullable: sin correo, texto de respaldo (nunca un mailto: roto).
      render: (m) => (m.email
        ? <a href={`mailto:${m.email}`} aria-label={`${t('estudiante:grupo.contactar')} ${m.nombre}`}>{m.email}</a>
        : <span style={{ color: 'var(--color-text-tertiary)' }}>{t('estudiante:grupo.sin_correo')}</span>),
    },
  ];

  return <DataTable columns={columns} rows={miembros} rowKey={(m) => m.id} />;
}
