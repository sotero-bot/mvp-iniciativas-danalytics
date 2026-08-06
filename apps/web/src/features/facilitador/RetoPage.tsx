import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Campo } from '../estudiante/FormularioResponderPage';
import { Breadcrumb, PageHeader, Button, Loading, EmptyState } from '../../components/ui';
import { toast } from '../../components/toast-store';

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

type Pestana = 'bitacoras' | 'plantillas';

// Fase 3 (RF-37/RF-38): el facilitador ve bitácoras y plantillas de proyecto de
// TODOS los grupos de su programa en SOLO lectura (sin edición ni export, RN-07).
export function FacilitadorRetoPage() {
  const { id: programaId = '' } = useParams();
  const { t, i18n } = useTranslation(['formularios', 'facilitador', 'common', 'admin']);
  const [pestana, setPestana] = useState<Pestana>('bitacoras');
  const [data, setData] = useState<Record<Pestana, RecursoPrograma | null>>({ bitacoras: null, plantillas: null });
  const [loading, setLoading] = useState(false);
  // O-01: estado de habilitación de la bitácora.
  const [bitacoraHabilitada, setBitacoraHabilitada] = useState<boolean | null>(null);
  // Nombre del programa para el breadcrumb/eyebrow (dónde está el usuario).
  const [programaNombre, setProgramaNombre] = useState('');

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
      .then((programas: { id: string; nombre: string }[]) => {
        const p = programas.find((x) => x.id === programaId);
        if (p) setProgramaNombre(p.nombre);
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

  const recurso = data[pestana];
  const tabStyle = (activa: boolean): React.CSSProperties => ({
    padding: 'var(--space-2) var(--space-4)', border: 'none',
    borderBottom: activa ? '2px solid var(--color-primary)' : '2px solid transparent',
    background: 'none', cursor: 'pointer', fontWeight: activa ? 600 : 500,
    color: activa ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontSize: '0.9rem',
  });

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

      <div style={{ marginBottom: 'var(--space-5)' }}>
        <button style={tabStyle(pestana === 'bitacoras')} onClick={() => setPestana('bitacoras')}>
          📓 {t('formularios:reto.bitacoras')}
        </button>
        <button style={tabStyle(pestana === 'plantillas')} onClick={() => setPestana('plantillas')}>
          📐 {t('formularios:reto.plantillas')}
        </button>
      </div>

      {/* O-01: habilitación de la bitácora para los grupos (admin o facilitador). */}
      {pestana === 'bitacoras' && bitacoraHabilitada !== null && (
        <div className="card" style={{ padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.85rem' }}>
            {bitacoraHabilitada ? '🟢 ' : '🔒 '}
            {bitacoraHabilitada ? t('formularios:reto.bitacora_habilitada') : t('formularios:reto.bitacora_no_habilitada')}
          </div>
          <Button variant="primary" size="sm" onClick={toggleBitacora}>
            {bitacoraHabilitada ? t('formularios:reto.bitacora_deshabilitar') : t('formularios:reto.bitacora_habilitar')}
          </Button>
        </div>
      )}

      {loading && <Loading label={t('common:loading')} />}

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
  );
}

// ─────────────────────────────────────────────────────────────
// Render de solo lectura de una respuesta contra sus campos.
// ─────────────────────────────────────────────────────────────

function RespuestaReadOnly({ campos, datos }: { campos: Campo[]; datos: Record<string, unknown> }) {
  const topLevel = campos.filter(c => !c.campoPadreId);
  const hijosDe = (id: string) => campos.filter(c => c.campoPadreId === id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {topLevel.map(campo => (
        <div key={campo.id}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>{campo.etiqueta}</div>
          <ValorReadOnly campo={campo} hijos={hijosDe(campo.id)} valor={datos[campo.id]} />
        </div>
      ))}
    </div>
  );
}

function ValorReadOnly({ campo, hijos, valor }: { campo: Campo; hijos: Campo[]; valor: unknown }) {
  const vacio = <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.85rem' }}>—</span>;
  if (valor === undefined || valor === null || valor === '') return vacio;
  const config = campo.configPublica ?? {};

  switch (campo.tipoCampo) {
    case 'opcion_multiple': {
      const etiquetaDe = (v: unknown) =>
        (config.opciones ?? []).find(op => op.valor === v)?.etiqueta ?? String(v);
      const valores = Array.isArray(valor) ? valor : [valor];
      if (valores.length === 0) return vacio;
      return <div style={{ fontSize: '0.85rem' }}>{valores.map(etiquetaDe).join(', ')}</div>;
    }

    case 'tabla': {
      const columnas = config.columnas ?? [];
      const filas = Array.isArray(valor) ? (valor as Record<string, string>[]) : [];
      if (filas.length === 0) return vacio;
      return (
        <div style={{ overflowX: 'auto' }}>
          <table className="gform-table">
            <thead>
              <tr>{columnas.map(col => <th key={col}>{col}</th>)}</tr>
            </thead>
            <tbody>
              {filas.map((fila, i) => (
                <tr key={i}>
                  {columnas.map(col => <td key={col} style={{ fontSize: '0.85rem' }}>{fila[col] ?? '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'grupo_repetible': {
      const iteraciones = Array.isArray(valor) ? (valor as Record<string, unknown>[]) : [];
      if (iteraciones.length === 0) return vacio;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {iteraciones.map((iteracion, i) => (
            <div key={i} className="gform-iteracion">
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                #{i + 1}
              </div>
              {hijos.map(hijo => (
                <div key={hijo.id} style={{ marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{hijo.etiqueta}: </span>
                  <ValorReadOnly campo={hijo} hijos={[]} valor={iteracion[hijo.id]} />
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }

    default:
      return <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{String(valor)}</div>;
  }
}
