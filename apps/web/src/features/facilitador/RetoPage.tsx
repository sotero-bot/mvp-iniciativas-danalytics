import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Campo } from '../estudiante/FormularioResponderPage';
import { Breadcrumb, PageHeader, Button, Loading, EmptyState, Alert, StatusBadge, ProgressBar, DataTable } from '../../components/ui';
import { toast } from '../../components/toast-store';
import type { DataTableColumn } from '../../components/ui';
import { RespuestaReadOnly } from './RespuestaReadOnly';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface GrupoConRespuesta {
  id: string;
  nombre: string;
  orden: number;
  miembros: { id: string; nombre: string }[];
  respuesta: {
    datos: Record<string, unknown>;
    ultimaEdicionEn: string | null;
    ultimoEditor: { id: string; nombre: string } | null;
  } | null;
}

interface RecursoPrograma {
  plantilla: {
    id: string;
    tipoFormulario: string;
    nombre: string;
    descripcion: string | null;
    campos: Campo[];
  } | null;
  grupos: GrupoConRespuesta[];
}

type Pestana = 'bitacoras' | 'plantillas' | 'presentaciones';
type PestanaRecurso = Exclude<Pestana, 'presentaciones'>;

// HU-03: presentaciones finales por grupo. El facilitador ve el enlace y si hay archivo
// (`conArchivo`); la key de S3 nunca viaja.
interface PresentacionGrupo {
  id: string;
  nombre: string;
  miembros: number;
  entregada: boolean;
  entregadoEn: string | null;
  urlPresentacion: string | null;
  conArchivo: boolean;
}
interface Presentaciones { totalGrupos: number; entregados: number; grupos: PresentacionGrupo[] }

