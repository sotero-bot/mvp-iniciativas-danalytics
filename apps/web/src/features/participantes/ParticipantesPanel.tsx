import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Button, DataTable, EmptyState, Field, FilterToolbar, Loading, Modal } from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
import { toast } from '../../components/toast-store';
import { FichaEstudiante } from './FichaEstudiante';
import type { FichaEstudianteData } from './FichaEstudiante';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const SIN_VALOR = '__sin__';

interface ParticipanteFila {
  usuarioId: string;
  nombre: string;
  email: string;
  area: string | null;
  grupo: string | null;
  asistenciaPorcentaje: number;
  formulariosEnviados: number;
  formulariosTotal: number;
}

interface Props {
  programaId: string;
  variant: 'facilitador' | 'cliente';
}

// HU-16: listado + ficha en modal, compartido por la página del facilitador y la del cliente.
// Cambia solo la ruta del API; el recorte de datos lo hace el servidor.
export function ParticipantesPanel({ programaId, variant }: Props) {
  const { t } = useTranslation(['participantes', 'common']);
  const base =
    variant === 'facilitador'
      ? `${API_URL}/facilitador/programas/${programaId}/participantes`
      : `${API_URL}/portal/programas/${programaId}/participantes`;
  const listUrl = variant === 'facilitador' ? `${base}/resumen` : base;

  const [filas, setFilas] = useState<ParticipanteFila[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filtroArea, setFiltroArea] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [ficha, setFicha] = useState<FichaEstudianteData | null>(null);
  const [abriendo, setAbriendo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithErrorMapping(listUrl)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setFilas(data); })
      .catch((err) => { if (!cancelled) toast.error(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [listUrl]);

  const areas = useMemo(() => [...new Set(filas.map((f) => f.area).filter((a): a is string => !!a))].sort(), [filas]);
  const grupos = useMemo(() => [...new Set(filas.map((f) => f.grupo).filter((g): g is string => !!g))].sort(), [filas]);

  const visibles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return filas.filter((f) => {
      if (q && !f.nombre.toLowerCase().includes(q) && !f.email.toLowerCase().includes(q)) return false;
      if (filtroArea && (filtroArea === SIN_VALOR ? f.area !== null : f.area !== filtroArea)) return false;
      if (filtroGrupo && (filtroGrupo === SIN_VALOR ? f.grupo !== null : f.grupo !== filtroGrupo)) return false;
      return true;
    });
  }, [filas, search, filtroArea, filtroGrupo]);

  const abrirFicha = async (usuarioId: string) => {
    setAbriendo(true);
    try {
      const res = await fetchWithErrorMapping(`${base}/${usuarioId}/ficha`);
      setFicha(await res.json());
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setAbriendo(false);
    }
  };

  const columnas: DataTableColumn<ParticipanteFila>[] = [
    {
      key: 'nombre',
      header: t('participantes:col_nombre'),
      render: (f) => (
        <>
          {f.nombre}
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>{f.email}</div>
        </>
      ),
    },
    { key: 'area', header: t('participantes:col_area'), render: (f) => f.area ?? t('participantes:sin_area') },
    { key: 'grupo', header: t('participantes:col_grupo'), render: (f) => f.grupo ?? t('participantes:sin_grupo') },
    { key: 'asistencia', header: t('participantes:col_asistencia'), align: 'center', render: (f) => `${Math.round(f.asistenciaPorcentaje * 100)}%` },
    { key: 'formularios', header: t('participantes:col_formularios'), align: 'center', render: (f) => `${f.formulariosEnviados} / ${f.formulariosTotal}` },
    {
      key: 'acciones',
      header: '',
      align: 'right',
      render: (f) => (
        <Button variant="secondary" size="sm" onClick={() => abrirFicha(f.usuarioId)} disabled={abriendo}>
          {t('participantes:ver_ficha')}
        </Button>
      ),
    },
  ];

  return (
    <>
      <div className="section-card home-panel">
        <div className="section-card-header">
          <span className="section-card-title">{t('participantes:list_section')}</span>
          <span className="count-badge">{visibles.length}</span>
        </div>

        {!loading && filas.length > 0 && (
          <div className="home-filter-strip">
            <FilterToolbar>
              <Field label={t('participantes:buscar')}>
                <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('participantes:buscar_placeholder')} />
              </Field>
              <Field label={t('participantes:filtro_area')}>
                <select className="input" value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)}>
                  <option value="">{t('participantes:filtro_todas')}</option>
                  {areas.map((a) => <option key={a} value={a}>{a}</option>)}
                  <option value={SIN_VALOR}>{t('participantes:sin_area')}</option>
                </select>
              </Field>
              <Field label={t('participantes:filtro_grupo')}>
                <select className="input" value={filtroGrupo} onChange={(e) => setFiltroGrupo(e.target.value)}>
                  <option value="">{t('participantes:filtro_todos')}</option>
                  {grupos.map((g) => <option key={g} value={g}>{g}</option>)}
                  <option value={SIN_VALOR}>{t('participantes:sin_grupo')}</option>
                </select>
              </Field>
            </FilterToolbar>
          </div>
        )}

        <div className="section-card-body">
          {loading && <Loading label={t('common:loading')} />}
          {!loading && filas.length === 0 && <EmptyState title={t('participantes:empty')} />}
          {!loading && filas.length > 0 && (
            <DataTable columns={columnas} rows={visibles} rowKey={(f) => f.usuarioId} emptyMessage={t('participantes:empty')} />
          )}
        </div>
      </div>

      <Modal isOpen={ficha !== null} onClose={() => setFicha(null)} title={t('participantes:ficha_title')} maxWidth={880}>
        {ficha && <FichaEstudiante ficha={ficha} variant={variant} />}
      </Modal>
    </>
  );
}
