"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';

type Player = { id: string; name: string };
type Side = 'A' | 'B' | null;

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

export default function EditMatch3v3({ params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = use(params);
  const router = useRouter();

  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [assign, setAssign] = useState<Record<string, Side>>({});
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
        const a: Record<string, Side> = {};
        for (const r of match.results) {
          a[r.playerId] = r.teamSide;
        }
        setAssign(a);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setErrorMsg('Errore di connessione');
        setLoading(false);
      }
    })();
  }, [matchId, router]);

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
        if (counts.a < 3) next[pid] = 'A';
        else if (counts.b < 3) next[pid] = 'B';
      } else if (cur === 'A') {
        if (counts.b < 3) next[pid] = 'B';
        else next[pid] = null;
      } else {
        next[pid] = null;
      }
      return next;
    });
  };

  const handleSave = async () => {
    setErrorMsg(null);
    const teamA = allPlayers.filter((p) => assign[p.id] === 'A').map((p) => p.id);
    const teamB = allPlayers.filter((p) => assign[p.id] === 'B').map((p) => p.id);
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

  const teamAPlayers = allPlayers.filter((p) => assign[p.id] === 'A');
  const teamBPlayers = allPlayers.filter((p) => assign[p.id] === 'B');
  const unassigned = allPlayers.filter((p) => !assign[p.id]);

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

      <div className="match-form-3v3">
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

        <div className="card match-form-card" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>Giocatori disponibili</h2>
          {unassigned.length === 0 ? (
            <p className="muted">Tutti i giocatori sono assegnati.</p>
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
          disabled={saving || counts.a !== 3 || counts.b !== 3}
        >
          {saving ? 'Salvataggio...' : 'Salva modifiche'}
        </button>
      </div>
    </div>
  );
}
