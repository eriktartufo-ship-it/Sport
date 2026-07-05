"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Player = { id: string; name: string };

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const ordinal = (pos: number) => `${pos}°`;

/**
 * Nuova partita di Machiavelli (carte): si tocca ogni giocatore NELL'ORDINE in
 * cui ha finito le carte. Primo tap = 1° (vincitore, 0 punti), poi 2° (+1),
 * 3° (+2)... l'ultimo rimasto con le carte in mano prende più punti.
 * In classifica generale vince chi ha meno punti.
 */
export default function NewMatchMachiavelli() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<string[]>([]);
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

  // Tap: se non ancora in classifica → aggiungi in coda (posizione successiva).
  // Se già in classifica → rimuovilo e ricompatta le posizioni.
  const toggle = (pid: string) => {
    setOrder((prev) => (prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]));
  };

  const reset = () => setOrder([]);

  const handleSave = async () => {
    setError(null);
    if (order.length < 2) {
      setError('Servono almeno 2 giocatori.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/matches/machiavelli', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: matchDate, orderedPlayerIds: order }),
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
        <h2 style={{ marginBottom: '0.5rem' }}>Ordine di arrivo</h2>
        <p className="muted" style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Tocca i giocatori nell&apos;ordine in cui hanno finito le carte: il primo
          che chiude vince (0 punti), l&apos;ultimo rimasto con le carte in mano
          prende più punti. Tocca di nuovo per toglierlo.
        </p>
        <div className="player-picker-grid">
          {players.map((p) => {
            const idx = order.indexOf(p.id);
            const selected = idx >= 0;
            const pos = idx + 1;
            const pts = idx; // position - 1
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={`player-pill ag-press mk-order-pill${selected ? ' is-ranked' : ''}${pos === 1 ? ' player-pill-winner' : ''}`}
                aria-pressed={selected}
              >
                {selected && (
                  <span className={`mk-pos-badge ag-check-pop${pos === 1 ? ' is-winner' : ''}`} aria-hidden="true">
                    {pos === 1 ? '👑' : ordinal(pos)}
                  </span>
                )}
                <span className="player-pill-name">{p.name}</span>
                {selected && (
                  <span className="mk-pts-badge" aria-hidden="true">
                    {pts === 0 ? '0 pt' : `+${pts}`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
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
        <button className="btn btn-pill btn-ghost btn-pair ag-press" type="button" onClick={reset}>
          Azzera ordine
        </button>
        <button
          className="btn btn-pill btn-pair ag-press"
          type="button"
          onClick={handleSave}
          disabled={saving || order.length < 2}
        >
          {saving ? 'Salvataggio...' : 'Salva Partita'}
        </button>
      </div>
    </div>
  );
}
