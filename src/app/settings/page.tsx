"use client";

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        setIsAuthenticated(data.authenticated);
        setLoading(false);
      });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    
    if (res.ok) {
      setIsAuthenticated(true);
      setPassword('');
      // Ricarica per forzare l'aggiornamento dei cookie in tutto il browser
      window.location.reload();
    } else {
      alert('Password errata');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsAuthenticated(false);
    window.location.reload();
  };

  const handleExport = () => {
    window.location.href = '/api/db/export';
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    if (!confirm('ATTENZIONE: Questo sovrascriverà l\'intero database. Sei sicuro?')) return;

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/db/import', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      alert('Database importato con successo!');
      window.location.reload();
    } else {
      alert('Errore durante l\'importazione');
    }
  };

  if (loading) return <p>Caricamento...</p>;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 0' }}>
      {/* Brand AuthHeader (in alto-sx) gia' linka alla home. */}
      <h1 className="title" style={{ fontSize: '2.5rem', textAlign: 'left' }}>Impostazioni</h1>

      {!isAuthenticated ? (
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>Accesso Amministratore</h2>
          <p style={{ marginBottom: '1.5rem', color: 'rgba(255,255,255,0.7)' }}>
            Inserisci la password master per sbloccare le modifiche (aggiunta partite, giocatori) e la gestione del database.
          </p>
          <form onSubmit={handleLogin} style={{ display: 'flex', gap: '1rem' }}>
            <input 
              type="password" 
              className="input" 
              placeholder="Password..." 
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button type="submit" className="btn">Accedi</button>
          </form>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="card">
            <h2 style={{ marginBottom: '1rem', color: '#10b981' }}>✓ Autenticato</h2>
            <p style={{ marginBottom: '1.5rem', color: 'rgba(255,255,255,0.7)' }}>
              Sei loggato come amministratore. Puoi registrare nuove partite e modificare i dati.
            </p>
            <button onClick={handleLogout} className="btn btn-danger">Esci</button>
          </div>

          <div className="card">
            <h2 style={{ marginBottom: '1rem' }}>Esporta in CSV</h2>
            <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
              Scarica classifica e cronologia come file CSV (apribili in Excel / Google Sheets / Numbers).
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
              <a
                href="/api/export/csv/leaderboard"
                className="btn"
                style={{ background: 'var(--primary)', textDecoration: 'none' }}
              >📊 Classifica</a>
              <a
                href="/api/export/csv/matches"
                className="btn"
                style={{ background: 'var(--primary)', textDecoration: 'none' }}
              >📋 Cronologia</a>
            </div>
          </div>

          <div className="card">
            <h2 style={{ marginBottom: '1rem' }}>Gestione Database (backup completo)</h2>

            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>Esporta Dati</h3>
              <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                Scarica una copia locale del database SQLite completo (binario).
              </p>
              <button onClick={handleExport} className="btn" style={{ background: 'var(--primary)' }}>
                ⬇️ Scarica dev.db
              </button>
            </div>

            <hr style={{ borderColor: 'rgba(255,255,255,0.1)', marginBottom: '1.5rem' }} />

            <div>
              <h3 style={{ marginBottom: '0.5rem' }}>Importa Dati</h3>
              <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#ef4444' }}>
                Attenzione: caricare un file .db sovrascriverà tutti i dati attuali.
              </p>
              <input
                type="file"
                accept=".db"
                onChange={handleImport}
                className="file-input-pill"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
