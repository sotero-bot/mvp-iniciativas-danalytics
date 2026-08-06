import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Breadcrumb, PageHeader, EmptyState } from '../../components/ui';
import { EstudianteHome } from './EstudianteHome';
import { FacilitadorProgramasPage } from '../facilitador/ProgramasPage';

export interface HomeUser {
  nombre: string;
  email: string | null;
  username: string | null;
  empresa: { id: string; nombre: string } | null;
  role: { slug: string; nombre: string } | null;
}

export interface CardDef {
  key: string;
  icon: string;
  color: string;
  to?: string; // si existe → navegable; si no → "Próximamente"
}

// Secciones por rol (tarjetas del inicio + ítems del sidebar). Las rutas de los
// roles no-admin aún no existen (Fase 1+): van sin `to` y se muestran como
// "Próximamente".
// Nota: `color` se comparte con el sidebar de App.tsx (icono de cada ítem), por
// eso se mantiene como hex literal — un cambio aquí afecta ambos lugares.
export const ROLE_CARDS: Record<string, CardDef[]> = {
  danalytics_admin: [
    { key: 'adm_empresas', icon: '🏢', color: '#3B82F6', to: '/admin/empresas' },
    { key: 'adm_programas', icon: '🎓', color: '#38BDF8', to: '/admin/programas' },
    { key: 'adm_usuarios', icon: '👥', color: '#22C55E', to: '/admin/usuarios' },
    { key: 'adm_actividades', icon: '🧩', color: '#F59E0B', to: '/admin/actividades' },
  ],
  // El estudiante entra siempre por "Mis programas": la vista de cada programa
  // engloba sesiones, grupo/reto y formularios (incl. la encuesta de inicio). Por
  // eso no hay ítems sueltos de formularios ni de grupo en el sidebar/inicio.
  estudiante: [
    { key: 'est_programas', icon: '🎓', color: '#38BDF8', to: '/estudiante/programas' },
  ],
  // Los resultados (avance, asistencia, diagnóstico, feedback) se ven dentro
  // del detalle de cada programa (RF-43), no como pantalla propia — por eso no
  // hay un ítem "Resultados" separado (duplicaría la ruta de "Programas" y
  // confundiría el estado activo del sidebar, igual que en facilitador/estudiante).
  cliente_admin: [
    { key: 'cli_programas', icon: '🎓', color: '#38BDF8', to: '/portal/programas' },
    { key: 'cli_usuarios', icon: '👥', color: '#F59E0B', to: '/portal/usuarios' },
  ],
  usuario_cliente: [
    { key: 'cli_programas', icon: '🎓', color: '#38BDF8', to: '/portal/programas' },
  ],
};

// Se renderiza DENTRO del Layout (área de contenido, tema claro).
export function HomePage({ user }: { user: HomeUser | null }) {
  const { t } = useTranslation('common', { keyPrefix: 'home' });
  const { t: tc } = useTranslation(['common', 'admin']);
  const slug = user?.role?.slug ?? '';
  const cards = ROLE_CARDS[slug] ?? [];
  const displayName = user?.nombre || user?.username || user?.email || '';
  const roleLabel = slug ? tc(`roles.${slug}`) : undefined;

  // El facilitador entra siempre a trabajar con sus programas: en vez de un
  // saludo genérico + tarjeta "Mis programas", Inicio ES directamente ese
  // listado (misma vista que /facilitador/programas, con su propio breadcrumb).
  if (slug === 'facilitador') {
    return <FacilitadorProgramasPage />;
  }

  return (
    <div>
      <Breadcrumb items={[{ label: tc('admin:sidebar.home') }]} />

      <PageHeader
        eyebrow={roleLabel}
        title={displayName ? t('greeting', { name: displayName }) : t('greeting_no_name')}
        description={t('subtitle')}
      />

      {/* El estudiante ve un dashboard con su próxima sesión, pendientes y progreso
          por programa; el resto de roles conservan las tarjetas de navegación. */}
      {slug === 'estudiante' ? <EstudianteHome /> : (
      <div className="section-card">
        <div className="section-card-header">
          <span className="section-card-title">{t('sections_title')}</span>
          <span className="count-badge">{cards.length}</span>
        </div>
        <div className="section-card-body">
          {cards.length === 0 ? (
            <EmptyState title={t('no_sections')} />
          ) : (
            <div className="card-grid">
              {cards.map(card => {
                const inner = (
                  <>
                    <div style={{
                      width: 40, height: 40, borderRadius: 0, marginBottom: 'var(--space-3)',
                      background: `${card.color}1f`, border: `1px solid ${card.color}55`,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.15rem',
                    }}>{card.icon}</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-1)', color: 'var(--color-text-main)' }}>
                      {t(`cards.${card.key}.title`)}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                      {t(`cards.${card.key}.desc`)}
                    </div>
                    {!card.to && (
                      <span className="chip" style={{ marginTop: 'var(--space-3)' }}>{t('coming_soon')}</span>
                    )}
                  </>
                );

                const base: React.CSSProperties = { display: 'block', padding: 'var(--space-5)', textDecoration: 'none' };

                return card.to ? (
                  <Link key={card.key} to={card.to} className="card" style={base}>{inner}</Link>
                ) : (
                  <div key={card.key} className="card" style={{ ...base, opacity: 0.7, cursor: 'default' }}>{inner}</div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
