"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Player = { id: string; name: string };

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const EMPTY_SLOT = '' as const;
type SlotValue = string; // playerId oppure '' per vuoto

/**
 * UI semplice: 6 tendine (3 Squadra A + 3 Squadra B). Ogni slot mostra
 * solo i player NON già selezionati negli altri 5 slot. Cambiando uno
 * slot, il vecchio player torna disponibile per gli altri.
 */
export default function NewMatch3v3() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotsA, setSlotsA] = useState<[SlotValue, SlotValue, SlotValue]>([
    EMPTY_SLOT,
    EMPTY_SLOT,
    EMPTY_SLOT,
  ]);
  const [slotsB, setSlotsB] = useState<[SlotValue, SlotValue, SlotValue]>([
    EMPTY_SLOT,
    EMPTY_SLOT,
    EMPTY_SLOT,
  ]);
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

  // Tutti gli id già selezionati (qualsiasi slot)
  const selectedIds = useMemo(
    () => new Set<string>([...slotsA, ...slotsB].filter((v) => v !== EMPTY_SLOT)),
    [slotsA, slotsB]
  );

  /**
   * Per un dato slot ritorna l'elenco delle option: vuoto + tutti i
   * player non assegnati altrove + il player corrente di QUESTO slot
   * (così resta selezionabile/mostrato senza scomparire dal proprio dropdown).
   */
  const optionsFor = (currentValue: SlotValue): Player[] => {
    return players.filter((p) => p.id === currentValue || !selectedIds.has(p.id));
  };

  const countA = slotsA.filter((v) => v !== EMPTY_SLOT).length;
  const countB = slotsB.filter((v) => v !== EMPTY_SLOT).length;

  const setSlot = (side: 'A' | 'B', idx: 0 | 1 | 2, value: SlotValue) => {
    if (side === 'A') {
      setSlotsA((prev) => {
        const next = [...prev] as [SlotValue, SlotValue, SlotValue];
        next[idx] = value;
        return next;
      });
    } else {
      setSlotsB((prev) => {
        const next = [...prev] as [SlotValue, SlotValue, SlotValue];
        next[idx] = value;
        return next;
      });
    }
  };

  const reset = () => {
    setSlotsA([EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT]);
    setSlotsB([EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT]);
    setScoreA(21);
    setScoreB(0);
  };

  const handleSave = async () => {
    setError(null);
    const teamA = slotsA.filter((v) => v !== EMPTY_SLOT);
    const teamB = slotsB.filter((v) => v !== EMPTY_SLOT);
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

      <div className="team3v3-pickers">
        <div className="team3v3-picker">
          <div className="team3v3-picker-head">
            <h3>Squadra A</h3>
            <span className={`team3v3-count${countA === 3 ? ' is-full' : ''}`}>{countA}/3</span>
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
            {([0, 1, 2] as const).map((idx) => (
              <select
                key={`a-${idx}`}
                className="input team3v3-slot-select"
                value={slotsA[idx]}
                onChange={(e) => setSlot('A', idx, e.target.value)}
                aria-label={`Squadra A, slot ${idx + 1}`}
              >
                <option value="">— Slot {idx + 1} —</option>
                {optionsFor(slotsA[idx]).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            ))}
          </div>
        </div>

        <div className="team3v3-picker">
          <div className="team3v3-picker-head">
            <h3>Squadra B</h3>
            <span className={`team3v3-count${countB === 3 ? ' is-full' : ''}`}>{countB}/3</span>
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
            {([0, 1, 2] as const).map((idx) => (
              <select
                key={`b-${idx}`}
                className="input team3v3-slot-select"
                value={slotsB[idx]}
                onChange={(e) => setSlot('B', idx, e.target.value)}
                aria-label={`Squadra B, slot ${idx + 1}`}
              >
                <option value="">— Slot {idx + 1} —</option>
                {optionsFor(slotsB[idx]).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            ))}
          </div>
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
          disabled={saving || countA !== 3 || countB !== 3}
        >
          {saving ? 'Salvataggio...' : 'Salva Partita'}
        </button>
      </div>
    </div>
  );
}
