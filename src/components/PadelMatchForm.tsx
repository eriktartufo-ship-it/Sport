"use client";

import { useState } from 'react';

type Player = { id: string; name: string };
type Side = 'A' | 'B' | null;
type SetScore = { a: number; b: number };

export type PadelSubmitPayload = {
  date: string;
  teamA: string[];
  teamB: string[];
  sets: { a: number; b: number }[];
};

type Props = {
  players: Player[];
  initialDate: string;
  initialAssign?: Record<string, Side>;
  initialSets?: SetScore[];
  submitLabel: string;
  onSubmit: (payload: PadelSubmitPayload) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
  deleting?: boolean;
};

const clampGame = (n: number) => Math.max(0, Math.min(30, Math.floor(n) || 0));

/** Un set concluso è valido: 6 con ≤4, oppure ai vantaggi 7-5/8-6… (scarto 2). */
function validSet(a: number, b: number): boolean {
  if (a === b) return false;
  const w = Math.max(a, b);
  const l = Math.min(a, b);
  if (w === 6 && l <= 4) return true;
  if (w >= 7 && w - l === 2) return true;
  return false;
}

export default function PadelMatchForm({
  players,
  initialDate,
  initialAssign = {},
  initialSets = [{ a: 6, b: 4 }],
  submitLabel,
  onSubmit,
  onDelete,
  onCancel,
  deleting = false,
}: Props) {
  const [assign, setAssign] = useState<Record<string, Side>>(initialAssign);
  const [sets, setSets] = useState<SetScore[]>(initialSets.length ? initialSets : [{ a: 6, b: 4 }]);
  const [date, setDate] = useState(initialDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counts = (() => {
    let a = 0;
    let b = 0;
    for (const v of Object.values(assign)) {
      if (v === 'A') a++;
      else if (v === 'B') b++;
    }
    return { a, b };
  })();

  // tap-cycle: libero → A (se A<2) → B (se B<2) → libero
  const cycle = (pid: string) => {
    setAssign((prev) => {
      const cur = prev[pid] ?? null;
      const next = { ...prev };
      if (cur === null) {
        if (counts.a < 2) next[pid] = 'A';
        else if (counts.b < 2) next[pid] = 'B';
      } else if (cur === 'A') {
        if (counts.b < 2) next[pid] = 'B';
        else next[pid] = null;
      } else {
        next[pid] = null;
      }
      return next;
    });
  };

  const addSet = () => setSets((s) => (s.length >= 5 ? s : [...s, { a: 0, b: 0 }]));
  const removeSet = (i: number) => setSets((s) => (s.length <= 1 ? s : s.filter((_, idx) => idx !== i)));
  const setGame = (i: number, side: 'a' | 'b', value: number) =>
    setSets((s) => s.map((st, idx) => (idx === i ? { ...st, [side]: clampGame(value) } : st)));

  const teamAPlayers = players.filter((p) => assign[p.id] === 'A');
  const teamBPlayers = players.filter((p) => assign[p.id] === 'B');
  const unassigned = players.filter((p) => !assign[p.id]);

  // vincitore live
  let setsA = 0;
  let setsB = 0;
  for (const s of sets) {
    if (s.a > s.b) setsA++;
    else if (s.b > s.a) setsB++;
  }

  const handleSubmit = async () => {
    setError(null);
    const teamA = teamAPlayers.map((p) => p.id);
    const teamB = teamBPlayers.map((p) => p.id);
    if (teamA.length !== 2 || teamB.length !== 2) {
      setError('Servono esattamente 2 giocatori per squadra.');
      return;
    }
    if (!sets.every((s) => validSet(s.a, s.b))) {
      setError('Controlla i set: 6 con 2 di scarto (es. 6-4) o ai vantaggi 7-5/8-6…');
      return;
    }
    if (setsA === setsB) {
      setError('La partita deve avere un vincitore: una squadra deve vincere più set.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ date, teamA, teamB, sets });
    } catch {
      setError('Errore nel salvataggio');
    }
    setSaving(false);
  };

  const canSave = counts.a === 2 && counts.b === 2 && setsA !== setsB && sets.every((s) => validSet(s.a, s.b));

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="card match-form-card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Data della partita</h2>
        <input
          type="date"
          className="input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ maxWidth: '220px', margin: '0 auto', borderRadius: '999px' }}
        />
      </div>

      {/* Squadre 2v2 (tap-cycle come 3v3) */}
      <div className="match-form-3v3">
        <div className="team3v3-pickers">
          <div className="team3v3-picker">
            <div className="team3v3-picker-head">
              <h3>Squadra A</h3>
              <span className={`team3v3-count${counts.a === 2 ? ' is-full' : ''}`}>{counts.a}/2</span>
            </div>
            <div className="team3v3-slots">
              {teamAPlayers.map((p) => (
                <button key={p.id} type="button" className="team3v3-slot is-filled" onClick={() => cycle(p.id)}>
                  {p.name} <span aria-hidden="true">✕</span>
                </button>
              ))}
              {Array.from({ length: 2 - teamAPlayers.length }).map((_, i) => (
                <div key={`empty-a-${i}`} className="team3v3-slot is-empty">—</div>
              ))}
            </div>
          </div>

          <div className="team3v3-picker">
            <div className="team3v3-picker-head">
              <h3>Squadra B</h3>
              <span className={`team3v3-count${counts.b === 2 ? ' is-full' : ''}`}>{counts.b}/2</span>
            </div>
            <div className="team3v3-slots">
              {teamBPlayers.map((p) => (
                <button key={p.id} type="button" className="team3v3-slot is-filled" onClick={() => cycle(p.id)}>
                  {p.name} <span aria-hidden="true">✕</span>
                </button>
              ))}
              {Array.from({ length: 2 - teamBPlayers.length }).map((_, i) => (
                <div key={`empty-b-${i}`} className="team3v3-slot is-empty">—</div>
              ))}
            </div>
          </div>
        </div>

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
                  className="player-pill ag-press"
                  disabled={counts.a >= 2 && counts.b >= 2}
                >
                  <span className="player-pill-name">{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Set */}
      <div className="card match-form-card" style={{ margin: '1.5rem 0' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>Punteggio (set)</h2>
        <p className="muted" style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Game della Squadra A e della Squadra B per ogni set. {setsA !== setsB
            ? `Vince Squadra ${setsA > setsB ? 'A' : 'B'} (${Math.max(setsA, setsB)}-${Math.min(setsA, setsB)}).`
            : 'Aggiungi il set decisivo per avere un vincitore.'}
        </p>
        <div className="padel-set-editor">
          {sets.map((s, i) => {
            const invalid = !validSet(s.a, s.b);
            return (
              <div key={i} className={`padel-set-row${invalid ? ' is-invalid' : ''}`}>
                <span className="padel-set-label">Set {i + 1}</span>
                <input
                  type="number"
                  min={0}
                  max={30}
                  className="input padel-set-input"
                  value={s.a}
                  onChange={(e) => setGame(i, 'a', Number(e.target.value))}
                  aria-label={`Game Squadra A set ${i + 1}`}
                />
                <span className="padel-set-sep">-</span>
                <input
                  type="number"
                  min={0}
                  max={30}
                  className="input padel-set-input"
                  value={s.b}
                  onChange={(e) => setGame(i, 'b', Number(e.target.value))}
                  aria-label={`Game Squadra B set ${i + 1}`}
                />
                {sets.length > 1 && (
                  <button type="button" className="icon-btn padel-set-remove" onClick={() => removeSet(i)} aria-label={`Rimuovi set ${i + 1}`}>
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {sets.length < 5 && (
          <button type="button" className="btn btn-pill btn-ghost ag-press padel-add-set" onClick={addSet}>
            + Aggiungi set
          </button>
        )}
      </div>

      {error && (
        <p className="muted" style={{ color: 'var(--danger)', textAlign: 'center', marginTop: '1rem' }}>{error}</p>
      )}

      <div className="edit-match-actions">
        {onDelete ? (
          <button className="btn btn-pill btn-danger btn-pair ag-press" type="button" onClick={onDelete} disabled={deleting || saving}>
            {deleting ? 'Cancellazione...' : '🗑️ Cancella partita'}
          </button>
        ) : (
          <button className="btn btn-pill btn-danger btn-pair ag-press" type="button" onClick={onCancel}>
            Annulla
          </button>
        )}
        {onDelete && (
          <button className="btn btn-pill btn-ghost btn-pair ag-press" type="button" onClick={onCancel}>
            Annulla
          </button>
        )}
        <button className="btn btn-pill btn-pair ag-press" type="button" onClick={handleSubmit} disabled={saving || !canSave}>
          {saving ? 'Salvataggio...' : submitLabel}
        </button>
      </div>
    </div>
  );
}
