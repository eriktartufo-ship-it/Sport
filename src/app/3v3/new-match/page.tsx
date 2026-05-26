"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Player = { id: string; name: string };
type Side = 'A' | 'B' | null;

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * UI veloce: click su un player → vola in Squadra A (se A < 3);
 * click di nuovo sullo stesso → si sposta in B (se B < 3);
 * terzo click → torna libero.
 * Se A piena al primo click, va direttamente in B.
 * Se B piena al secondo click, torna libero.
 */
export default function NewMatch3v3() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [assign, setAssign] = useState<Record<string, Side>>({});
  const [scoreA, setScoreA] = useState<number>(21);
  const [scoreB, setScoreB] = useState<number>(0);
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
        router.push('/3v3');
      });
  }, [router]);

  const counts = (() => {
    let a = 0;
    let b = 0;
    for (const v of Object.values(assign)) {
      if (v === 'A') a++;
      else if (v === 'B') b++;
    }
    return { a, b };
  })();

  const cycle = (pid: string) => {
    setAssign((prev) => {
      const cur = prev[pid] ?? null;
      const next: Record<string, Side> = { ...prev };
      if (cur === null) {
        // libero → tenta A, poi B, poi resta libero
        if (counts.a < 3) next[pid] = 'A';
        else if (counts.b < 3) next[pid] = 'B';
      } else if (cur === 'A') {
        // A → tenta B, poi libero
        if (counts.b < 3) next[pid] = 'B';
        else next[pid] = null;
      } else {
        // B → libero
        next[pid] = null;
      }
      return next;
    });
  };

  const reset = () => {
    setAssign({});
    setScoreA(21);
    setScoreB(0);
  };

  const handleSave = async () => {
    setError(null);
    const teamA = players.filter((p) => assign[p.id] === 'A').map((p) => p.id);
    const teamB = players.filter((p) => assign[p.id] === 'B').map((p) => p.id);
    if (teamA.length !== 3 || teamB.length !== 3) {
      setError('Servono esattamente 3 giocatori per squadra.');
      return;
    }
    if (scoreA === scoreB) {
      setError('I punteggi non possono essere uguali (no pareggio).');
      return;
    }
    if (Math.max(scoreA, scoreB) !== 21) {
      setError('Il vincitore deve arrivare a 21 punti.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/matches/3v3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: matchDate,
          teamA,
          teamB,
          teamAScore: scoreA,
          teamBScore: scoreB,
        }),
      });
      if (res.ok) {
        router.push('/3v3?tab=dati');
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

  const teamAPlayers = players.filter((p) => assign[p.id] === 'A');
  const teamBPlayers = players.filter((p) => assign[p.id] === 'B');
  const unassigned = players.filter((p) => !assign[p.id]);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h1 className="title match-form-title">Nuova Partita 3vs3</h1>

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

      <div className="match-form-3v3">
        {/* Riga superiore: le 2 squadre affiancate desktop, stacked mobile */}
        <div className="team3v3-pickers">
          <div className="team3v3-picker">
            <div className="team3v3-picker-head">
              <h3>Squadra A</h3>
              <span className={`team3v3-count${counts.a === 3 ? ' is-full' : ''}`}>{counts.a}/3</span>
            </div>
            <input
              type="number"
              min={0}
              max={21}
              className="input team3v3-score-input"
              value={scoreA}
              onChange={(e) => setScoreA(Math.max(0, Math.min(21, Number(e.target.value) || 0)))}
              aria-label="Punti squadra A"
            />
            <div className="team3v3-slots">
              {teamAPlayers.map((p) => (
                <button key={p.id} type="button" className="team3v3-slot is-filled" onClick={() => cycle(p.id)}>
                  {p.name} <span aria-hidden="true">✕</span>
                </button>
              ))}
              {Array.from({ length: 3 - teamAPlayers.length }).map((_, i) => (
                <div key={`empty-a-${i}`} className="team3v3-slot is-empty">—</div>
              ))}
            </div>
          </div>

          <div className="team3v3-picker">
            <div className="team3v3-picker-head">
              <h3>Squadra B</h3>
              <span className={`team3v3-count${counts.b === 3 ? ' is-full' : ''}`}>{counts.b}/3</span>
            </div>
            <input
              type="number"
              min={0}
              max={21}
              className="input team3v3-score-input"
              value={scoreB}
              onChange={(e) => setScoreB(Math.max(0, Math.min(21, Number(e.target.value) || 0)))}
              aria-label="Punti squadra B"
            />
            <div className="team3v3-slots">
              {teamBPlayers.map((p) => (
                <button key={p.id} type="button" className="team3v3-slot is-filled" onClick={() => cycle(p.id)}>
                  {p.name} <span aria-hidden="true">✕</span>
                </button>
              ))}
              {Array.from({ length: 3 - teamBPlayers.length }).map((_, i) => (
                <div key={`empty-b-${i}`} className="team3v3-slot is-empty">—</div>
              ))}
            </div>
          </div>
        </div>

        {/* Lista giocatori non assegnati. Click = cycle (A→B→libero). */}
        <div className="card match-form-card" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>Giocatori disponibili</h2>
          <p className="muted" style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '0.85rem' }}>
            Tap = assegna a Squadra A. Tap di nuovo = sposta in B. Tap ancora = rimuovi.
          </p>
          {unassigned.length === 0 ? (
            <p className="muted">Tutti i giocatori sono assegnati. Tappa uno slot per liberarlo.</p>
          ) : (
            <div className="player-picker-grid">
              {unassigned.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => cycle(p.id)}
                  className="player-pill"
                  disabled={counts.a >= 3 && counts.b >= 3}
                >
                  <span className="player-pill-name">{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="muted" style={{ color: '#ef4444', textAlign: 'center', marginTop: '1rem' }}>
          {error}
        </p>
      )}

      <div className="edit-match-actions">
        <button className="btn btn-pill btn-ghost btn-pair" type="button" onClick={reset}>
          Reset
        </button>
        <button
          className="btn btn-pill btn-pair"
          type="button"
          onClick={handleSave}
          disabled={saving || counts.a !== 3 || counts.b !== 3}
        >
          {saving ? 'Salvataggio...' : 'Salva Partita'}
        </button>
      </div>
    </div>
  );
}
