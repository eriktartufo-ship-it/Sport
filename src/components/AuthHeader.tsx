"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function AuthHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setAuthenticated(!!data.authenticated);
      }
    } catch {
      setAuthenticated(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [pathname]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setPassword('');
        setShowLoginForm(false);
        setAuthenticated(true);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Password errata');
      }
    } catch {
      setError('Errore di connessione');
    }
    setSubmitting(false);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthenticated(false);
    router.refresh();
  };

  return (
    <header className="app-header">
      <Link href="/" className="app-header-brand">
        🏠 Home
      </Link>

      <div className="app-header-right">
        <Link href="/settings" className="app-header-link" title="Impostazioni">⚙️</Link>

        {authenticated === null ? null : authenticated ? (
          <>
            <span className="auth-pill auth-pill-on" title="Sei loggato come admin">🔓 Admin</span>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm">Logout</button>
          </>
        ) : showLoginForm ? (
          <form onSubmit={handleLogin} className="header-login-form">
            <input
              type="password"
              autoFocus
              placeholder="Password"
              className="input input-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit" className="btn btn-sm" disabled={submitting}>
              {submitting ? '...' : 'Entra'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => { setShowLoginForm(false); setError(null); }}
            >
              ✕
            </button>
            {error && <span className="header-login-error">{error}</span>}
          </form>
        ) : (
          <button onClick={() => setShowLoginForm(true)} className="btn btn-sm">
            🔑 Login
          </button>
        )}
      </div>
    </header>
  );
}
