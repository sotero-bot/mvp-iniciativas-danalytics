import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Breadcrumb, PageHeader, Loading, EmptyState, StatusBadge, StatCard, Field, FilterToolbar } from '../../components/ui';
import type { StatusVariant } from '../../components/ui';
import { SidebarIcon } from '../../components/SidebarIcon';
import { toast } from '../../components/toast-store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type EstadoPrograma = 'borrador' | 'activo' | 'finalizado' | 'cancelado';
const ESTADOS: EstadoPrograma[] = ['borrador', 'activo', 'finalizado', 'cancelado'];

interface Programa {
  id: string;
  nombre: string;
  estado: EstadoPrograma;
  fechaInicio: string | null;
  fechaFin: string | null;
  empresa: { id: string; nombre: string } | null;
  soloLectura?: boolean;
}

const ESTADO_VARIANT: Record<EstadoPrograma, StatusVariant> = {
  borrador: 'neutral',
  activo: 'success',
  finalizado: 'info',
  cancelado: 'danger',
};

function formatFecha(iso: string, locale?: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function FacilitadorProgramasPage() {
  const { t, i18n } = useTranslation(['facilitador', 'formularios', 'common', 'admin', 'errors']);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterEstado, setFilterEstado] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/programas`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setProgramas(data); })
      .catch((err) => { if (!cancelled) toast.error(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Opciones de empresa derivadas de los programas cargados (sin duplicados).
  const empresaOptions = useMemo(() => {
    const map = new Map<string, string>();
    programas.forEach((p) => { if (p.empresa) map.set(p.empresa.id, p.empresa.nombre); });
    return Array.from(map, ([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [programas]);

  const programasFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return programas.filter((p) => {
      if (filterEmpresa && p.empresa?.id !== filterEmpresa) return false;
      if (filterEstado && p.estado !== filterEstado) return false;
      if (q && !p.nombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [programas, search, filterEmpresa, filterEstado]);

  return (
    <div>
      <Breadcrumb items={[{ label: t('admin:sidebar.home'), to: '/inicio' }, { label: t('facilitador:programas.title') }]} />
      <PageHeader title={t('facilitador:programas.title')} />

      {/* KPIs: lectura de un vistazo del portafolio del facilitador. */}
      {!loading && programas.length > 0 && (
        <div className="section-card home-panel" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="section-card-header">
            <span className="section-card-title">{t('common:home.resumen_title')}</span>
          </div>
          <div className="section-card-body">
            <div className="home-kpi-grid">
              <StatCard
                label={t('facilitador:programas.kpi_total')}
                value={programas.length}
                icon={<SidebarIcon name="programas" size={18} />}
                accent="#38BDF8"
              />
              <StatCard
                label={t('facilitador:programas.kpi_activos')}
                value={programas.filter((p) => p.estado === 'activo').length}
                icon={<SidebarIcon name="programas" size={18} />}
                accent="#22C55E"
              />
              <StatCard
                label={t('facilitador:programas.kpi_finalizados')}
                value={programas.filter((p) => p.estado === 'finalizado').length}
                icon={<SidebarIcon name="formularios" size={18} />}
                accent="#155BA0"
              />
            </div>
          </div>
        </div>
      )}

      <div className="section-card home-panel">
        <div className="section-card-header">
          <span className="section-card-title">{t('facilitador:programas.section_title')}</span>
          <span className="count-badge">{programasFiltrados.length}</span>
        </div>

        {/* Filtros dentro del panel (franja sutil): búsqueda, empresa y estado */}
        {!loading && programas.length > 0 && (
          <div className="home-filter-strip">
            <FilterToolbar>
              <Field label={t('facilitador:programas.filtros.buscar')}>
                <input
                  className="input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('facilitador:programas.filtros.buscar_placeholder')}
                />
              </Field>
              <Field label={t('facilitador:programas.filtros.empresa')}>
                <select className="input" value={filterEmpresa} onChange={(e) => setFilterEmpresa(e.target.value)}>
                  <option value="">{t('facilitador:programas.filtros.todas')}</option>
                  {empresaOptions.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </Field>
              <Field label={t('facilitador:programas.filtros.estado')}>
                <select className="input" value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
                  <option value="">{t('facilitador:programas.filtros.todos')}</option>
                  {ESTADOS.map((s) => <option key={s} value={s}>{t(`facilitador:programas.estado.${s}`)}</option>)}
                </select>
              </Field>
            </FilterToolbar>
          </div>
        )}

        <div className="section-card-body">
      {loading && <Loading label={t('common:loading')} />}
      {!loading && programas.length === 0 && <EmptyState title={t('facilitador:programas.empty')} />}
      {!loading && programas.length > 0 && programasFiltrados.length === 0 && (
        <EmptyState title={t('facilitador:programas.sin_resultados')} />
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 'var(--space-4)',
      }}>
        {programasFiltrados.map((p) => {
          const fechas = [p.fechaInicio, p.fechaFin]
            .filter(Boolean)
            .map((f) => formatFecha(f as string, i18n.language));
          const acciones = [
            { key: 'sesiones', label: t('facilitador:sesiones.title'), to: `/facilitador/programas/${p.id}/sesiones` },
            { key: 'grupos', label: t('facilitador:grupos.title'), to: `/facilitador/programas/${p.id}/grupos` },
            { key: 'observaciones', label: t('facilitador:observaciones.title'), to: `/facilitador/programas/${p.id}/observaciones` },
            { key: 'resultados', label: t('formularios:resultados.title'), to: `/facilitador/programas/${p.id}/resultados` },
          ];
          return (
            <div key={p.id} className="card" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {/* Encabezado: nombre + estado */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text-main)', lineHeight: 1.3 }}>
                  {p.nombre}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <StatusBadge variant={ESTADO_VARIANT[p.estado]}>
                    {t(`facilitador:programas.estado.${p.estado}`)}
                  </StatusBadge>
                  {p.soloLectura && (
                    <StatusBadge variant="neutral" title={t('errors:PROGRAMA_GRACIA_VENCIDA')}>
                      {t('facilitador:programas.solo_lectura')}
                    </StatusBadge>
                  )}
                </div>
              </div>

              {p.empresa && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                  <SidebarIcon name="empresas" size={14} />
                  {p.empresa.nombre}
                </div>
              )}

              {fechas.length > 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  {fechas.join(' — ')}
                </div>
              )}

              {/* Acciones como botones: ancladas al fondo (margin-top:auto) para
                  que las tarjetas de la fila queden parejas aunque el nombre/fechas
                  ocupen distinto alto. */}
              <div style={{ marginTop: 'auto', paddingTop: 'var(--space-4)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                {acciones.map((a) => (
                  <Link key={a.key} className="btn btn-secondary btn-sm" to={a.to}>
                    {a.label}
                  </Link>
                ))}
                <Link
                  className="btn btn-primary btn-sm"
                  to={`/facilitador/programas/${p.id}/reto`}
                  style={{ gridColumn: '1 / -1' }}
                >
                  {t('formularios:reto.title')}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
        </div>
      </div>
    </div>
  );
}
