import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmpresasPage } from './features/organization/EmpresasPage';
import { IniciativasPage } from './features/organization/IniciativasPage';
import { ActividadesPage } from './features/methodology/ActividadesPage';
import { InstanciasPage } from './features/execution/InstanciasPage';
import { InstanciaDetallePage } from './features/execution/InstanciaDetallePage';
import { DashboardPage } from './features/admin/DashboardPage';
import { UsuariosPage } from './features/admin/UsuariosPage';
import { ProgramasPage } from './features/admin/ProgramasPage';
import { MagicLinkConsumePage } from './features/auth/MagicLinkConsumePage';
import { GoogleCallbackPage } from './features/auth/GoogleCallbackPage';

import { RunnerPage } from './features/execution/RunnerPage';
import { EnlaceRunnerPage } from './features/execution/EnlaceRunnerPage';
import { RunnerResultsPage } from './features/execution/RunnerResultsPage';
import { ActividadPasosPage } from './features/methodology/ActividadPasosPage';
import { PlantillasPage } from './features/methodology/PlantillasPage';
import { PlantillaPasosPage } from './features/methodology/PlantillaPasosPage';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { HomePage, ROLE_CARDS } from './features/home/HomePage';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface CurrentUser {
  id: string;
  nombre: string;
  email: string | null;
  username: string | null;
  empresaId: string | null;
  empresa: { id: string; nombre: string } | null;
  role: { slug: string; nombre: string } | null;
}

// Cache a nivel de módulo para no re-consultar el perfil en cada navegación
// (el Layout se remonta por ruta). Se limpia en logout.
let currentUserCache: CurrentUser | null = null;
export function clearCurrentUserCache() {
  currentUserCache = null;
}

const ADMIN_SLUG = 'danalytics_admin';

interface SessionPayload {
  sub: string;
  role: string | null;
  empresaId: string | null;
  username?: string | null;
}

// Decodifica el rol del JWT de forma SÍNCRONA (sin red), para poder proteger
// las rutas sin parpadeos. La autorización real vive en el backend (RNF-01);
// esto es solo gating de UI/navegación.
function decodeSession(token: string | null): SessionPayload | null {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as SessionPayload;
  } catch {
    return null;
  }
}

