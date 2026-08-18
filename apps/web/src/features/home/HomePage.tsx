import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Breadcrumb, PageHeader, EmptyState, StatCard } from '../../components/ui';
import { fetchWithErrorMapping } from '../../shared/api/fetchWithErrorMapping';
import { SidebarIcon, type SidebarIconName } from '../../components/SidebarIcon';
import { EstudianteHome } from './EstudianteHome';
import { FacilitadorProgramasPage } from '../facilitador/ProgramasPage';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface HomeUser {
  nombre: string;
  email: string | null;
  username: string | null;
  empresa: { id: string; nombre: string } | null;
  role: { slug: string; nombre: string } | null;
}

export interface CardDef {
  key: string;
  icon: SidebarIconName;
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
    { key: 'adm_empresas', icon: 'empresas', color: '#3B82F6', to: '/admin/empresas' },
    { key: 'adm_programas', icon: 'programas', color: '#38BDF8', to: '/admin/programas' },
    { key: 'adm_usuarios', icon: 'usuarios', color: '#22C55E', to: '/admin/usuarios' },
    { key: 'adm_actividades', icon: 'actividades', color: '#F59E0B', to: '/admin/actividades' },
  ],
  // El estudiante entra siempre por "Mis programas": la vista de cada programa
  // engloba sesiones, grupo/reto y formularios (incl. la encuesta de inicio). Por
  // eso no hay ítems sueltos de formularios ni de grupo en el sidebar/inicio.
  estudiante: [
    { key: 'est_programas', icon: 'programas', color: '#38BDF8', to: '/estudiante/programas' },
  ],
  // Los resultados (avance, asistencia, diagnóstico, feedback) se ven dentro
  // del detalle de cada programa (RF-43), no como pantalla propia — por eso no
  // hay un ítem "Resultados" separado (duplicaría la ruta de "Programas" y
  // confundiría el estado activo del sidebar, igual que en facilitador/estudiante).
  cliente_admin: [
    { key: 'cli_programas', icon: 'programas', color: '#38BDF8', to: '/portal/programas' },
    { key: 'cli_usuarios', icon: 'usuarios', color: '#F59E0B', to: '/portal/usuarios' },
  ],
  usuario_cliente: [
    { key: 'cli_programas', icon: 'programas', color: '#38BDF8', to: '/portal/programas' },
  ],
};

interface ClienteKpis {
  programas: number;
  activos: number;
  participantes: number;
  usuarios: number | null;
}

// KPIs glanceables del portal cliente, derivados de los mismos endpoints que
// alimentan sus listados (no hay endpoint de resumen dedicado). GET-only, con
// guard de cancelación — sin AbortController (StrictMode). `usuarios` solo se
// pide si el rol tiene esa sección (usuario_cliente no la tiene).
function useClienteKpis(enabled: boolean, withUsuarios: boolean): ClienteKpis | null {
  const [kpis, setKpis] = useState<ClienteKpis | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const progReq = fetchWithErrorMapping(`${API_URL}/portal/programas`)
      .then(r => r.json())
      .catch(() => null);
    const userReq = withUsuarios
      ? fetchWithErrorMapping(`${API_URL}/portal/usuarios`).then(r => r.json()).catch(() => null)
      : Promise.resolve(null);

    Promise.all([progReq, userReq]).then(([prog, users]) => {
      if (cancelled) return;
      const iaEnAccion: { estado?: string; participantes?: number }[] = prog?.iaEnAccion ?? [];
      const decisionIa: unknown[] = prog?.decisionIa ?? [];
      const usuarios = !withUsuarios
        ? null
        : Array.isArray(users)
          ? users.length
          : Array.isArray(users?.usuarios)
            ? users.usuarios.length
            : 0;
      setKpis({
        programas: iaEnAccion.length + decisionIa.length,
        activos: iaEnAccion.filter(p => p.estado === 'activo').length,
        participantes: iaEnAccion.reduce((acc, p) => acc + (p.participantes ?? 0), 0),
        usuarios,
      });
    });

    return () => { cancelled = true; };
  }, [enabled, withUsuarios]);

  return kpis;
}

// Se renderiza DENTRO del Layout (área de contenido, tema claro).
export function HomePage({ user }: { user: HomeUser | null }) {
  const { t } = useTranslation('common', { keyPrefix: 'home' });
  const { t: tc } = useTranslation(['common', 'admin']);
  const slug = user?.role?.slug ?? '';
  const cards = ROLE_CARDS[slug] ?? [];
  const displayName = user?.nombre || user?.username || user?.email || '';
  const roleLabel = slug ? tc(`roles.${slug}`) : undefined;

  const isCliente = slug === 'cliente_admin' || slug === 'usuario_cliente';
  const hasUsuariosCard = cards.some(c => c.key === 'cli_usuarios');
  const kpis = useClienteKpis(isCliente, hasUsuariosCard);

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
          por programa; el resto de roles ven KPIs + accesos a sus secciones. */}
      {slug === 'estudiante' ? <EstudianteHome /> : (
        <div className="home-stack">
          {isCliente && kpis && (
            <div className="section-card home-panel">
              <div className="section-card-header">
                <span className="section-card-title">{t('resumen_title')}</span>
              </div>
              <div className="section-card-body">
                <div className="home-kpi-grid">
                  <StatCard
                    label={t('kpi.programas')}
                    value={kpis.programas}
                    hint={t('kpi.programas_hint', { count: kpis.activos })}
                    icon={<SidebarIcon name="programas" size={18} />}
                    accent="#38BDF8"
                    to="/portal/programas"
                  />
                  <StatCard
                    label={t('kpi.participantes')}
                    value={kpis.participantes}
                    icon={<SidebarIcon name="usuarios" size={18} />}
                    accent="#155BA0"
                  />
                  {kpis.usuarios !== null && (
                    <StatCard
                      label={t('kpi.usuarios')}
                      value={kpis.usuarios}
                      icon={<SidebarIcon name="usuarios" size={18} />}
                      accent="#F59E0B"
                      to="/portal/usuarios"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="section-card home-panel">
            <div className="section-card-header">
              <span className="section-card-title">{t('sections_title')}</span>
              <span className="count-badge">{cards.length}</span>
            </div>
            <div className="section-card-body">
              {cards.length === 0 ? (
                <EmptyState title={t('no_sections')} />
              ) : (
                <div className="home-nav-grid">
                  {cards.map(card => (
                    <NavCard key={card.key} card={card} t={t} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavCard({ card, t }: { card: CardDef; t: ReturnType<typeof useTranslation>['t'] }) {
  const icon = (
    <span
      className="home-nav-card-icon"
      style={{ background: `${card.color}1f`, border: `1px solid ${card.color}55`, color: card.color }}
      aria-hidden="true"
    >
      <SidebarIcon name={card.icon} size={20} />
    </span>
  );
  const title = <div className="home-nav-card-title">{t(`cards.${card.key}.title`)}</div>;
  const desc = <div className="home-nav-card-desc">{t(`cards.${card.key}.desc`)}</div>;

  if (card.to) {
    return (
      <Link to={card.to} className="home-nav-card">
        {icon}
        <div>{title}{desc}</div>
        <div className="home-nav-card-foot">
          <span>{t('open')}</span>
          <span className="home-nav-card-arrow" aria-hidden="true">›</span>
        </div>
      </Link>
    );
  }
  return (
    <div className="home-nav-card is-disabled">
      {icon}
      <div>{title}{desc}</div>
      <div className="home-nav-card-foot">
        <span className="chip">{t('coming_soon')}</span>
      </div>
    </div>
  );
}
