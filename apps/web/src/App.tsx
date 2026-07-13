import { useEffect, useState } from 'react';

type Health = { status: string; service: string; timestamp: string };

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL ?? '/api';
    fetch(`${apiUrl}/health`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: Health) => setHealth(data))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main className="shell">
      <h1>ReachFlow AI</h1>
      <p className="tagline">AI-powered cold email &amp; lead generation — Milestone 1 scaffold.</p>
      <section className="status">
        <span className="label">API status:</span>{' '}
        {health ? (
          <span className="ok">{health.status} · {health.service}</span>
        ) : error ? (
          <span className="err">unreachable ({error})</span>
        ) : (
          <span className="pending">checking…</span>
        )}
      </section>
    </main>
  );
}
