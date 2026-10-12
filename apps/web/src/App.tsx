import { useEffect, useState } from 'react';

type ApiStatus = 'checking' | 'online' | 'offline';

export default function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'}/health`)
      .then((response) => {
        if (!response.ok) throw new Error('API request failed');
        return response.json();
      })
      .then(() => setApiStatus('online'))
      .catch(() => setApiStatus('offline'));
  }, []);

  return (
    <main className="page-shell">
      <nav className="topbar">
        <a className="brand" href="/" aria-label="Captions AI home"><span className="brand-mark">C</span> captions<span className="brand-ai">.ai</span></a>
        <span className="environment-label">DEVELOPMENT WORKSPACE</span>
      </nav>
      <section className="hero">
        <div className="eyebrow"><span className="eyebrow-dot" /> YOUR CREATIVE WORKSPACE</div>
        <h1>Make every word<br /><span>stand out.</span></h1>
        <p className="intro">Your app foundation is ready. The next step is to shape this workspace around your product idea.</p>
        <div className="status-card">
          <div><div className="status-title">Backend connection</div><div className="status-description">NestJS API · localhost:3000</div></div>
          <span className={`status-pill ${apiStatus}`}><span className="status-dot" />{apiStatus === 'checking' ? 'Checking' : apiStatus === 'online' ? 'Connected' : 'Not running'}</span>
        </div>
      </section>
      <section className="foundation">
        <div className="section-heading"><span>FOUNDATION</span><span className="section-line" /></div>
        <div className="feature-grid">
          <article className="feature-card"><div className="feature-icon purple">◈</div><h2>React frontend</h2><p>React, TypeScript and Vite for a fast local development loop.</p><span className="feature-tag">PORT 5173</span></article>
          <article className="feature-card"><div className="feature-icon blue">⌘</div><h2>NestJS API</h2><p>Modular REST backend with a health endpoint and configuration.</p><span className="feature-tag">PORT 3000</span></article>
          <article className="feature-card"><div className="feature-icon green">▤</div><h2>Database-ready</h2><p>Prisma schema configured for Supabase PostgreSQL, isolated for future migration.</p><span className="feature-tag">SUPABASE + PRISMA</span></article>
        </div>
      </section>
      <footer><span>CAPTIONS AI</span><span>Starter workspace · Features coming next</span></footer>
    </main>
  );
}