// Fase 3 (RF-37/RF-38): el facilitador ve bitácoras y plantillas de proyecto de
// TODOS los grupos de su programa en SOLO lectura (sin edición ni export, RN-07).
export function FacilitadorRetoPage() {
  const { id: programaId = '' } = useParams();
  const { t, i18n } = useTranslation(['formularios', 'facilitador', 'common', 'admin', 'errors']);
  const [pestana, setPestana] = useState<Pestana>('bitacoras');
  const [data, setData] = useState<Record<PestanaRecurso, RecursoPrograma | null>>({ bitacoras: null, plantillas: null });
  const [loading, setLoading] = useState(false);
  const [presentaciones, setPresentaciones] = useState<Presentaciones | null>(null);
  // O-01: estado de habilitación de la bitácora.
  const [bitacoraHabilitada, setBitacoraHabilitada] = useState<boolean | null>(null);
  // Nombre del programa para el breadcrumb/eyebrow (dónde está el usuario).
  const [programaNombre, setProgramaNombre] = useState('');
  // RF-03/RN-03: gracia vencida → el facilitador solo consulta, sin acciones de escritura.
  const [soloLectura, setSoloLectura] = useState(false);

  const cargarEstadoBitacora = () => {
    fetchWithErrorMapping(`${API_URL}/facilitador/programas/${programaId}/bitacora/estado`)
      .then((res) => res.json())
      .then((d) => setBitacoraHabilitada(!!d.habilitada))
      .catch(() => { /* no bloquea la vista */ });
  };

  useEffect(() => { cargarEstadoBitacora(); }, [programaId]);

  useEffect(() => {
    fetchWithErrorMapping(`${API_URL}/programas`)
      .then((res) => res.json())
      .then((programas: { id: string; nombre: string; soloLectura?: boolean }[]) => {
        const p = programas.find((x) => x.id === programaId);
        if (p) {
          setProgramaNombre(p.nombre);
          setSoloLectura(!!p.soloLectura);
        }
      })
      .catch(() => { /* no bloquea la vista */ });
  }, [programaId]);

  const toggleBitacora = async () => {
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/facilitador/programas/${programaId}/bitacora/habilitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habilitar: !bitacoraHabilitada }),
      });
      const d = await res.json();
      setBitacoraHabilitada(!!d.bitacoraHabilitadaEn);
      toast.success(t('formularios:reto.bitacora_actualizada'));
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  useEffect(() => {
    if (pestana !== 'presentaciones') return;
    let cancelled = false;
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/facilitador/programas/${programaId}/presentaciones`)
      .then((res) => res.json())
      .then((d: Presentaciones) => { if (!cancelled) setPresentaciones(d); })
      .catch((err) => { if (!cancelled) toast.error(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [programaId, pestana]);

  useEffect(() => {
    if (pestana === 'presentaciones') return;
    let cancelled = false;
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/facilitador/programas/${programaId}/${pestana}?locale=${i18n.language}`)
      .then((res) => res.json())
      .then((recurso: RecursoPrograma) => {
        if (!cancelled) setData(prev => ({ ...prev, [pestana]: recurso }));
      })
      .catch((err) => { if (!cancelled) toast.error(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [programaId, pestana, i18n.language]);

  const recurso = pestana === 'presentaciones' ? null : data[pestana];
  const tabStyle = (activa: boolean): React.CSSProperties => ({
    padding: 'var(--space-2) var(--space-4)', border: 'none',
    borderBottom: activa ? '2px solid var(--color-primary)' : '2px solid transparent',
    background: 'none', cursor: 'pointer', fontWeight: activa ? 600 : 500,
    color: activa ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontSize: '0.9rem',
  });

  const presentacionColumns: DataTableColumn<PresentacionGrupo>[] = [
    { key: 'grupo', header: t('facilitador:reto.presentaciones_col_grupo'), align: 'left', render: (g) => g.nombre },
    { key: 'integrantes', header: t('facilitador:reto.presentaciones_col_integrantes'), align: 'left', render: (g) => g.miembros },
    {
      key: 'estado',
      header: t('facilitador:reto.presentaciones_col_estado'),
      align: 'left',
      render: (g) => (
        <StatusBadge variant={g.entregada ? 'success' : 'warning'}>
          {g.entregada ? t('facilitador:reto.presentacion_entregada') : t('facilitador:reto.presentacion_pendiente')}
        </StatusBadge>
      ),
    },
    {
      key: 'entrega',
      header: t('facilitador:reto.presentaciones_col_entrega'),
      align: 'left',
      render: (g) => (
        <span style={{ display: 'inline-flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          {g.urlPresentacion && (
            <a href={g.urlPresentacion} target="_blank" rel="noreferrer">{t('facilitador:reto.presentacion_enlace')}</a>
          )}
          {g.conArchivo && <span>{t('facilitador:reto.presentacion_archivo')}</span>}
          {!g.urlPresentacion && !g.conArchivo && '—'}
        </span>
      ),
    },
    {
      key: 'fecha',
      header: t('facilitador:reto.presentaciones_col_fecha'),
      align: 'left',
      render: (g) => (g.entregadoEn ? new Date(g.entregadoEn).toLocaleString(i18n.language) : '—'),
    },
  ];

  return (
    <div>
      <Breadcrumb
        items={[
          { label: t('admin:sidebar.home'), to: '/inicio' },
          { label: t('facilitador:programas.title'), to: '/facilitador/programas' },
          { label: programaNombre || '—' },
          { label: t('formularios:reto.title') },
        ]}
      />
      <PageHeader
        eyebrow={programaNombre || undefined}
        title={t('formularios:reto.title')}
        description={t('formularios:reto.solo_lectura')}
      />
      {soloLectura && <Alert variant="warning">{t('errors:PROGRAMA_GRACIA_VENCIDA')}</Alert>}

      <div className="section-card home-panel">
        <div className="section-card-header">
          <span className="section-card-title">{t('formularios:reto.panel_title')}</span>
          <span className="count-badge">
            {pestana === 'presentaciones' ? presentaciones?.entregados ?? 0 : recurso?.grupos.length ?? 0}
          </span>
        </div>

        <div
          className="home-filter-strip"
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 'var(--space-3)', paddingTop: 'var(--space-3)', paddingBottom: 'var(--space-3)',
          }}
        >
          <div>
            <button style={tabStyle(pestana === 'bitacoras')} onClick={() => setPestana('bitacoras')}>
              {t('formularios:reto.bitacoras')}
            </button>
            <button style={tabStyle(pestana === 'plantillas')} onClick={() => setPestana('plantillas')}>
              {t('formularios:reto.plantillas')}
            </button>
            <button style={tabStyle(pestana === 'presentaciones')} onClick={() => setPestana('presentaciones')}>
              {t('facilitador:reto.presentaciones_tab')}
            </button>
          </div>

          {/* O-01: habilitación de la bitácora para los grupos (admin o facilitador). */}
          {pestana === 'bitacoras' && bitacoraHabilitada !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <StatusBadge variant={bitacoraHabilitada ? 'success' : 'neutral'}>
                {bitacoraHabilitada ? t('formularios:reto.bitacora_habilitada') : t('formularios:reto.bitacora_no_habilitada')}
              </StatusBadge>
              {!soloLectura && (
                <Button variant="primary" size="sm" onClick={toggleBitacora}>
                  {bitacoraHabilitada ? t('formularios:reto.bitacora_deshabilitar') : t('formularios:reto.bitacora_habilitar')}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="section-card-body">
          {loading && <Loading label={t('common:loading')} />}

          {!loading && pestana === 'presentaciones' && presentaciones && (
            presentaciones.totalGrupos === 0 ? (
              <EmptyState title={t('facilitador:reto.presentaciones_empty')} />
            ) : (
              <>
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <div style={{ fontSize: '0.85rem', marginBottom: 'var(--space-2)' }}>
                    {t('facilitador:reto.presentaciones_contador', {
                      entregados: presentaciones.entregados,
                      total: presentaciones.totalGrupos,
                    })}
                  </div>
                  <ProgressBar
                    value={(presentaciones.entregados / presentaciones.totalGrupos) * 100}
                    label={t('facilitador:reto.presentaciones_title')}
                  />
                </div>
                <DataTable columns={presentacionColumns} rows={presentaciones.grupos} rowKey={(g) => g.id} />
              </>
            )
          )}

          {!loading && recurso && !recurso.plantilla && <EmptyState title={t('formularios:reto.sin_plantilla')} />}

          {!loading && recurso?.plantilla && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {recurso.grupos.map(g => (
                <div key={g.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <div style={{ fontWeight: 600 }}>{g.nombre}</div>
                    {g.respuesta?.ultimoEditor && g.respuesta.ultimaEdicionEn && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                        {t('formularios:grupo.ultima_edicion', {
                          nombre: g.respuesta.ultimoEditor.nombre,
                          fecha: new Date(g.respuesta.ultimaEdicionEn).toLocaleString(),
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                    {t('formularios:grupo.miembros')}: {g.miembros.map(m => m.nombre).join(', ') || '—'}
                  </div>

                  {!g.respuesta ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)', margin: 0 }}>
                      {t('formularios:reto.sin_respuesta')}
                    </p>
                  ) : (
                    <RespuestaReadOnly campos={recurso.plantilla!.campos} datos={g.respuesta.datos} />
                  )}
                </div>
              ))}
              {recurso.grupos.length === 0 && <EmptyState title={t('formularios:reto.sin_grupos')} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
