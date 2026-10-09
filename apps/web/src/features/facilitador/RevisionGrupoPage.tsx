import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Campo } from '../estudiante/FormularioResponderPage';
import { Alert, Breadcrumb, Button, EmptyState, Loading, PageHeader, StatusBadge } from '../../components/ui';
import { ConfirmModal } from '../../components/ConfirmModal';
import { toast } from '../../components/toast-store';
import { RespuestaReadOnly } from './RespuestaReadOnly';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Respuesta {
  datos: Record<string, unknown>;
  ultimaEdicionEn: string | null;
  ultimoEditor: { id: string; nombre: string } | null;
}

interface Recurso {
  plantilla: { id: string; nombre: string; campos: Campo[] } | null;
  respuesta: Respuesta | null;
}

interface Revision {
  grupo: {
    id: string;
    nombre: string;
    programaId: string;
    finalizadoEn: string | null;
    finalizadoPor: { id: string; nombre: string } | null;
    miembros: { id: string; nombre: string }[];
  };
  bitacora: Recurso;
  plantillaProyecto: Recurso;
  presentacion: {
    archivoNombre: string;
    entregadoEn: string;
    entregadoPor: { id: string; nombre: string } | null;
    url: string;
  } | null;
  faltante: { presentacion: boolean; bitacora: boolean; plantillaProyecto: boolean };
  puedeFinalizar: boolean;
}

