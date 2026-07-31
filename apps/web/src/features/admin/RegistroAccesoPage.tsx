import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Breadcrumb, PageHeader, Field, Loading, EmptyState, DataTable, Pagination } from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
import { toast } from '../../components/toast-store';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const PAGE_SIZE = 50;

interface Fila {
  id: string;
  usuarioId: string;
  usuario: { id: string; nombre: string; email: string | null } | null;
  role: string;
  accion: string;
  tipoRecurso: string;
  recursoId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  creadoEn: string;
}

const ROLES = ['facilitador', 'estudiante', 'cliente_admin', 'usuario_cliente', 'danalytics_admin'];

// Formatea un Date a string apto para <input type="datetime-local"> en hora local.
function toLocalInput(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

// Por defecto el visor arranca acotado a las últimas 24 horas para no cargar
// todo el log append-only de golpe.
const DEFAULT_DESDE = () => toLocalInput(new Date(Date.now() - 24 * 60 * 60 * 1000));

// RNF-13: visor SOLO lectura del log de auditoría append-only (solo admin).
export function RegistroAccesoPage() {
  const { t } = useTranslation(['admin', 'common']);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [rol, setRol] = useState('');
  const [tipoRecurso, setTipoRecurso] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [desde, setDesde] = useState<string>(DEFAULT_DESDE);
  const [hasta, setHasta] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ take: String(PAGE_SIZE), skip: String(pagina * PAGE_SIZE) });
    if (rol) params.set('role', rol);
    if (tipoRecurso.trim()) params.set('tipoRecurso', tipoRecurso.trim());
    if (usuarioId.trim()) params.set('usuarioId', usuarioId.trim());
    if (desde) params.set('desde', new Date(desde).toISOString());
    if (hasta) params.set('hasta', new Date(hasta).toISOString());
    fetchWithErrorMapping(`${API_URL}/admin/registro-acceso?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        setFilas(data.filas ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(err => { if (!cancelled) toast.error(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pagina, rol, tipoRecurso, usuarioId, desde, hasta]);

  const totalPaginas = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  const columns: DataTableColumn<Fila>[] = [
    {
      key: 'fecha',
      header: t('admin:registro_acceso.fecha'),
      render: f => <span style={{ whiteSpace: 'nowrap' }}>{new Date(f.creadoEn).toLocaleString()}</span>,
    },
    {
      key: 'usuario',
      header: t('admin:registro_acceso.usuario'),
      render: f => (
        <span title={f.usuarioId}>
          {f.usuario?.nombre ?? f.usuarioId}
          {f.usuario?.email && <span style={{ color: 'var(--color-text-secondary)' }}> · {f.usuario.email}</span>}
        </span>
      ),
    },
    { key: 'rol', header: t('admin:registro_acceso.rol'), render: f => f.role },
    { key: 'accion', header: t('admin:registro_acceso.accion'), render: f => f.accion },
    { key: 'tipoRecurso', header: t('admin:registro_acceso.tipo_recurso'), render: f => f.tipoRecurso },
    {
      key: 'recurso',
      header: t('admin:registro_acceso.recurso'),
      render: f => <span style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{f.recursoId ?? '—'}</span>,
    },
    {
      key: 'ip',
      header: 'IP',
      render: f => <span style={{ whiteSpace: 'nowrap' }}>{f.ipAddress ?? '—'}</span>,
    },
  ];

  return (
    <>
      <Breadcrumb
        items={[
          { label: t('admin:sidebar.home'), to: '/admin/inicio' },
          { label: t('admin:sidebar.registro_acceso') },
        ]}
      />
      <PageHeader
        eyebrow={t('admin:sidebar.auditoria_label')}
        title={t('admin:registro_acceso.title')}
        description={t('admin:registro_acceso.subtitle')}
      />

      <div className="toolbar">
        <Field label={t('admin:registro_acceso.rol')}>
          <select className="input" value={rol} onChange={e => { setRol(e.target.value); setPagina(0); }}>
            <option value="">{t('admin:registro_acceso.todos')}</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label={t('admin:registro_acceso.tipo_recurso')}>
          <input className="input" value={tipoRecurso} onChange={e => { setTipoRecurso(e.target.value); setPagina(0); }} placeholder="programa, sesion, …" />
        </Field>
        <Field label={t('admin:registro_acceso.usuario_id')}>
          <input className="input" value={usuarioId} onChange={e => { setUsuarioId(e.target.value); setPagina(0); }} style={{ minWidth: 280 }} />
        </Field>
        <Field label={t('admin:registro_acceso.desde')}>
          <input type="datetime-local" className="input" value={desde} onChange={e => { setDesde(e.target.value); setPagina(0); }} />
        </Field>
        <Field label={t('admin:registro_acceso.hasta')}>
          <input type="datetime-local" className="input" value={hasta} onChange={e => { setHasta(e.target.value); setPagina(0); }} />
        </Field>
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', margin: 'var(--space-1) 0 var(--space-4)' }}>
        {t('admin:registro_acceso.rango_hint')}
      </p>

      {loading && <Loading label={t('common:loading')} />}
      {!loading && filas.length === 0 && (
        <EmptyState title={t('admin:registro_acceso.empty')} />
      )}
      {!loading && filas.length > 0 && (
        <>
          <DataTable columns={columns} rows={filas} rowKey={f => f.id} />
          <Pagination
            page={pagina + 1}
            pageCount={totalPaginas}
            onPageChange={p => setPagina(p - 1)}
            info={`${total} ${t('admin:registro_acceso.registros')}`}
            prevLabel={t('common:previous')}
            nextLabel={t('common:next')}
          />
        </>
      )}
    </>
  );
}
