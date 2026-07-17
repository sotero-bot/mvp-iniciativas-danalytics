import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { PageHeader, Loading, EmptyState, StatusBadge, Field } from '../../components/ui';
import type { StatusVariant } from '../../components/ui';

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
  const { t, i18n } = useTranslation(['facilitador', 'formularios', 'common']);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterEstado, setFilterEstado] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/programas`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setProgramas(data); })
      .catch((err) => { if (!cancelled) setToast(translateError(err)); })
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
    <div className="page">
      <PageHeader title={t('facilitador:programas.title')} />
      {toast && <div className="toast">{toast}</div>}

      {/* Filtros: búsqueda por nombre, empresa y estado */}
      {!loading && programas.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 16,
          padding: 16,
          background: 'var(--color-bg-page)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
        }}>
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
        </div>
      )}

      {loading && <Loading label={t('common:loading')} />}
      {!loading && programas.length === 0 && <EmptyState title={t('facilitador:programas.empty')} />}
      {!loading && programas.length > 0 && programasFiltrados.length === 0 && (
        <EmptyState title={t('facilitador:programas.sin_resultados')} />
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '1rem',
      }}>
        {programasFiltrados.map((p) => {
          const fechas = [p.fechaInicio, p.fechaFin]
            .filter(Boolean)
            .map((f) => formatFecha(f as string, i18n.language));
          const acciones = [
            { key: 'sesiones', icon: '📅', label: t('facilitador:sesiones.title'), to: `/facilitador/programas/${p.id}/sesiones` },
            { key: 'grupos', icon: '👥', label: t('facilitador:grupos.title'), to: `/facilitador/programas/${p.id}/grupos` },
            { key: 'observaciones', icon: '📝', label: t('facilitador:observaciones.title'), to: `/facilitador/programas/${p.id}/observaciones` },
            { key: 'resultados', icon: '📊', label: t('formularios:resultados.title'), to: `/facilitador/programas/${p.id}/resultados` },
          ];
          return (
            <div key={p.id} className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Encabezado: nombre + estado */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text-main)', lineHeight: 1.3 }}>
                  {p.nombre}
                </div>
                <StatusBadge variant={ESTADO_VARIANT[p.estado]}>
                  {t(`facilitador:programas.estado.${p.estado}`)}
                </StatusBadge>
              </div>

              {p.empresa && (
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                  🏢 {p.empresa.nombre}
                </div>
              )}

              {fechas.length > 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  🗓️ {fechas.join(' — ')}
                </div>
              )}

              {/* Acciones como botones */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {acciones.map((a) => (
                  <Link key={a.key} className="btn btn-secondary btn-sm" to={a.to}>
                    <span aria-hidden>{a.icon}</span> {a.label}
                  </Link>
                ))}
                <Link
                  className="btn btn-primary btn-sm"
                  to={`/facilitador/programas/${p.id}/reto`}
                  style={{ gridColumn: '1 / -1' }}
                >
                  🤖 {t('formularios:reto.title')}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
