import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

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
export const ROLE_CARDS: Record<string, CardDef[]> = {
  danalytics_admin: [
    { key: 'adm_empresas', icon: '🏢', color: '#3B82F6', to: '/admin/empresas' },
    { key: 'adm_programas', icon: '🎓', color: '#38BDF8', to: '/admin/programas' },
    { key: 'adm_usuarios', icon: '👥', color: '#22C55E', to: '/admin/usuarios' },
    { key: 'adm_actividades', icon: '🧩', color: '#F59E0B', to: '/admin/actividades' },
  ],
  facilitador: [
    { key: 'fac_programas', icon: '🎓', color: '#38BDF8' },
    { key: 'fac_asistencia', icon: '✅', color: '#22C55E' },
    { key: 'fac_observaciones', icon: '📝', color: '#F59E0B' },
    { key: 'fac_bitacoras', icon: '📓', color: '#A78BFA' },
  ],
  estudiante: [
    { key: 'est_programas', icon: '🎓', color: '#38BDF8' },
    { key: 'est_sesiones', icon: '📚', color: '#3B82F6' },
    { key: 'est_formularios', icon: '🧾', color: '#F59E0B' },
    { key: 'est_grupo', icon: '🤝', color: '#A78BFA' },
  ],
  cliente_admin: [
    { key: 'cli_programas', icon: '🎓', color: '#38BDF8' },
    { key: 'cli_resultados', icon: '📈', color: '#22C55E' },
    { key: 'cli_usuarios', icon: '👥', color: '#F59E0B' },
  ],
  usuario_cliente: [
    { key: 'cli_programas', icon: '🎓', color: '#38BDF8' },
    { key: 'cli_resultados', icon: '📈', color: '#22C55E' },
  ],
};

// Se renderiza DENTRO del Layout (área de contenido, tema claro).
export function HomePage({ user }: { user: HomeUser | null }) {
  const { t } = useTranslation('common', { keyPrefix: 'home' });
  const slug = user?.role?.slug ?? '';
  const cards = ROLE_CARDS[slug] ?? [];
  const displayName = user?.nombre || user?.username || user?.email || '';

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '1.6rem', margin: '0 0 0.4rem', color: 'var(--color-text-main)' }}>
        {displayName ? t('greeting', { name: displayName }) : t('greeting_no_name')}
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 1.75rem' }}>{t('subtitle')}</p>

      <div style={{
        display: 'grid', gap: '1rem',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      }}>
        {cards.map(card => {
          const inner = (
            <>
              <div style={{
                width: 40, height: 40, borderRadius: 10, marginBottom: 12,
                background: `${card.color}1f`, border: `1px solid ${card.color}55`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.15rem',
              }}>{card.icon}</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4, color: 'var(--color-text-main)' }}>
                {t(`cards.${card.key}.title`)}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                {t(`cards.${card.key}.desc`)}
              </div>
              {!card.to && (
                <span style={{
                  display: 'inline-block', marginTop: 12, fontSize: '0.7rem', fontWeight: 600,
                  color: 'var(--color-text-secondary)', background: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border)', borderRadius: 999, padding: '2px 10px',
                }}>{t('coming_soon')}</span>
              )}
            </>
          );

          const base: React.CSSProperties = { display: 'block', padding: '1.1rem', textDecoration: 'none' };

          return card.to ? (
            <Link key={card.key} to={card.to} className="card" style={base}>{inner}</Link>
          ) : (
            <div key={card.key} className="card" style={{ ...base, opacity: 0.7, cursor: 'default' }}>{inner}</div>
          );
        })}
      </div>

      {cards.length === 0 && (
        <p style={{ color: 'var(--color-text-tertiary)' }}>{t('no_sections')}</p>
      )}
    </div>
  );
}