// HU-23: el facilitador revisa en SOLO lectura lo que el grupo entregó en la fase 3 y, desde aquí,
// finaliza el grupo. "Finalizar" solo está activo si entregó todo (el servidor también lo exige).
export function FacilitadorRevisionGrupoPage() {
  const { id: programaId = '', grupoId = '' } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(['facilitador', 'formularios', 'common', 'admin', 'errors']);
  const [data, setData] = useState<Revision | null>(null);
  const [loading, setLoading] = useState(false);
  const [soloLectura, setSoloLectura] = useState(false);
  const [programaNombre, setProgramaNombre] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  const volver = `/facilitador/programas/${programaId}/grupos`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/facilitador/grupos/${grupoId}/revision?locale=${i18n.language}`)
      .then((res) => res.json())
      .then((d: Revision) => { if (!cancelled) setData(d); })
      .catch((err) => { if (!cancelled) toast.error(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [grupoId, i18n.language]);

  useEffect(() => {
    fetchWithErrorMapping(`${API_URL}/programas`)
      .then((res) => res.json())
      .then((programas: { id: string; nombre: string; soloLectura?: boolean }[]) => {
        const p = programas.find((x) => x.id === programaId);
        if (p) { setProgramaNombre(p.nombre); setSoloLectura(!!p.soloLectura); }
      })
      .catch(() => { /* no bloquea la vista */ });
  }, [programaId]);

  const finalizar = async () => {
    setFinalizando(true);
    try {
      await fetchWithErrorMapping(`${API_URL}/facilitador/grupos/${grupoId}/finalizar`, { method: 'POST' });
      toast.success(t('facilitador:grupos.finalizado_ok'));
      navigate(volver);
    } catch (err) {
      toast.error(translateError(err));
      setFinalizando(false);
    }
  };

  const g = data?.grupo;
  const faltan = data
    ? ([
        data.faltante.presentacion && t('facilitador:revision.presentacion'),
        data.faltante.bitacora && t('formularios:tipos.bitacora'),
        data.faltante.plantillaProyecto && t('formularios:tipos.plantilla_proyecto'),
      ].filter(Boolean) as string[])
    : [];

  return (
    <div>
      <ConfirmModal
        isOpen={confirmando}
        title={t('facilitador:grupos.finalizar')}
        message={t('facilitador:grupos.finalizar_confirm', { grupo: g?.nombre ?? '' })}
        confirmLabel={t('facilitador:grupos.finalizar')}
        danger={false}
        onConfirm={() => { setConfirmando(false); finalizar(); }}
        onCancel={() => setConfirmando(false)}
      />
      <Breadcrumb
        items={[
          { label: t('admin:sidebar.home'), to: '/inicio' },
          { label: t('facilitador:programas.title'), to: '/facilitador/programas' },
          { label: programaNombre || '—' },
          { label: t('facilitador:grupos.title'), to: volver },
          { label: g?.nombre ?? '—' },
        ]}
      />
      <PageHeader
        eyebrow={programaNombre || undefined}
        title={t('facilitador:revision.title', { grupo: g?.nombre ?? '' })}
        description={t('facilitador:revision.descripcion')}
      />
      {loading && <Loading label={t('common:loading')} />}

      {data && g && (
        <div className="home-stack">
          <div className="section-card home-panel">
            <div className="section-card-header">
              <span className="section-card-title">{t('facilitador:revision.resumen')}</span>
              {g.finalizadoEn && <StatusBadge variant="success">{t('facilitador:grupos.finalizado')}</StatusBadge>}
            </div>
            <div className="section-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                {t('formularios:grupo.miembros')}: {g.miembros.map((m) => m.nombre).join(', ') || '—'}
              </div>
              <ul className="grupos-resumen-leyenda">
                {([
                  ['presentacion', 'facilitador:revision.presentacion'],
                  ['bitacora', 'formularios:tipos.bitacora'],
                  ['plantillaProyecto', 'formularios:tipos.plantilla_proyecto'],
                ] as const).map(([k, label]) => (
                  <li key={k} className="grupos-resumen-fila">
                    <span
                      className={`grupos-resumen-punto ${data.faltante[k] ? 'grupos-resumen-seg--en-curso' : 'grupos-resumen-seg--finalizado'}`}
                      aria-hidden="true"
                    />
                    <span className="grupos-resumen-etiqueta">{t(label)}</span>
                    <span className="grupos-resumen-n">
                      {data.faltante[k] ? t('facilitador:revision.pendiente') : t('facilitador:revision.entregado')}
                    </span>
                  </li>
                ))}
              </ul>
              {g.finalizadoEn && g.finalizadoPor && (
                <Alert variant="info">{t('facilitador:grupos.finalizado_por', { nombre: g.finalizadoPor.nombre })}</Alert>
              )}
            </div>
          </div>

          <SeccionRecurso titulo={t('formularios:tipos.bitacora')} recurso={data.bitacora} t={t} />
          <SeccionRecurso titulo={t('formularios:tipos.plantilla_proyecto')} recurso={data.plantillaProyecto} t={t} />

          <div className="section-card home-panel">
            <div className="section-card-header">
              <span className="section-card-title">{t('facilitador:revision.presentacion')}</span>
            </div>
            <div className="section-card-body">
              {!data.presentacion ? (
                <EmptyState title={t('facilitador:revision.sin_presentacion')} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <div style={{ fontWeight: 600 }}>{data.presentacion.archivoNombre}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    {t('facilitador:revision.entregado_por', {
                      nombre: data.presentacion.entregadoPor?.nombre ?? '—',
                      fecha: new Date(data.presentacion.entregadoEn).toLocaleString(),
                    })}
                  </div>
                  <div>
                    <a className="btn btn-secondary btn-sm" href={data.presentacion.url} target="_blank" rel="noopener noreferrer">
                      {t('facilitador:revision.abrir_presentacion')}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Acción final: finalizar solo si entregó todo en la fase 3. */}
          {!g.finalizadoEn && (
            <div className="section-card">
              <div className="section-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {!data.puedeFinalizar && (
                  <Alert variant="warning">
                    {t('facilitador:revision.no_finalizable', { faltan: faltan.join(', ') })}
                  </Alert>
                )}
                {soloLectura && <Alert variant="warning">{t('errors:PROGRAMA_GRACIA_VENCIDA')}</Alert>}
                <div className="form-footer">
                  <Link className="btn btn-secondary" to={volver}>{t('facilitador:revision.volver')}</Link>
                  <Button
                    variant="primary"
                    disabled={!data.puedeFinalizar || soloLectura || finalizando}
                    onClick={() => setConfirmando(true)}
                  >
                    {t('facilitador:grupos.finalizar')}
                  </Button>
                </div>
              </div>
            </div>
          )}
          {g.finalizadoEn && (
            <div>
              <Link className="btn btn-secondary" to={volver}>{t('facilitador:revision.volver')}</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SeccionRecurso({ titulo, recurso, t }: { titulo: string; recurso: Recurso; t: (k: string, o?: Record<string, unknown>) => string }) {
  return (
    <div className="section-card home-panel">
      <div className="section-card-header">
        <span className="section-card-title">{titulo}</span>
      </div>
      <div className="section-card-body">
        {!recurso.plantilla ? (
          <EmptyState title={t('formularios:reto.sin_plantilla')} />
        ) : !recurso.respuesta ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)', margin: 0 }}>{t('facilitador:revision.sin_contenido')}</p>
        ) : (
          <>
            {recurso.respuesta.ultimoEditor && recurso.respuesta.ultimaEdicionEn && (
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                {t('formularios:grupo.ultima_edicion', {
                  nombre: recurso.respuesta.ultimoEditor.nombre,
                  fecha: new Date(recurso.respuesta.ultimaEdicionEn).toLocaleString(),
                })}
              </div>
            )}
            <RespuestaReadOnly campos={recurso.plantilla.campos} datos={recurso.respuesta.datos} />
          </>
        )}
      </div>
    </div>
  );
}