function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = React.useState<CurrentUser | null>(currentUserCache);
  React.useEffect(() => {
    if (currentUserCache) {
      setUser(currentUserCache);
      return;
    }
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    let cancelled = false;
    fetch(`${API_URL}/auth/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data && !cancelled) {
          currentUserCache = data as CurrentUser;
          setUser(currentUserCache);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return user;
}

const Layout = ({ children, onLogout }: { children: React.ReactNode; onLogout: () => void }) => {
  const { t } = useTranslation(['common', 'admin', 'auth']);
  const currentUser = useCurrentUser();
  const session = decodeSession(localStorage.getItem('admin_token'));
  const role = session?.role ?? null;
  const isAdmin = role === ADMIN_SLUG;
  const inicioPath = isAdmin ? '/admin/inicio' : '/inicio';
  const roleCards = !isAdmin ? (ROLE_CARDS[role ?? ''] ?? []) : [];

  // Datos del card de usuario: usa el perfil (nombre/rol/empresa reales) cuando cargó;
  // si el fetch aún no volvió o falló (p. ej. token expirado), cae al JWT para que
  // el card NUNCA quede en blanco. Aplica igual a todos los roles, admin incluido.
  const displayName =
    currentUser?.nombre || currentUser?.username || session?.username || currentUser?.email || '—';
  const displayRole =
    currentUser?.role?.nombre || (role ? t(`common:roles.${role}`, { defaultValue: role }) : '');
  const displayEmpresa = currentUser?.empresa?.nombre ?? '';

  return (
    <div className="layout-container">
      <aside className="sidebar">
        <div className="sidebar-title">
          <img src="/logo-simbolo.png" alt="Danalytics Logo" className="sidebar-logo" />
          <span>{t('common:app_name')}</span>
        </div>

        {/* Inicio */}
        <nav>
          <NavLink to={inicioPath} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span style={{
              width: 20, height: 20, borderRadius: '6px', flexShrink: 0,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.7rem',
            }}>⌂</span>
            {t('admin:sidebar.home')}
          </NavLink>
        </nav>

        {/* — Secciones por rol NO-admin: visibles pero aún no navegables — */}
        {!isAdmin && roleCards.length > 0 && (
          <nav style={{ marginTop: '1.25rem' }}>
            {roleCards.map(item => (
              <div key={item.key} className="nav-item" style={{ cursor: 'default', opacity: 0.55 }} title={t('common:home.coming_soon')}>
                <span style={{
                  width: 20, height: 20, borderRadius: '6px', flexShrink: 0,
                  background: `${item.color}2e`, border: `1px solid ${item.color}55`,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem',
                }}>{item.icon}</span>
                {t(`common:home.cards.${item.key}.title`)}
              </div>
            ))}
          </nav>
        )}

        {/* — Módulo Decisión IA (solo admin) — */}
        {isAdmin && (<>
        <div className="sidebar-section-label" style={{ marginTop: '1.25rem' }}>{t('admin:sidebar.decision_ia_label')}</div>
        <nav>
          {[
            { num: 1, label: t('admin:sidebar.empresas'), to: '/admin/empresas', color: '#3B82F6', bg: 'rgba(59,130,246,0.18)' },
            { num: 2, label: t('admin:sidebar.iniciativas'), to: '/admin/iniciativas', color: '#A78BFA', bg: 'rgba(139,92,246,0.18)' },
            { num: 3, label: t('admin:sidebar.actividades'), to: '/admin/actividades', color: '#FCD34D', bg: 'rgba(245,158,11,0.18)' },
          ].map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span style={{
                width: 20, height: 20, borderRadius: '6px', flexShrink: 0,
                background: item.bg,
                border: `1px solid ${item.color}40`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', fontWeight: 800, color: item.color,
                letterSpacing: '-0.01em',
              }}>{item.num}</span>
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/admin/plantillas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span style={{
              width: 20, height: 20, borderRadius: '6px', flexShrink: 0,
              background: 'rgba(244,114,182,0.18)',
              border: '1px solid #F472B640',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem',
            }}>📋</span>
            {t('admin:sidebar.plantillas')}
          </NavLink>
          <NavLink to="/admin/instancias" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span style={{
              width: 20, height: 20, borderRadius: '6px', flexShrink: 0,
              background: 'rgba(34,197,94,0.18)',
              border: '1px solid #6EE7B740',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.6rem', fontWeight: 800, color: '#6EE7B7',
              letterSpacing: '-0.01em',
            }}>4</span>
            {t('admin:sidebar.ejecuciones')}
          </NavLink>
        </nav>

        {/* — Módulo IA en Acción — */}
        <div className="sidebar-section-label" style={{ marginTop: '1.25rem' }}>{t('admin:sidebar.ia_en_accion_label')}</div>
        <nav>
          <NavLink to="/admin/programas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span style={{
              width: 20, height: 20, borderRadius: '6px', flexShrink: 0,
              background: 'rgba(20,184,166,0.18)',
              border: '1px solid #14B8A640',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem',
            }}>🎓</span>
            {t('admin:sidebar.programas')}
          </NavLink>
        </nav>

        {/* — Gestión (transversal) — */}
        <div className="sidebar-section-label" style={{ marginTop: '1.25rem' }}>{t('admin:sidebar.gestion_label')}</div>
        <nav>
          <NavLink to="/admin/usuarios" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span style={{
              width: 20, height: 20, borderRadius: '6px', flexShrink: 0,
              background: 'rgba(56,189,248,0.18)',
              border: '1px solid #38BDF840',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem',
            }}>👥</span>
            {t('admin:sidebar.usuarios')}
          </NavLink>
        </nav>
        </>)}

        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {session && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.4rem 0.625rem' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(56,189,248,0.18)', border: '1px solid #38BDF840',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: '#38BDF8', fontWeight: 700, fontSize: '0.85rem',
              }}>
                {(displayName || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#F1F5F9', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {displayName}
                </div>
                <div style={{ color: 'var(--sidebar-text)', fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {displayRole || '—'}{displayEmpresa ? ` · ${displayEmpresa}` : ''}
                </div>
              </div>
            </div>
          )}
          <LanguageSwitcher variant="sidebar" />
          <button
            onClick={onLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '0.5625rem 0.625rem',
              background: 'none', border: 'none', borderRadius: 'var(--radius-sm)',
              color: 'var(--sidebar-text)', fontSize: '0.875rem', fontWeight: 500,
              cursor: 'pointer', transition: 'var(--transition)', fontFamily: 'var(--font-family)'
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#F1F5F9'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text)'; }}
          >
            ↩ {t('auth:logout')}
          </button>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

import { LoginPage } from './features/auth/LoginPage';

function AiDisclaimerFooter() {
  const { t } = useTranslation('common');
  return (
    <div style={{
      position: 'fixed',
      bottom: 14,
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '8px 18px',
      background: 'rgba(254, 243, 199, 0.97)',
      backdropFilter: 'blur(8px)',
      color: '#78350F',
      fontSize: '0.8rem',
      fontWeight: 500,
      borderRadius: 9999,
      border: '1px solid #FCD34D',
      boxShadow: '0 4px 12px rgba(217, 119, 6, 0.18)',
      zIndex: 1000,
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <span style={{ fontSize: '0.95rem' }}>⚠️</span>
      {t('footer.ai_disclaimer')}
    </div>
  );
}


function App() {
  const [token, setToken] = React.useState<string | null>(localStorage.getItem('admin_token'));
  const role = decodeSession(token)?.role ?? null;
  const isAdmin = role === ADMIN_SLUG;
  const homePath = isAdmin ? '/admin/inicio' : '/inicio';

  const handleLogin = (newToken: string) => {
    localStorage.setItem('admin_token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    clearCurrentUserCache();
    setToken(null);
  };

  // Ruta solo para danalytics_admin. Sin token → login; con token pero otro rol
  // → redirige a su inicio (bloquea el acceso por URL directa). RNF-01: esto es
  // gating de UI; la autorización efectiva la imponen los guards del backend.
  const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    if (!token) return <LoginPage onLogin={handleLogin} />;
    if (!isAdmin) return <Navigate to="/inicio" replace />;
    return <>{children}</>;
  };

  // Inicio general para usuarios autenticados no-admin (dashboard por rol),
  // dentro del Layout con sidebar.
  const HomeRoute = () => {
    const currentUser = useCurrentUser();
    if (!token) return <LoginPage onLogin={handleLogin} />;
    if (isAdmin) return <Navigate to="/admin/inicio" replace />;
    return <Layout onLogout={handleLogout}><HomePage user={currentUser} /></Layout>;
  };

  return (
    <BrowserRouter>
      <AiDisclaimerFooter />
      <Routes>
        {/* Admin Routes (Protected) */}
        <Route path="/admin/inicio" element={<AdminRoute><Layout onLogout={handleLogout}><DashboardPage /></Layout></AdminRoute>} />
        <Route path="/admin/empresas" element={<AdminRoute><Layout onLogout={handleLogout}><EmpresasPage /></Layout></AdminRoute>} />
        <Route path="/admin/iniciativas" element={<AdminRoute><Layout onLogout={handleLogout}><IniciativasPage /></Layout></AdminRoute>} />
        <Route path="/admin/actividades" element={<AdminRoute><Layout onLogout={handleLogout}><ActividadesPage /></Layout></AdminRoute>} />
        <Route path="/admin/actividades/:id/pasos" element={<AdminRoute><Layout onLogout={handleLogout}><ActividadPasosPage /></Layout></AdminRoute>} />
        <Route path="/admin/plantillas" element={<AdminRoute><Layout onLogout={handleLogout}><PlantillasPage /></Layout></AdminRoute>} />
        <Route path="/admin/plantillas/:id/pasos" element={<AdminRoute><Layout onLogout={handleLogout}><PlantillaPasosPage /></Layout></AdminRoute>} />
        <Route path="/admin/usuarios" element={<AdminRoute><Layout onLogout={handleLogout}><UsuariosPage /></Layout></AdminRoute>} />
        <Route path="/admin/programas" element={<AdminRoute><Layout onLogout={handleLogout}><ProgramasPage /></Layout></AdminRoute>} />
        <Route path="/admin/instancias" element={<AdminRoute><Layout onLogout={handleLogout}><InstanciasPage /></Layout></AdminRoute>} />
        <Route path="/admin/instancias/:id" element={<AdminRoute><Layout onLogout={handleLogout}><InstanciaDetallePage /></Layout></AdminRoute>} />

        {/* Public Runner Routes (No Auth) */}
        <Route path="/runner/enlace/:token" element={<EnlaceRunnerPage />} />
        <Route path="/runner/:token/resultados" element={<RunnerResultsPage />} />
        <Route path="/runner/:token" element={<RunnerPage />} />

        {/* Inicio general para roles no-admin (facilitador/estudiante/cliente) */}
        <Route path="/inicio" element={<HomeRoute />} />

        {/* Public MagicLink consume */}
        <Route path="/auth/link/:token" element={<MagicLinkConsumePage onLogin={handleLogin} />} />

        {/* Google OAuth callback (recibe ?token= del backend) */}
        <Route path="/auth/google/callback" element={<GoogleCallbackPage onLogin={handleLogin} />} />

        {/* Login Route */}
        <Route path="/login" element={token ? <Navigate to={homePath} replace /> : <LoginPage onLogin={handleLogin} />} />

        {/* Root redirect */}
        <Route path="/" element={<Navigate to={token ? homePath : '/login'} replace />} />

        {/* Admin base redirect */}
        <Route path="/admin" element={<Navigate to={homePath} replace />} />

        {/* Default Redirect */}
        <Route path="*" element={<Navigate to={token ? homePath : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
