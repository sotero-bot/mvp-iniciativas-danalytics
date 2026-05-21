import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Stats {
  empresas: number;
  iniciativas: number;
  actividades: number;
  instancias: number;
  finalizadas: number;
}

export function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ empresas: 0, iniciativas: 0, actividades: 0, instancias: 0, finalizadas: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/organization/empresas`).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/organization/iniciativas`).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/methodology/actividades`).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/admin/instancias`).then(r => r.ok ? r.json() : []),
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
      num: 1,
      icon: '🏢',
      title: 'Empresas',
      desc: 'Registra las organizaciones cliente. Son el punto de partida de todo el sistema.',
      count: stats.empresas,
      link: '/admin/empresas',
      locked: false,
      lockedMsg: null,
      colorClass: 'step-1',
      iconBg: 'rgba(59,130,246,0.1)',
      iconColor: '#3B82F6',
    },
    {
      num: 2,
      icon: '🚀',
      title: 'Iniciativas',
      desc: 'Agrupa actividades bajo un proyecto o programa específico de cada empresa.',
      count: stats.iniciativas,
      link: '/admin/iniciativas',
      locked: stats.empresas === 0,
      lockedMsg: 'Primero necesitás agregar una empresa',
      colorClass: 'step-2',
      iconBg: 'rgba(139,92,246,0.1)',
      iconColor: '#8B5CF6',
    },
    {
      num: 3,
      icon: '⚡',
      title: 'Actividades',
      desc: 'Define los flujos de trabajo paso a paso que los participantes ejecutarán.',
      count: stats.actividades,
      link: '/admin/actividades',
      locked: stats.iniciativas === 0,
      lockedMsg: 'Primero necesitás agregar una iniciativa',
      colorClass: 'step-3',
      iconBg: 'rgba(245,158,11,0.1)',
      iconColor: '#F59E0B',
    },
    {
      num: 4,
      icon: '📋',
      title: 'Ejecuciones',
      desc: 'Genera enlaces para distribuir actividades y monitorea el progreso en tiempo real.',
      count: stats.instancias,
      link: '/admin/instancias',
      locked: stats.actividades === 0,
      lockedMsg: 'Primero necesitás agregar una actividad',
      colorClass: 'step-4',
      iconBg: 'rgba(34,197,94,0.1)',
      iconColor: '#22C55E',
    },
  ];

  const firstIncomplete = steps.find(s => s.count === 0 && !s.locked);
  const allDone = steps.every(s => s.count > 0);

  return (
    <div>
      {/* Hero */}
      <div className="dashboard-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <p style={{ color: '#60A5FA', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6', display: 'inline-block', boxShadow: '0 0 6px #3B82F6' }}></span>
              Panel de control
            </p>
            <h1 style={{ color: 'white', fontSize: '1.75rem', margin: '0 0 10px', letterSpacing: '-0.03em' }}>
              Bienvenido a Desicion IA
            </h1>
            <p style={{ color: '#94A3B8', margin: 0, maxWidth: 460, lineHeight: 1.65, fontSize: '0.875rem' }}>
              Diseña, distribuye y monitorea actividades metodológicas con asistencia de inteligencia artificial.
            </p>
          </div>

          {!loading && (
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {[
                { label: 'Empresas', val: stats.empresas, color: '#60A5FA' },
                { label: 'Iniciativas', val: stats.iniciativas, color: '#A78BFA' },
                { label: 'Actividades', val: stats.actividades, color: '#FCD34D' },
                { label: 'Ejecuciones', val: stats.instancias, color: '#6EE7B7' },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: '0.75rem 1rem',
                  minWidth: 80,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: 3, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Workflow steps */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>Flujo de trabajo</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Sigue estos 4 pasos en orden</span>
        </div>

        <div className="dashboard-grid">
          {steps.map(step => (
            step.locked ? (
              <div key={step.num} className={`dashboard-step-card step-locked ${step.colorClass}`}>
                <div className="step-card-meta">
                  <span className="step-card-num">Paso {step.num}</span>
                </div>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  background: step.iconBg, fontSize: '1.25rem', marginBottom: 2,
                }}>
                  {step.icon}
                </div>
                <div className="step-card-title">{step.title}</div>
                <p className="step-card-desc">{step.desc}</p>
                <span className="step-card-locked-msg">🔒 {step.lockedMsg}</span>
              </div>
            ) : (
              <Link
                key={step.num}
                to={step.link}
                className={`dashboard-step-card ${step.colorClass} ${step.count > 0 ? 'step-done' : ''}`}
              >
                <div className="step-card-meta">
                  <span className="step-card-num">Paso {step.num}</span>
                  {step.count > 0 && <div className="step-card-done-badge">✓</div>}
                </div>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  background: step.iconBg, fontSize: '1.25rem', marginBottom: 2,
                }}>
                  {step.icon}
                </div>
                <div className="step-card-title">{step.title}</div>
                <p className="step-card-desc">{step.desc}</p>
                <span className="step-card-count">
                  {step.count} {step.count === 1 ? 'registro' : 'registros'}
                </span>
              </Link>
            )
          ))}
        </div>
      </div>

      {/* CTA contextual */}
      {!loading && !allDone && firstIncomplete && (
        <div className="cta-banner">
          <span className="cta-banner-icon">{firstIncomplete.icon}</span>
          <div className="cta-banner-body">
            <p className="cta-banner-title">
              Siguiente paso: {firstIncomplete.title}
            </p>
            <p className="cta-banner-text">{firstIncomplete.desc}</p>
          </div>
          <Link to={firstIncomplete.link} className="btn btn-primary" style={{ textDecoration: 'none', flexShrink: 0 }}>
            Ir a {firstIncomplete.title} →
          </Link>
        </div>
      )}

      {!loading && allDone && (
        <div className="cta-banner" style={{ background: 'linear-gradient(135deg, #F0FDF4, #ECFDF5)', borderColor: '#86EFAC' }}>
          <span className="cta-banner-icon">🎉</span>
          <div className="cta-banner-body">
            <p className="cta-banner-title" style={{ color: '#065F46' }}>¡Todo configurado!</p>
            <p className="cta-banner-text" style={{ color: '#059669' }}>
              Puedes generar nuevos enlaces de ejecución y monitorear el progreso de los participantes.
            </p>
          </div>
          <Link to="/admin/instancias" className="btn btn-primary" style={{ textDecoration: 'none', flexShrink: 0, background: '#059669' }}>
            Ver ejecuciones →
          </Link>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
          Cargando información...
        </div>
      )}
    </div>
  );
}
