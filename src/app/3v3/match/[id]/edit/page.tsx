"use client";

import { useEffect, useMemo, useState, use } from 'react';
import { useRouter } from 'next/navigation';

type Player = { id: string; name: string };

const dateToIso = (d: string | Date) => {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

type Match3v3Resp = {
  id: string;
  date: string;
  teamAScore: number;
  teamBScore: number;
  results: { id: string; playerId: string; teamSide: 'A' | 'B'; player: Player }[];
};

const EMPTY_SLOT = '' as const;
type SlotValue = string;

export default function EditMatch3v3({ params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = use(params);
  const router = useRouter();

  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
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
  const [scoreA, setScoreA] = useState<number>(0);
  const [scoreB, setScoreB] = useState<number>(0);
  const [matchDate, setMatchDate] = useState<string>(dateToIso(new Date()));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const auth = await fetch('/api/auth/me').then((r) => r.json());
        if (!auth.authenticated) {
          alert('Devi effettuare il login per modificare una partita');
          router.push('/3v3');
          return;
        }
        const [matchRes, playersRes] = await Promise.all([
          fetch(`/api/matches/3v3/${matchId}`),
          fetch('/api/players?includeDeleted=1'),
        ]);
        if (!matchRes.ok) {
          setErrorMsg('Partita non trovata');
          setLoading(false);
          return;
        }
        const match: Match3v3Resp = await matchRes.json();
        const players: Player[] = await playersRes.json();
        setAllPlayers(players);
        setMatchDate(dateToIso(match.date));
        setScoreA(match.teamAScore);
        setScoreB(match.teamBScore);

        // Fill slots dall'ordine "naturale" dei results (resta deterministico).
        const aIds = match.results.filter((r) => r.teamSide === 'A').map((r) => r.playerId);
        const bIds = match.results.filter((r) => r.teamSide === 'B').map((r) => r.playerId);
        setSlotsA([
          aIds[0] ?? EMPTY_SLOT,
          aIds[1] ?? EMPTY_SLOT,
          aIds[2] ?? EMPTY_SLOT,
        ]);
        setSlotsB([
          bIds[0] ?? EMPTY_SLOT,
          bIds[1] ?? EMPTY_SLOT,
          bIds[2] ?? EMPTY_SLOT,
        ]);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setErrorMsg('Errore di connessione');
        setLoading(false);
      }
    })();
  }, [matchId, router]);

  const selectedIds = useMemo(
    () => new Set<string>([...slotsA, ...slotsB].filter((v) => v !== EMPTY_SLOT)),
    [slotsA, slotsB]
  );

  const optionsFor = (currentValue: SlotValue): Player[] => {
    return allPlayers.filter((p) => p.id === currentValue || !selectedIds.has(p.id));
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

  const handleSave = async () => {
    setErrorMsg(null);
    const teamA = slotsA.filter((v) => v !== EMPTY_SLOT);
    const teamB = slotsB.filter((v) => v !== EMPTY_SLOT);
    if (teamA.length !== 3 || teamB.length !== 3) {
      setErrorMsg('Servono esattamente 3 giocatori per squadra.');
      return;
    }
    if (scoreA === scoreB) {
      setErrorMsg('I punteggi non possono essere uguali.');
      return;
    }
    if (Math.max(scoreA, scoreB) !== 21) {
      setErrorMsg('Il vincitore deve arrivare a 21 punti.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/matches/3v3/${matchId}`, {
        method: 'PATCH',
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
        setErrorMsg(err.error || 'Errore nel salvataggio');
      }
    } catch {
      setErrorMsg('Errore di connessione');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm('Cancellare definitivamente questa partita? Azione irreversibile.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/matches/3v3/${matchId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/3v3?tab=dati');
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || 'Errore nella cancellazione');
      }
    } catch {
      setErrorMsg('Errore di connessione');
    }
    setDeleting(false);
  };

  if (loading) return <p>Caricamento...</p>;
  if (errorMsg && !allPlayers.length) return <p style={{ color: 'var(--danger)' }}>{errorMsg}</p>;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h1 className="title match-form-title">Modifica Partita 3vs3</h1>

      <div className="card match-form-card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Data della partita</h2>
        <input
          type="date"
          className="input"
          value={matchDate}
          max={dateToIso(new Date())}
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

      {errorMsg && (
        <p className="muted" style={{ color: '#ef4444', textAlign: 'center', marginTop: '1rem' }}>
          {errorMsg}
        </p>
      )}

      <div className="edit-match-actions">
        <button
          className="btn btn-pill btn-danger btn-pair"
          type="button"
          onClick={handleDelete}
          disabled={deleting || saving}
        >
          {deleting ? 'Cancellazione...' : '🗑️ Cancella partita'}
        </button>
        <button className="btn btn-pill btn-ghost btn-pair" type="button" onClick={() => router.push('/3v3?tab=dati')}>
          Annulla
        </button>
        <button
          className="btn btn-pill btn-pair"
          type="button"
          onClick={handleSave}
          disabled={saving || countA !== 3 || countB !== 3}
        >
          {saving ? 'Salvataggio...' : 'Salva modifiche'}
        </button>
      </div>
    </div>
  );
}
