"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Player = { id: string; name: string };

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Nuova partita di Machiavelli (carte): selezioni chi era al tavolo
 * (min 2, tap = toggle) e poi chi ha vinto (tap sulla pill = corona).
 * Chi tiene ancora le carte in mano perde: si registra solo il vincitore.
 */
export default function NewMatchMachiavelli() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [matchDate, setMatchDate] = useState<string>(todayIso());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((auth) => {
        if (!auth.authenticated) {
          alert('Devi effettuare il login per registrare una partita');
          router.push('/settings');
          return;
        }
        return fetch('/api/players')
          .then((r) => r.json())
          .then((data) => {
            setPlayers(data);
            setLoading(false);
          });
      })
      .catch((e) => {
        console.error(e);
        router.push('/machiavelli');
      });
  }, [router]);

  const toggle = (pid: string) => {
    setSelected((prev) => {
      const next = { ...prev, [pid]: !prev[pid] };
      if (!next[pid]) {
        // deselezionato: se era il vincitore, la corona salta
        setWinnerId((w) => (w === pid ? null : w));
      }
      return next;
    });
  };

  const selectedPlayers = players.filter((p) => selected[p.id]);

  const handleSave = async () => {
    setError(null);
    if (selectedPlayers.length < 2) {
      setError('Servono almeno 2 giocatori.');
      return;
    }
    if (!winnerId) {
      setError('Seleziona chi ha vinto.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/matches/machiavelli', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: matchDate,
          playerIds: selectedPlayers.map((p) => p.id),
          winnerId,
        }),
      });
      if (res.ok) {
        router.push('/machiavelli?tab=dati');
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Errore nel salvataggio');
      }
    } catch {
      setError('Errore di connessione');
    }
    setSaving(false);
  };

  if (loading) return <p>Caricamento giocatori...</p>;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h1 className="title match-form-title">Nuova Partita Machiavelli</h1>

      <div className="card match-form-card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Data della partita</h2>
        <input
          type="date"
          className="input"
          value={matchDate}
          max={todayIso()}
          onChange={(e) => setMatchDate(e.target.value)}
          style={{ maxWidth: '220px', margin: '0 auto', borderRadius: '999px' }}
        />
      </div>

      <div className="card match-form-card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>Chi era al tavolo?</h2>
        <p className="muted" style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Tap per aggiungere o togliere un giocatore (minimo 2).
        </p>
        <div className="player-picker-grid">
          {players.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className={`player-pill ag-press${selected[p.id] ? ' player-pill-selected' : ''}`}
            >
              <span className="player-pill-name">{p.name}</span>
              {selected[p.id] && <span className="player-pill-check">✓</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="card match-form-card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>Chi ha chiuso per primo?</h2>
        <p className="muted" style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Chi resta con le carte in mano perde. Tap sul vincitore.
        </p>
        {selectedPlayers.length < 2 ? (
          <p className="muted">Prima seleziona almeno 2 giocatori qui sopra.</p>
        ) : (
          <div className="player-picker-grid">
            {selectedPlayers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setWinnerId(p.id)}
                className={`player-pill ag-press${winnerId === p.id ? ' player-pill-winner' : ''}`}
                aria-pressed={winnerId === p.id}
              >
                {winnerId === p.id && (
                  <span key={p.id} className="ag-check-pop" aria-hidden="true">👑</span>
                )}
                <span className="player-pill-name">{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="muted" style={{ color: 'var(--danger)', textAlign: 'center', marginTop: '1rem' }}>
          {error}
        </p>
      )}

      <div className="edit-match-actions">
        <button
          className="btn btn-pill btn-danger btn-pair ag-press"
          type="button"
          onClick={() => router.push('/machiavelli')}
        >
          Annulla
        </button>
        <button
          className="btn btn-pill btn-pair ag-press"
          type="button"
          onClick={handleSave}
          disabled={saving || selectedPlayers.length < 2 || !winnerId}
        >
          {saving ? 'Salvataggio...' : 'Salva Partita'}
        </button>
      </div>
    </div>
  );
}
