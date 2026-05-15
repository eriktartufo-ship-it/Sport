"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';

type Player = { id: string; name: string };
type Medal = 'GOLD' | 'SILVER' | 'BRONZE' | 'NONE';

const dateToIso = (d: string | Date) => {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function EditKOMatch({ params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = use(params);
  const router = useRouter();

  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [medals, setMedals] = useState<Record<string, Medal>>({});
  const [matchDate, setMatchDate] = useState<string>(dateToIso(new Date()));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const auth = await fetch('/api/auth/me').then((r) => r.json());
        if (!auth.authenticated) {
          alert('Devi effettuare il login per modificare una partita');
          router.push('/ko');
          return;
        }
        setAuthChecked(true);

        const [matchRes, playersRes] = await Promise.all([
          fetch(`/api/matches/ko/${matchId}`),
          fetch('/api/players'),
        ]);
        if (!matchRes.ok) {
          setErrorMsg('Partita non trovata');
          setLoading(false);
          return;
        }
        const match = await matchRes.json();
        const players: Player[] = await playersRes.json();
        setAllPlayers(players);

        setMatchDate(dateToIso(match.date));
        const sel: string[] = [];
        const med: Record<string, Medal> = {};
        for (const r of match.results) {
          sel.push(r.playerId);
          med[r.playerId] = r.medal as Medal;
        }
        setSelectedPlayers(sel);
        setMedals(med);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setErrorMsg('Errore di connessione');
        setLoading(false);
      }
    })();
  }, [matchId, router]);

  const togglePlayer = (id: string) => {
    setSelectedPlayers((prev) => {
      if (prev.includes(id)) {
        const newMedals = { ...medals };
        delete newMedals[id];
        setMedals(newMedals);
        return prev.filter((p) => p !== id);
      }
      return [...prev, id];
    });
  };

  const assignMedal = (id: string, medal: Medal) => {
    setMedals((prev) => {
      const newMedals = { ...prev };
      if (medal !== 'NONE') {
        Object.keys(newMedals).forEach((pid) => {
          if (newMedals[pid] === medal) newMedals[pid] = 'NONE';
        });
      }
      newMedals[id] = medal;
      return newMedals;
    });
  };

  const handleSave = async () => {
    if (selectedPlayers.length < 3) {
      alert('Servono almeno 3 giocatori per una partita K.O.');
      return;
    }

    const results = selectedPlayers.map((id) => ({
      playerId: id,
      medal: medals[id] || 'NONE',
    }));

    if (!results.some((r) => r.medal === 'GOLD')) {
      alert("Devi assegnare l'Oro!");
      return;
    }
    if (selectedPlayers.length >= 4 && !results.some((r) => r.medal === 'SILVER')) {
      alert("Con 4 o più giocatori devi assegnare l'Argento!");
      return;
    }
    if (selectedPlayers.length >= 5 && !results.some((r) => r.medal === 'BRONZE')) {
      alert('Con 5 o più giocatori devi assegnare il Bronzo!');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/matches/ko/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results, date: matchDate }),
      });
      if (res.ok) {
        alert('Partita aggiornata!');
        router.push('/ko');
        router.refresh();
      } else {
        const err = await res.json();
        alert(err.error || 'Errore nel salvataggio');
      }
    } catch {
      alert('Errore di connessione');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm('Cancellare definitivamente questa partita? Verranno persi tutti i risultati associati. Azione irreversibile.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/matches/ko/${matchId}`, { method: 'DELETE' });
      if (res.ok) {
        alert('Partita cancellata.');
        router.push('/ko');
        router.refresh();
      } else {
        const err = await res.json();
        alert(err.error || 'Errore nella cancellazione');
      }
    } catch {
      alert('Errore di connessione');
    }
    setDeleting(false);
  };

  if (!authChecked || loading) return <p>Caricamento...</p>;
  if (errorMsg) return <p style={{ color: 'var(--danger)' }}>{errorMsg}</p>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 className="title match-form-title">Modifica Partita K.O.</h1>

      <div className="card match-form-card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Data della partita</h2>
        <input
          type="date"
          className="input"
          value={matchDate}
          max={dateToIso(new Date())}
          onChange={(e) => setMatchDate(e.target.value)}
          style={{ maxWidth: '220px', margin: '0 auto' }}
        />
      </div>

      <div className="card match-form-card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>1. Partecipanti</h2>
        <div className="player-picker-grid">
          {allPlayers.map((p) => {
            const isSelected = selectedPlayers.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePlayer(p.id)}
                className={`player-pill${isSelected ? ' player-pill-selected' : ''}`}
              >
                <span className="player-pill-name">{p.name}</span>
                {isSelected && <span className="player-pill-check" aria-hidden="true">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {selectedPlayers.length > 0 && (
        <div className="card match-form-card animate-fade-in" style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>2. Medaglie</h2>
          <p style={{ marginBottom: '1rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
            Giocatori: <strong>{selectedPlayers.length}</strong>
            {selectedPlayers.length < 3 && <span style={{ color: '#ef4444', marginLeft: '10px' }}>(min 3)</span>}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {selectedPlayers.map((id) => {
              const player = allPlayers.find((p) => p.id === id);
              const currentMedal = medals[id] || 'NONE';
              return (
                <div key={id} className="medal-row">
                  <span className="medal-row-name">{player?.name || '(rimosso)'}</span>
                  <div className="medal-row-buttons">
                    <button
                      onClick={() => assignMedal(id, 'GOLD')}
                      className="btn btn-sm medal-pick"
                      style={{ color: currentMedal === 'GOLD' ? 'var(--gold)' : 'rgba(255,255,255,0.3)', background: currentMedal === 'GOLD' ? 'rgba(251, 191, 36, 0.2)' : 'transparent', border: '1px solid currentColor' }}
                    >🥇 Oro</button>
                    {selectedPlayers.length >= 4 && (
                      <button
                        onClick={() => assignMedal(id, 'SILVER')}
                        className="btn btn-sm medal-pick"
                        style={{ color: currentMedal === 'SILVER' ? 'var(--silver)' : 'rgba(255,255,255,0.3)', background: currentMedal === 'SILVER' ? 'rgba(148, 163, 184, 0.2)' : 'transparent', border: '1px solid currentColor' }}
                      >🥈 Arg</button>
                    )}
                    {selectedPlayers.length >= 5 && (
                      <button
                        onClick={() => assignMedal(id, 'BRONZE')}
                        className="btn btn-sm medal-pick"
                        style={{ color: currentMedal === 'BRONZE' ? 'var(--bronze)' : 'rgba(255,255,255,0.3)', background: currentMedal === 'BRONZE' ? 'rgba(180, 83, 9, 0.2)' : 'transparent', border: '1px solid currentColor' }}
                      >🥉 Bro</button>
                    )}
                    <button
                      onClick={() => assignMedal(id, 'NONE')}
                      className="btn btn-sm medal-pick"
                      style={{ background: currentMedal === 'NONE' ? 'rgba(255,255,255,0.1)' : 'transparent', border: '1px solid rgba(255,255,255,0.2)' }}
                    >❌</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="edit-match-actions">
        <button
          className="btn btn-pill btn-danger"
          onClick={handleDelete}
          disabled={deleting || saving}
        >
          {deleting ? 'Cancellazione...' : '🗑️ Cancella partita'}
        </button>
        <button className="btn btn-pill btn-ghost" onClick={() => router.push('/ko')}>Annulla</button>
        <button className="btn btn-pill" onClick={handleSave} disabled={saving || selectedPlayers.length < 3}>
          {saving ? 'Salvataggio...' : 'Salva modifiche'}
        </button>
      </div>
    </div>
  );
}
