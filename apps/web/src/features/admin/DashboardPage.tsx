import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { withAuth } from '../../shared/api/fetchWithErrorMapping';
import { Breadcrumb, PageHeader, Loading, StatCard, StatusBadge } from '../../components/ui';
import { SidebarIcon } from '../../components/SidebarIcon';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Stats {
  empresas: number;
  iniciativas: number;
  actividades: number;
  instancias: number;
  finalizadas: number;
  programas: number;
  formularios: number;
  usuarios: number;
  notificaciones: number;
  registroAcceso: number;
}

export function DashboardPage() {
  const { t } = useTranslation(['admin']);
  const [stats, setStats] = useState<Stats>({
    empresas: 0, iniciativas: 0, actividades: 0, instancias: 0, finalizadas: 0,
    programas: 0, formularios: 0, usuarios: 0, notificaciones: 0, registroAcceso: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/organization/empresas`, withAuth()).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/organization/iniciativas`, withAuth()).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/methodology/actividades`, withAuth()).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/admin/instancias`, withAuth()).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/admin/programas`, withAuth()).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/admin/plantillas-formulario`, withAuth()).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/admin/usuarios`, withAuth()).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/admin/notificaciones`, withAuth()).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/admin/registro-acceso?take=1`, withAuth()).then(r => r.ok ? r.json() : { total: 0 }),
    ]).then(([e, i, a, inst, prog, formu, usu, notif, acceso]) => {
      setStats({
        empresas: Array.isArray(e) ? e.length : 0,
        iniciativas: Array.isArray(i) ? i.length : 0,
        actividades: Array.isArray(a) ? a.length : 0,
        instancias: Array.isArray(inst) ? inst.length : 0,
        finalizadas: Array.isArray(inst) ? inst.filter((x: any) => x.estado === 'finalizado').length : 0,
        programas: Array.isArray(prog) ? prog.length : 0,
        formularios: Array.isArray(formu) ? formu.length : 0,
        usuarios: Array.isArray(usu) ? usu.length : 0,
        notificaciones: Array.isArray(notif) ? notif.length : 0,
        registroAcceso: typeof acceso?.total === 'number' ? acceso.total : 0,
      });
    }).finally(() => setLoading(false));
  }, []);

  // KPIs navegables: cuenta + acceso directo a cada sección. Los colores son los
  // acentos categóricos de sección (mismos hex que el sidebar / ROLE_CARDS).
  const kpis = [
    { key: 'empresas', label: t('admin:sidebar.empresas'), value: stats.empresas, icon: 'empresas' as const, color: '#3B82F6', to: '/admin/empresas', hint: undefined as string | undefined },
    { key: 'iniciativas', label: t('admin:sidebar.iniciativas'), value: stats.iniciativas, icon: 'programas' as const, color: '#38BDF8', to: '/admin/iniciativas', hint: undefined },
    { key: 'actividades', label: t('admin:sidebar.actividades'), value: stats.actividades, icon: 'actividades' as const, color: '#F59E0B', to: '/admin/actividades', hint: undefined },
    { key: 'ejecuciones', label: t('admin:sidebar.ejecuciones'), value: stats.instancias, icon: 'formularios' as const, color: '#22C55E', to: '/admin/instancias', hint: t('admin:dashboard_v2.kpi_ejecuciones_hint', { count: stats.finalizadas }) },
  ];

  const iaAccionKpis = [
    { key: 'programas', label: t('admin:sidebar.programas'), value: stats.programas, icon: 'programas' as const, color: '#38BDF8', to: '/admin/programas' },
    { key: 'formularios', label: t('admin:sidebar.formularios'), value: stats.formularios, icon: 'formularios' as const, color: '#8B5CF6', to: '/admin/formularios' },
  ];

  const usuariosKpis = [
    { key: 'usuarios', label: t('admin:sidebar.usuarios'), value: stats.usuarios, icon: 'usuarios' as const, color: '#EC4899', to: '/admin/usuarios' },
    { key: 'notificaciones', label: t('admin:sidebar.notificaciones'), value: stats.notificaciones, icon: 'notificaciones' as const, color: '#6366F1', to: '/admin/notificaciones' },
    { key: 'registro_acceso', label: t('admin:sidebar.registro_acceso'), value: stats.registroAcceso, icon: 'registro-acceso' as const, color: '#64748B', to: '/admin/registro-acceso' },
  ];

  const steps = [
    {
      key: 'empresas' as const,
      num: 1,
      title: t('admin:dashboard_v2.steps.empresas.title'),
      desc: t('admin:dashboard_v2.steps.empresas.desc'),
      count: stats.empresas,
      link: '/admin/empresas',
      locked: false,
      lockedMsg: null as string | null,
    },
    {
      key: 'iniciativas' as const,
      num: 2,
      title: t('admin:dashboard_v2.steps.iniciativas.title'),
      desc: t('admin:dashboard_v2.steps.iniciativas.desc'),
      count: stats.iniciativas,
      link: '/admin/iniciativas',
      locked: stats.empresas === 0,
      lockedMsg: t('admin:dashboard_v2.steps.iniciativas.locked'),
    },
    {
      key: 'actividades' as const,
      num: 3,
      title: t('admin:dashboard_v2.steps.actividades.title'),
      desc: t('admin:dashboard_v2.steps.actividades.desc'),
      count: stats.actividades,
      link: '/admin/actividades',
      locked: stats.iniciativas === 0,
      lockedMsg: t('admin:dashboard_v2.steps.actividades.locked'),
    },
    {
      key: 'ejecuciones' as const,
      num: 4,
      title: t('admin:dashboard_v2.steps.ejecuciones.title'),
      desc: t('admin:dashboard_v2.steps.ejecuciones.desc'),
      count: stats.instancias,
      link: '/admin/instancias',
      locked: stats.actividades === 0,
      lockedMsg: t('admin:dashboard_v2.steps.ejecuciones.locked'),
    },
  ];

  const firstIncomplete = steps.find(s => s.count === 0 && !s.locked);
  const allDone = steps.every(s => s.count > 0);

  return (
    <div>
      <Breadcrumb items={[{ label: t('admin:sidebar.home') }]} />

      <PageHeader
        eyebrow={t('admin:dashboard_v2.panel_label')}
        title={t('admin:dashboard_v2.hero_title')}
        description={t('admin:dashboard_v2.hero_subtitle')}
      />

      {loading ? (
        <Loading label={t('admin:dashboard_v2.loading_info')} />
      ) : (
        <div className="home-stack">
          {/* KPIs navegables */}
          <div className="section-card home-panel">
            <div className="section-card-header">
              <span className="section-card-title">{t('admin:dashboard_v2.resumen_title')}</span>
            </div>
            <div className="section-card-body">
              <div className="home-kpi-grid">
                {kpis.map(k => (
                  <StatCard
                    key={k.key}
                    label={k.label}
                    value={k.value}
                    hint={k.hint}
                    icon={<SidebarIcon name={k.icon} size={18} />}
                    accent={k.color}
                    to={k.to}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Flujo de trabajo guiado (setup en orden con bloqueo por dependencia) */}
          <div className="section-card home-panel">
            <div className="section-card-header">
              <span className="section-card-title">{t('admin:dashboard_v2.workflow_title')}</span>
              <span className="home-section-note">{t('admin:dashboard_v2.workflow_subtitle')}</span>
            </div>
            <div className="section-card-body">
            <div className="home-nav-grid">
              {steps.map(step => {
                const numStyle = {
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 700,
                  background: step.locked ? 'var(--color-bg-subtle)' : 'var(--color-primary)',
                  color: step.locked ? 'var(--color-text-tertiary)' : '#FFFFFF',
                  border: 'none',
                };
                const num = (
                  <span className="home-nav-card-icon" style={numStyle} aria-hidden="true">{step.num}</span>
                );
                const body = (
                  <div>
                    <div className="home-nav-card-title">{step.title}</div>
                    <div className="home-nav-card-desc">{step.desc}</div>
                  </div>
                );

                if (step.locked) {
                  return (
                    <div key={step.num} className="home-nav-card is-disabled">
                      {num}
                      {body}
                      <div className="home-nav-card-foot">
                        <StatusBadge variant="neutral">{step.lockedMsg}</StatusBadge>
                      </div>
                    </div>
                  );
                }
                return (
                  <Link key={step.num} to={step.link} className="home-nav-card">
                    {num}
                    {body}
                    <div className="home-nav-card-foot">
                      {step.count > 0 ? (
                        <StatusBadge variant="success">{t('admin:dashboard_v2.configured_badge')}</StatusBadge>
                      ) : (
                        <span className="chip">{t('admin:dashboard_v2.pending_badge')}</span>
                      )}
                      <span className="home-nav-card-arrow" aria-hidden="true" style={{ marginLeft: 'auto', color: 'var(--color-accent)' }}>›</span>
                    </div>
                  </Link>
                );
              })}
            </div>
            </div>
          </div>

          {/* Siguiente paso sugerido */}
          {!allDone && firstIncomplete && (
            <div className="next-step-banner">
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>
                  {t('admin:dashboard_v2.next_step_prefix', { title: firstIncomplete.title })}
                </p>
                <p style={{ margin: 'var(--space-1) 0 0', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                  {firstIncomplete.desc}
                </p>
              </div>
              <Link to={firstIncomplete.link} className="btn btn-primary">
                {t('admin:dashboard_v2.goto_label', { title: firstIncomplete.title })}
              </Link>
            </div>
          )}

          {allDone && (
            <div className="next-step-banner">
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{t('admin:dashboard_v2.all_configured_title')}</p>
                <p style={{ margin: 'var(--space-1) 0 0', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                  {t('admin:dashboard_v2.all_configured_text')}
                </p>
              </div>
              <Link to="/admin/instancias" className="btn btn-primary">
                {t('admin:dashboard_v2.view_executions')}
              </Link>
            </div>
          )}

          {/* IA en Acción: programas y formularios del módulo */}
          <div className="section-card home-panel">
            <div className="section-card-header">
              <span className="section-card-title">{t('admin:dashboard_v2.ia_en_accion_section_title')}</span>
            </div>
            <div className="section-card-body">
              <div className="home-kpi-grid">
                {iaAccionKpis.map(k => (
                  <StatCard
                    key={k.key}
                    label={k.label}
                    value={k.value}
                    icon={<SidebarIcon name={k.icon} size={18} />}
                    accent={k.color}
                    to={k.to}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Usuarios: usuarios, notificaciones y registro de acceso */}
          <div className="section-card home-panel">
            <div className="section-card-header">
              <span className="section-card-title">{t('admin:dashboard_v2.usuarios_section_title')}</span>
            </div>
            <div className="section-card-body">
              <div className="home-kpi-grid">
                {usuariosKpis.map(k => (
                  <StatCard
                    key={k.key}
                    label={k.label}
                    value={k.value}
                    icon={<SidebarIcon name={k.icon} size={18} />}
                    accent={k.color}
                    to={k.to}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
