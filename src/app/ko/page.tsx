"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function KODashboard() {
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [statsRes, authRes] = await Promise.all([
        fetch('/api/stats/ko'),
        fetch('/api/auth/me')
      ]);
      
      if (statsRes.ok) setStats(await statsRes.json());
      if (authRes.ok) setIsAuthenticated((await authRes.json()).authenticated);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    setAddingPlayer(true);
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPlayerName })
      });
      if (res.ok) {
        setNewPlayerName('');
        alert('Giocatore aggiunto!');
        loadStats();
      } else {
        const err = await res.json();
        alert(err.error || 'Errore');
      }
    } catch (e) {
      alert('Errore di connessione');
    }
    setAddingPlayer(false);
  };

  return (
    <div>
      <h1 className="title" style={{ fontSize: '2.5rem', textAlign: 'left' }}>Dashboard K.O.</h1>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {isAuthenticated ? (
          <Link href="/ko/new-match" className="btn">
            + Registra Partita
          </Link>
        ) : (
          <p style={{ color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>Effettua il login nelle Impostazioni per registrare nuove partite.</p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
        {/* Leaderboard Table */}
        <div className="card">
          <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Classifica Generale</h2>
          {loading ? (
            <p>Caricamento statistiche...</p>
          ) : stats.length === 0 ? (
            <p>Nessuna statistica disponibile. Registra la prima partita!</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <th style={{ padding: '1rem 0.5rem' }}>Pos</th>
                    <th style={{ padding: '1rem 0.5rem' }}>Giocatore</th>
                    <th style={{ padding: '1rem 0.5rem' }}>Score</th>
                    <th style={{ padding: '1rem 0.5rem' }}>Partite</th>
                    <th style={{ padding: '1rem 0.5rem' }}>Media Punti</th>
                    <th style={{ padding: '1rem 0.5rem' }} className="medal-gold">🥇 Oro</th>
                    <th style={{ padding: '1rem 0.5rem' }} className="medal-silver">🥈 Arg</th>
                    <th style={{ padding: '1rem 0.5rem' }} className="medal-bronze">🥉 Bro</th>
                    <th style={{ padding: '1rem 0.5rem' }}>% Sopravvivenza</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s, idx) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '1rem 0.5rem', fontWeight: 'bold' }}>{idx + 1}</td>
                      <td style={{ padding: '1rem 0.5rem' }}>{s.name}</td>
                      <td style={{ padding: '1rem 0.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>{s.score}</td>
                      <td style={{ padding: '1rem 0.5rem' }}>{s.matchesPlayed}</td>
                      <td style={{ padding: '1rem 0.5rem', color: 'rgba(255,255,255,0.7)' }}>{(s.score / (s.matchesPlayed || 1)).toFixed(1)}</td>
                      <td style={{ padding: '1rem 0.5rem' }}>{s.gold}</td>
                      <td style={{ padding: '1rem 0.5rem' }}>{s.silver}</td>
                      <td style={{ padding: '1rem 0.5rem' }}>{s.bronze}</td>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '50px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${s.podiumPercentage}%`, background: s.podiumPercentage > 50 ? '#10b981' : 'var(--primary)' }} />
                          </div>
                          <span style={{ fontSize: '0.85rem' }}>{s.podiumPercentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Player Sidebar */}
        <div className="card" style={{ alignSelf: 'start', background: 'linear-gradient(145deg, rgba(30,41,59,0.8), rgba(15,23,42,0.9))' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Aggiungi Giocatore</h2>
          {isAuthenticated ? (
            <form onSubmit={handleAddPlayer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input 
                type="text" 
                className="input" 
                placeholder="Nome giocatore..." 
                value={newPlayerName}
                onChange={e => setNewPlayerName(e.target.value)}
                required
              />
              <button type="submit" className="btn" disabled={addingPlayer}>
                {addingPlayer ? 'Aggiunta...' : 'Aggiungi'}
              </button>
            </form>
          ) : (
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>Effettua il login per aggiungere giocatori.</p>
          )}
        </div>
      </div>
    </div>
  );
}
