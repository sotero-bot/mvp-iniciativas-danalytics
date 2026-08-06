import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { withAuth } from '../../shared/api/fetchWithErrorMapping';
import { Breadcrumb, PageHeader, Loading, StatCard, StatusBadge } from '../../components/ui';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Stats {
  empresas: number;
  iniciativas: number;
  actividades: number;
  instancias: number;
  finalizadas: number;
}

export function DashboardPage() {
  const { t } = useTranslation(['admin']);
  const [stats, setStats] = useState<Stats>({ empresas: 0, iniciativas: 0, actividades: 0, instancias: 0, finalizadas: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/organization/empresas`, withAuth()).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/organization/iniciativas`, withAuth()).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/methodology/actividades`, withAuth()).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/admin/instancias`, withAuth()).then(r => r.ok ? r.json() : []),
    ]).then(([e, i, a, inst]) => {
      setStats({
        empresas: Array.isArray(e) ? e.length : 0,
        iniciativas: Array.isArray(i) ? i.length : 0,
        actividades: Array.isArray(a) ? a.length : 0,
        instancias: Array.isArray(inst) ? inst.length : 0,
        finalizadas: Array.isArray(inst) ? inst.filter((x: any) => x.estado === 'finalizado').length : 0,
      });
    }).finally(() => setLoading(false));
  }, []);

  const steps = [
    {
      key: 'empresas' as const,
      num: 1,
      icon: '🏢',
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
      icon: '🚀',
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
      icon: '⚡',
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
      icon: '📋',
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

      {!loading && (
        <div className="stat-grid" style={{ marginBottom: 'var(--space-6)' }}>
          <StatCard label={t('admin:sidebar.empresas')} value={stats.empresas} />
          <StatCard label={t('admin:sidebar.iniciativas')} value={stats.iniciativas} />
          <StatCard label={t('admin:sidebar.actividades')} value={stats.actividades} />
          <StatCard label={t('admin:sidebar.ejecuciones')} value={stats.instancias} />
        </div>
      )}

      {/* Flujo de trabajo */}
      <div className="section-card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="section-card-header">
          <span className="section-card-title">{t('admin:dashboard_v2.workflow_title')}</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{t('admin:dashboard_v2.workflow_subtitle')}</span>
        </div>
        <div className="section-card-body">
        <div className="card-grid">
          {steps.map(step => {
            const body = (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>
                    {t('admin:dashboard_v2.step_label', { num: step.num })}
                  </span>
                  {step.count > 0 && <StatusBadge variant="success">✓</StatusBadge>}
                </div>
                <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }} aria-hidden="true">{step.icon}</div>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-main)' }}>{step.title}</p>
                <p style={{ margin: 'var(--space-1) 0 0', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  {step.desc}
                </p>
                {step.locked ? (
                  <span className="chip" style={{ marginTop: 'var(--space-2)' }}>
                    🔒 {step.lockedMsg}
                  </span>
                ) : (
                  <span className="chip" style={{ marginTop: 'var(--space-2)' }}>
                    {t('admin:dashboard_v2.records', { count: step.count })}
                  </span>
                )}
              </>
            );

            return step.locked ? (
              <div key={step.num} className="card" style={{ opacity: 0.5 }}>
                {body}
              </div>
            ) : (
              <Link
                key={step.num}
                to={step.link}
                className="card"
                style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}
              >
                {body}
              </Link>
            );
          })}
        </div>
        </div>
      </div>

      {/* Siguiente paso sugerido */}
      {!loading && !allDone && firstIncomplete && (
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

      {!loading && allDone && (
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

      {loading && <Loading label={t('admin:dashboard_v2.loading_info')} />}
    </div>
  );
}
