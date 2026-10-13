import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '../../components/ui';

export interface RecursoEstado {
  iniciada: boolean;
  entregada: boolean;
  ultimaEdicionEn: string | null;
}

// Forma de un elemento de GET /grupos/mios.
export interface MiGrupo {
  id: string;
  nombre: string;
  orden: number;
  finalizado: boolean;
  programa: { id: string; nombre: string; estado: string };
  // HU-11: el email solo llega a miembros del mismo grupo; Usuario.email es nullable.
  miembros: { id: string; nombre: string; email: string | null }[];
  recursos: {
    bitacora: RecursoEstado & { habilitada: boolean };
    plantillaProyecto: RecursoEstado;
    presentacionFinal: { entregada: boolean; entregadoEn: string | null };
  };
}

// Los tres recursos del reto (bitácora / plantilla / presentación) con su estado y
// enlace. Compartido por SesionesPage (GrupoCard) y GrupoPage (HU-11).
export function GrupoRecursosEstado({ grupo: g, from }: { grupo: MiGrupo; from: string }) {
  const { t } = useTranslation(['formularios']);
  const fromQ = `?from=${encodeURIComponent(from)}`;

  const badge = (activo: boolean, textoActivo: string, textoInactivo: string) => (
    <StatusBadge variant={activo ? 'info' : 'neutral'}>{activo ? textoActivo : textoInactivo}</StatusBadge>
  );
  const recursoBadge = (rec: RecursoEstado) =>
    rec.entregada ? (
      <StatusBadge variant="success">{t('formularios:grupo.estado_entregado')}</StatusBadge>
    ) : (
      badge(rec.iniciada, t('formularios:grupo.estado_en_progreso'), t('formularios:grupo.estado_sin_iniciar'))
    );

  // O-01: el gate de la bitácora bloquea toda la sección del reto.
  const bloqueada = !g.recursos.bitacora.habilitada;

  return (
    <>
      {/* O-01: la habilitación de la bitácora es el gate de TODA la sección del
          reto. Sin habilitar, los tres recursos quedan bloqueados. */}
      {bloqueada && (
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
          🔒 {t('formularios:grupo.bitacora_bloqueada')}
        </div>
      )}

      {/* Recursos del reto en fila: aprovecha el ancho completo de la tarjeta. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        <RecursoTile icon="📓" titulo={t('formularios:tipos.bitacora')} bloqueada={bloqueada}>
          {recursoBadge(g.recursos.bitacora)}
          <Link className="btn" to={`/estudiante/grupos/${g.id}/bitacora${fromQ}`}>{t('formularios:grupo.abrir')}</Link>
        </RecursoTile>

        <RecursoTile icon="📐" titulo={t('formularios:tipos.plantilla_proyecto')} bloqueada={bloqueada}>
          {recursoBadge(g.recursos.plantillaProyecto)}
          <Link className="btn" to={`/estudiante/grupos/${g.id}/plantilla-proyecto${fromQ}`}>{t('formularios:grupo.abrir')}</Link>
        </RecursoTile>

        <RecursoTile icon="🎤" titulo={t('formularios:presentacion.title')} bloqueada={bloqueada}>
          {g.recursos.presentacionFinal.entregada ? (
            <StatusBadge variant="success">{t('formularios:presentacion.entregada')}</StatusBadge>
          ) : (
            badge(false, '', t('formularios:grupo.estado_sin_iniciar'))
          )}
          <Link className="btn" to={`/estudiante/grupos/${g.id}/presentacion${fromQ}`}>{t('formularios:grupo.abrir')}</Link>
        </RecursoTile>
      </div>
    </>
  );
}

// Recuadro de un recurso del reto para el layout horizontal: título arriba, estado +
// acción abajo. Cuando la sección está bloqueada (bitácora no habilitada) se atenúa y
// no permite interacción.
function RecursoTile({
  icon,
  titulo,
  bloqueada,
  children,
}: {
  icon: string;
  titulo: string;
  bloqueada?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      aria-disabled={bloqueada}
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        opacity: bloqueada ? 0.5 : 1,
        pointerEvents: bloqueada ? 'none' : 'auto',
      }}
    >
      <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{icon} {titulo}</span>
      <span style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>{children}</span>
    </div>
  );
}
