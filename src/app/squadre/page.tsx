"use client";

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  MIN_TEAMS,
  makeRandomTeams,
  maxTeams,
  shuffle,
  teamLetter,
  teamSizes,
  teamsProblem,
  type RandomTeams,
} from '@/lib/random-teams';

type Player = { id: string; name: string };
type Phase = 'idle' | 'shuffling' | 'done';
type Point = { x: number; y: number };
type FlipPlan = { duration: number; easing: string; delay?: Map<string, number> };

/** Ultima selezione (giocatori + numero squadre): comodità per-dispositivo, non un dato. */
const STORAGE_KEY = 'sport_random_teams';

/** Pause fra un rimescolo e l'altro: rallentano verso la fine, come un mazzo che si ferma. */
const SHUFFLE_GAPS = [110, 110, 110, 115, 120, 130, 145, 165, 190, 225, 270];
/** Pausa col mazzo fermo prima di distribuire. */
const DEAL_PAUSE = 350;
/** Ritardo fra un giocatore distribuito e il successivo. */
const DEAL_STAGGER = 110;

const EASE_SOFT = 'cubic-bezier(0.4, 0, 0.2, 1)';
const EASE_LAND = 'cubic-bezier(0.34, 1.3, 0.64, 1)';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const randomTilt = () => Math.round((Math.random() * 2 - 1) * 8);

/** "2 squadre da 3" oppure "2 squadre: 3 + 2". */
function sizesLabel(playerCount: number, teamCount: number): string {
  const sizes = teamSizes(playerCount, teamCount);
  return sizes.every((s) => s === sizes[0])
    ? `${teamCount} squadre da ${sizes[0]}`
    : `${teamCount} squadre: ${sizes.join(' + ')}`;
}

/**
 * Squadre casuali: scegli chi gioca e quante squadre, l'app mescola i giocatori
 * (animazione "mazzo di carte") e li distribuisce a giro nelle squadre.
 *
 * Animazione = FLIP: prima di ogni cambio fotografo il CENTRO visivo di ogni
 * giocatore (in coordinate di pagina, così lo scroll non sposta niente), dopo il
 * render lo faccio partire da lì e scivolare nel posto nuovo. Lo stesso id passa
 * dal mazzo alla squadra, quindi la distribuzione "vola" senza codice in più.
 */
