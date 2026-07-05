"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';

type Player = { id: string; name: string };

const dateToIso = (d: string | Date) => {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const ordinal = (pos: number) => `${pos}°`;

type MatchMachiavelliResp = {
  id: string;
  date: string;
  results: { id: string; playerId: string; position: number; player: Player }[];
};

export default function EditMatchMachiavelli({ params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = use(params);
  const router = useRouter();

  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [order, setOrder] = useState<string[]>([]);
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
          router.push('/machiavelli');
          return;
        }
        const [matchRes, playersRes] = await Promise.all([
          fetch(`/api/matches/machiavelli/${matchId}`),
          fetch('/api/players?includeDeleted=1'),
        ]);
        if (!matchRes.ok) {
          setErrorMsg('Partita non trovata');
          setLoading(false);
          return;
        }
        const match: MatchMachiavelliResp = await matchRes.json();
        const players: Player[] = await playersRes.json();
        setAllPlayers(players);
        setMatchDate(dateToIso(match.date));
        // results già ordinati per position asc dall'API
        setOrder([...match.results].sort((a, b) => a.position - b.position).map((r) => r.playerId));
        setLoading(false);
      } catch (e) {
        console.error(e);
        setErrorMsg('Errore di connessione');
        setLoading(false);
      }
    })();
  }, [matchId, router]);

  const toggle = (pid: string) => {
    setOrder((prev) => (prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]));
  };

  const handleSave = async () => {
    setErrorMsg(null);
    if (order.length < 2) {
      setErrorMsg('Servono almeno 2 giocatori.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/matches/machiavelli/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: matchDate, orderedPlayerIds: order }),
      });
      if (res.ok) {
        router.push('/machiavelli?tab=dati');
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
      const res = await fetch(`/api/matches/machiavelli/${matchId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/machiavelli?tab=dati');
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
      <h1 className="title match-form-title">Modifica Partita Machiavelli</h1>

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

      <div className="card match-form-card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>Ordine di arrivo</h2>
        <p className="muted" style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Tocca i giocatori nell&apos;ordine in cui hanno finito le carte. Tocca di nuovo per toglierlo.
        </p>
        <div className="player-picker-grid">
          {allPlayers.map((p) => {
            const idx = order.indexOf(p.id);
            const selected = idx >= 0;
            const pos = idx + 1;
            const pts = idx;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={`player-pill ag-press mk-order-pill${selected ? ' is-ranked' : ''}${pos === 1 ? ' player-pill-winner' : ''}`}
                aria-pressed={selected}
              >
                {selected && (
                  <span className={`mk-pos-badge${pos === 1 ? ' is-winner' : ''}`} aria-hidden="true">
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

      {errorMsg && (
        <p className="muted" style={{ color: 'var(--danger)', textAlign: 'center', marginTop: '1rem' }}>
          {errorMsg}
        </p>
      )}

      <div className="edit-match-actions">
        <button
          className="btn btn-pill btn-danger btn-pair ag-press"
          type="button"
          onClick={handleDelete}
          disabled={deleting || saving}
        >
          {deleting ? 'Cancellazione...' : '🗑️ Cancella partita'}
        </button>
        <button className="btn btn-pill btn-ghost btn-pair ag-press" type="button" onClick={() => router.push('/machiavelli?tab=dati')}>
          Annulla
        </button>
        <button
          className="btn btn-pill btn-pair ag-press"
          type="button"
          onClick={handleSave}
          disabled={saving || order.length < 2}
        >
          {saving ? 'Salvataggio...' : 'Salva modifiche'}
        </button>
      </div>
    </div>
  );
}
