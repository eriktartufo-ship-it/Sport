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
    <div className="settings-wrap">
      <h1 className="title">Impostazioni</h1>

      {!isAuthenticated ? (
        <div className="card settings-card">
          <h2 className="card-title">Accesso Amministratore</h2>
          <p className="settings-text">
            Inserisci la password master per sbloccare le modifiche (aggiunta partite, giocatori) e la gestione del database.
          </p>
          <form onSubmit={handleLogin} className="settings-row settings-row-form">
            <input
              type="password"
              className="input settings-input"
              placeholder="Password..."
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button type="submit" className="btn btn-pill">Accedi</button>
          </form>
        </div>
      ) : (
        <div className="settings-stack">
          <div className="card settings-card">
            <h2 className="card-title" style={{ color: '#10b981' }}>✓ Autenticato</h2>
            <p className="settings-text">
              Sei loggato come amministratore. Puoi registrare nuove partite e modificare i dati.
            </p>
            <div className="settings-row">
              <button onClick={handleLogout} className="btn btn-pill btn-danger">Esci</button>
            </div>
          </div>

          <div className="card settings-card">
            <h2 className="card-title">Esporta in CSV</h2>
            <p className="settings-text">
              Backup leggibile e durevole, un file per sport (apribile in Excel / Google Sheets / Numbers):
              matchId, data, giocatori e punteggi. Così puoi ricostruire tutto anche se l&apos;app si rompe.
            </p>

            <div className="settings-section">
              <h3 className="settings-subtitle">Cronologia per sport</h3>
              <div className="settings-row">
                <a href="/api/export/csv/matches?sport=ko" className="btn btn-pill" style={{ textDecoration: 'none' }}>📋 K.O.</a>
                <a href="/api/export/csv/matches?sport=3v3" className="btn btn-pill" style={{ textDecoration: 'none' }}>📋 3v3</a>
                <a href="/api/export/csv/matches?sport=machiavelli" className="btn btn-pill" style={{ textDecoration: 'none' }}>📋 Machiavelli</a>
                <a href="/api/export/csv/matches?sport=padel" className="btn btn-pill" style={{ textDecoration: 'none' }}>📋 Padel</a>
              </div>
            </div>

            <hr className="settings-divider" />

            <div className="settings-section">
              <h3 className="settings-subtitle">Classifica per sport</h3>
              <div className="settings-row">
                <a href="/api/export/csv/leaderboard?sport=ko" className="btn btn-pill" style={{ textDecoration: 'none' }}>📊 K.O.</a>
                <a href="/api/export/csv/leaderboard?sport=3v3" className="btn btn-pill" style={{ textDecoration: 'none' }}>📊 3v3</a>
                <a href="/api/export/csv/leaderboard?sport=machiavelli" className="btn btn-pill" style={{ textDecoration: 'none' }}>📊 Machiavelli</a>
                <a href="/api/export/csv/leaderboard?sport=padel" className="btn btn-pill" style={{ textDecoration: 'none' }}>📊 Padel</a>
              </div>
            </div>
          </div>

          <div className="card settings-card">
            <h2 className="card-title">Gestione Database (backup completo)</h2>

            <div className="settings-section">
              <h3 className="settings-subtitle">Esporta Dati</h3>
              <p className="settings-text">
                Scarica una copia locale del database SQLite completo (binario).
              </p>
              <div className="settings-row">
                <button onClick={handleExport} className="btn btn-pill">
                  ⬇️ Scarica dev.db
                </button>
              </div>
            </div>

            <hr className="settings-divider" />

            <div className="settings-section">
              <h3 className="settings-subtitle">Importa Dati</h3>
              <p className="settings-text settings-text-warning">
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
