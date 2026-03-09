import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { EmpresasPage } from './features/organization/EmpresasPage';
import { IniciativasPage } from './features/organization/IniciativasPage';
import { ActividadesPage } from './features/methodology/ActividadesPage';
import { InstanciasPage } from './features/execution/InstanciasPage';
import { InstanciaDetallePage } from './features/execution/InstanciaDetallePage';

import { RunnerPage } from './features/execution/RunnerPage';
import { EnlaceRunnerPage } from './features/execution/EnlaceRunnerPage';
import { RunnerResultsPage } from './features/execution/RunnerResultsPage';
import { ActividadPasosPage } from './features/methodology/ActividadPasosPage';

const Layout = ({ children, onLogout }: { children: React.ReactNode; onLogout: () => void }) => (
  <div className="layout-container">
    <aside className="sidebar">
      <div className="sidebar-title">
        <div className="sidebar-logo"></div>
        <span>IAGobernanza</span>
      </div>
      <div className="sidebar-section-label">Panel</div>
      <nav>
        <NavLink to="/admin/empresas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          🏢 Empresas
        </NavLink>
        <NavLink to="/admin/iniciativas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          🚀 Iniciativas
        </NavLink>
        <NavLink to="/admin/actividades" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          ⚡ Actividades
        </NavLink>
        <NavLink to="/admin/instancias" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          📋 Ejecuciones
        </NavLink>
      </nav>
      <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
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
          ↩ Cerrar sesión
        </button>
      </div>
    </aside>
    <main className="main-content">
      {children}
    </main>
  </div>
);

import { LoginPage } from './features/auth/LoginPage';

function App() {
  const [token, setToken] = React.useState<string | null>(localStorage.getItem('admin_token'));

  const handleLogin = (newToken: string) => {
    localStorage.setItem('admin_token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
  };

  // Wrapper para proteger rutas de admim
  const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    if (!token) return <LoginPage onLogin={handleLogin} />;
    return <>{children}</>;
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Admin Routes (Protected) */}
        <Route path="/admin/empresas" element={<AdminRoute><Layout onLogout={handleLogout}><EmpresasPage /></Layout></AdminRoute>} />
        <Route path="/admin/iniciativas" element={<AdminRoute><Layout onLogout={handleLogout}><IniciativasPage /></Layout></AdminRoute>} />
        <Route path="/admin/actividades" element={<AdminRoute><Layout onLogout={handleLogout}><ActividadesPage /></Layout></AdminRoute>} />
        <Route path="/admin/actividades/:id/pasos" element={<AdminRoute><Layout onLogout={handleLogout}><ActividadPasosPage /></Layout></AdminRoute>} />
        <Route path="/admin/instancias" element={<AdminRoute><Layout onLogout={handleLogout}><InstanciasPage /></Layout></AdminRoute>} />
        <Route path="/admin/instancias/:id" element={<AdminRoute><Layout onLogout={handleLogout}><InstanciaDetallePage /></Layout></AdminRoute>} />

        {/* Public Runner Routes (No Auth) */}
        <Route path="/runner/enlace/:token" element={<EnlaceRunnerPage />} />
        <Route path="/runner/:token/resultados" element={<RunnerResultsPage />} />
        <Route path="/runner/:token" element={<RunnerPage />} />

        {/* Login Route */}
        <Route path="/login" element={token ? <Navigate to="/admin/empresas" replace /> : <LoginPage onLogin={handleLogin} />} />

        {/* Root redirect */}
        <Route path="/" element={<Navigate to={token ? '/admin/empresas' : '/login'} replace />} />

        {/* Default Redirect */}
        <Route path="*" element={
          token ?
            <Layout onLogout={handleLogout}>
              <div className="card" style={{ maxWidth: 480 }}>
                <h2>Bienvenido al Panel</h2>
                <p style={{ marginTop: 8 }}>Selecciona una opción del menú para comenzar.</p>
              </div>
            </Layout> :
            <LoginPage onLogin={handleLogin} />
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
