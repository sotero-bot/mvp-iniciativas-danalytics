import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { PageHeader, Field, Loading, EmptyState } from '../../components/ui';
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

  return (
    <div style={{ padding: '2rem' }}>
      <PageHeader
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
      <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', margin: '0 0 1rem' }}>
        {t('admin:registro_acceso.rango_hint')}
      </p>

      {loading && <Loading label={t('common:loading')} />}
      {!loading && filas.length === 0 && (
        <EmptyState title={t('admin:registro_acceso.empty')} />
      )}
      {filas.length > 0 && (
        <>
          <div className="table-container">
            <table style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th>{t('admin:registro_acceso.fecha')}</th>
                  <th>{t('admin:registro_acceso.usuario')}</th>
                  <th>{t('admin:registro_acceso.rol')}</th>
                  <th>{t('admin:registro_acceso.accion')}</th>
                  <th>{t('admin:registro_acceso.tipo_recurso')}</th>
                  <th>{t('admin:registro_acceso.recurso')}</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(f => (
                  <tr key={f.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(f.creadoEn).toLocaleString()}</td>
                    <td title={f.usuarioId}>
                      {f.usuario?.nombre ?? f.usuarioId}
                      {f.usuario?.email && <span style={{ color: 'var(--color-text-secondary)' }}> · {f.usuario.email}</span>}
                    </td>
                    <td>{f.role}</td>
                    <td>{f.accion}</td>
                    <td>{f.tipoRecurso}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{f.recursoId ?? '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{f.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: '0.82rem' }}>
            <button type="button" className="btn" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>←</button>
            <span>{pagina + 1} / {totalPaginas} · {total} {t('admin:registro_acceso.registros')}</span>
            <button type="button" className="btn" disabled={pagina + 1 >= totalPaginas} onClick={() => setPagina(p => p + 1)}>→</button>
          </div>
        </>
      )}
    </div>
  );
}