export default function RandomTeamsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [teamCount, setTeamCount] = useState(MIN_TEAMS);
  const [phase, setPhase] = useState<Phase>('idle');
  const [deck, setDeck] = useState<Player[]>([]);
  const [tilt, setTilt] = useState<Record<string, number>>({});
  const [result, setResult] = useState<RandomTeams<Player> | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);

  const chipEls = useRef(new Map<string, HTMLElement>());
  const lastCenters = useRef(new Map<string, Point>());
  const flipPlan = useRef<FlipPlan | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stageRef = useRef<HTMLElement | null>(null);
  const restored = useRef(false);

  const busy = phase === 'shuffling';
  // meno giocatori ⇒ meno squadre possibili: il numero usato non esce mai dalla regola,
  // ma la scelta resta quella dell'utente se poi riaggiunge giocatori
  const teams = Math.min(teamCount, maxTeams(selected.length));
  const problem = teamsProblem(selected.length, teams);
  const teamOptions = Array.from({ length: maxTeams(selected.length) - MIN_TEAMS + 1 }, (_, i) => MIN_TEAMS + i);

  // --- dati + ultima selezione ---
  useEffect(() => {
    fetch('/api/players', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Player[]) => {
        setPlayers(list);
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
          if (saved && Array.isArray(saved.ids)) {
            const alive = new Set(list.map((p) => p.id));
            setSelected(saved.ids.filter((id: string) => alive.has(id)));
            if (Number.isInteger(saved.teams)) setTeamCount(saved.teams);
          }
        } catch {
          /* storage non disponibile o corrotto: si parte da zero */
        }
        restored.current = true;
      })
      .catch(() => setPlayers([]))
      .finally(() => setLoading(false));
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ids: selected, teams: teamCount }));
    } catch {
      /* non salvato: pazienza, la selezione resta per questa visita */
    }
  }, [selected, teamCount]);

  // --- FLIP ---
  const setChipEl = (id: string) => (el: HTMLElement | null) => {
    if (el) chipEls.current.set(id, el);
    else chipEls.current.delete(id);
  };

  /** Fotografa dove si VEDONO i giocatori adesso (anche a metà di un volo). */
  const snapshot = () => {
    const m = new Map<string, Point>();
    chipEls.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      m.set(id, { x: r.left + r.width / 2 + window.scrollX, y: r.top + r.height / 2 + window.scrollY });
    });
    lastCenters.current = m;
  };

  useLayoutEffect(() => {
    const plan = flipPlan.current;
    flipPlan.current = null;
    if (!plan) return;
    chipEls.current.forEach((el, id) => {
      el.getAnimations().forEach((a) => a.id === 'flip' && a.cancel());
      const prev = lastCenters.current.get(id);
      if (!prev) return;
      const r = el.getBoundingClientRect();
      const dx = prev.x - (r.left + r.width / 2 + window.scrollX);
      const dy = prev.y - (r.top + r.height / 2 + window.scrollY);
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0px 0px' }], {
        id: 'flip',
        duration: plan.duration,
        easing: plan.easing,
        delay: plan.delay?.get(id) ?? 0,
        fill: 'backwards',
      });
    });
  }, [layoutVersion]);

  /** Applica un cambio di disposizione animandolo. */
  const relayout = (plan: FlipPlan, change: () => void) => {
    snapshot();
    flipPlan.current = plan;
    change();
    setLayoutVersion((v) => v + 1);
  };

  // --- azioni ---
  const resetResult = () => {
    if (phase === 'done') {
      setPhase('idle');
      setResult(null);
    }
  };

  const togglePlayer = (id: string) => {
    if (busy) return;
    resetResult();
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const selectAll = (all: boolean) => {
    if (busy) return;
    resetResult();
    setSelected(all ? players.map((p) => p.id) : []);
  };

  const chooseTeams = (n: number) => {
    if (busy) return;
    resetResult();
    setTeamCount(n);
  };

  const run = () => {
    if (busy || problem) return;
    const picked = players.filter((p) => selected.includes(p.id));
    const final = makeRandomTeams(picked, teams);
    timers.current.forEach(clearTimeout);
    timers.current = [];

    if (prefersReducedMotion()) {
      setResult(final);
      setPhase('done');
      return;
    }

    const tilts = () => Object.fromEntries(picked.map((p) => [p.id, randomTilt()]));
    // dal risultato precedente i giocatori tornano nel mazzo volando
    relayout({ duration: 320, easing: EASE_SOFT }, () => {
      setResult(null);
      setDeck(shuffle(picked));
      setTilt(tilts());
      setPhase('shuffling');
    });
    requestAnimationFrame(() => stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

    let t = 0;
    SHUFFLE_GAPS.forEach((gap, i) => {
      t += gap;
      const last = i === SHUFFLE_GAPS.length - 1;
      timers.current.push(
        setTimeout(() => {
          relayout({ duration: Math.min(Math.round(gap * 0.9), 230), easing: EASE_SOFT }, () => {
            // all'ultimo giro il mazzo si mette in fila nell'ordine in cui verrà distribuito
            setDeck(last ? final.dealOrder : shuffle(picked));
            setTilt(last ? {} : tilts());
          });
        }, t)
      );
    });

    t += DEAL_PAUSE;
    timers.current.push(
      setTimeout(() => {
        const delay = new Map(final.dealOrder.map((p, i) => [p.id, i * DEAL_STAGGER]));
        relayout({ duration: 520, easing: EASE_LAND, delay }, () => {
          setResult(final);
          setPhase('done');
        });
      }, t)
    );
  };

  const summary = result
    ? result.teams.map((team, i) => `Squadra ${teamLetter(i)}: ${team.map((p) => p.name).join(', ')}`).join('. ')
    : '';

  return (
    <div className="rt-page">
      <h1 className="title match-form-title">Squadre casuali</h1>

      <div className="card match-form-card rt-section">
        <h2 className="rt-section-title">1. Chi gioca?</h2>
        {loading ? (
          <p>Caricamento...</p>
        ) : players.length === 0 ? (
          <p className="muted">Nessun giocatore: aggiungili dalla scheda Player di uno sport.</p>
        ) : (
          <>
            <div className="rt-select-bar">
              <span className="rt-select-count">
                <strong>{selected.length}</strong> su {players.length} selezionati
              </span>
              <span className="rt-select-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => selectAll(true)} disabled={busy}>
                  Tutti
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => selectAll(false)} disabled={busy}>
                  Nessuno
                </button>
              </span>
            </div>
            <div className="player-picker-grid">
              {players.map((p) => {
                const on = selected.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlayer(p.id)}
                    className={`player-pill${on ? ' player-pill-selected' : ''}`}
                    aria-pressed={on}
                    disabled={busy}
                  >
                    <span className="player-pill-name">{p.name}</span>
                    {on && <span className="player-pill-check" aria-hidden="true">✓</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="card match-form-card rt-section">
        <h2 className="rt-section-title">2. Quante squadre?</h2>
        <div className="rt-count-picker" role="radiogroup" aria-label="Numero di squadre">
          {teamOptions.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={teams === n}
              className={`rt-count-btn${teams === n ? ' is-active' : ''}`}
              onClick={() => chooseTeams(n)}
              disabled={busy}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="rt-preview">
          {selected.length >= 4 ? sizesLabel(selected.length, teams) : 'Minimo 4 giocatori per un 2 contro 2'}
        </p>
      </div>

      <div className="rt-go-wrap">
        <button type="button" className="btn btn-pill rt-go" onClick={run} disabled={busy || !!problem}>
          <span className={busy ? 'rt-dice is-rolling' : 'rt-dice'} aria-hidden="true">🎲</span>
          {busy ? 'Mescolo…' : phase === 'done' ? 'Rimescola' : 'Crea squadre'}
        </button>
        {problem && !loading && players.length > 0 && <p className="padel-set-problem">{problem}</p>}
      </div>

      <p className="rt-sr-only" aria-live="polite">
        {phase === 'shuffling' ? 'Mescolo i giocatori…' : phase === 'done' ? `Squadre pronte. ${summary}` : ''}
      </p>

      {phase !== 'idle' && (
        <section className="card rt-stage" ref={stageRef} aria-busy={busy}>
          <h2 className="card-title rt-stage-title">
            {busy ? (
              <>
                <span className="rt-dice is-rolling" aria-hidden="true">🎲</span> Mescolo i giocatori…
              </>
            ) : (
              'Ecco le squadre'
            )}
          </h2>

          {busy && (
            <div className="rt-deck">
              {deck.map((p) => (
                <span
                  key={p.id}
                  ref={setChipEl(p.id)}
                  className="rt-chip rt-chip-deck"
                  style={{ rotate: `${tilt[p.id] ?? 0}deg` }}
                >
                  {p.name}
                </span>
              ))}
            </div>
          )}

          {phase === 'done' && result && (
            <div className="rt-teams">
              {result.teams.map((team, i) => (
                <div key={i} className={`rt-team rt-team-${i % 6}`}>
                  <div className="rt-team-head">
                    <span className="rt-team-badge">{teamLetter(i)}</span>
                    <span className="rt-team-name">Squadra {teamLetter(i)}</span>
                  </div>
                  <div className="rt-team-players">
                    {team.map((p) => (
                      <span key={p.id} ref={setChipEl(p.id)} className="rt-chip">
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
