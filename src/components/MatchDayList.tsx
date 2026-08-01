"use client";

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { groupByDay, type ChronoKey } from '@/lib/match-order';

/**
 * Cronologia partite raggruppata per GIORNATA — condivisa da tutti gli sport.
 *
 * Prima ogni partita ripeteva la propria data: quattro partite dello stesso
 * giorno = quattro volte "01/08/2026". Qui la data si scrive una volta sola, in
 * testa al riquadro della giornata, e le partite dentro sono numerate in ordine
 * di gioco (1ª · 2ª · 3ª). La numerazione non è decorativa: l'ordine dentro la
 * giornata è quello che determina le serie di vittorie in classifica, e prima
 * era solo INTUITO dalla posizione nella lista. Adesso è scritto, e con le
 * frecce ↑↓ si corregge.
 *
 * VERSO DELLA LISTA — uno solo, dal più recente al più vecchio, dentro e fuori
 * la giornata: le giornate scendono dalla più recente, e dentro ogni riquadro la
 * partita più recente sta in cima. Quindi si legge 3ª · 2ª · 1ª dall'alto in
 * basso, con la PRIMA giocata in fondo. Era proprio la convenzione mista — fuori
 * newest-first, dentro oldest-first — a rendere invisibile il difetto d'ordine:
 * due letture opposte della stessa lista possono dissentire di uno per sempre.
 *
 * `render` restituisce il corpo specifico dello sport: la testata (numero,
 * riepilogo, azioni) resta identica ovunque, così i quattro sport non divergono.
 */

export type SportKey = 'ko' | '3v3' | 'machiavelli' | 'padel';

export type MatchRender = {
  /** Riepilogo breve a destra del numero: "3 giocatori", "21 – 18", "2-0 set". */
  meta?: ReactNode;
  /** Corpo della partita (podio, squadre, set…). */
  body: ReactNode;
  /** Pagina di modifica (mostrata solo se admin). */
  editHref?: string;
};

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

/**
 * "Oggi" · "Ieri" · "sabato 1 agosto" · "sabato 1 agosto 2025" (anni passati).
 * Scritto a mano invece di `toLocaleDateString`: serve il giorno della settimana
 * per esteso ma senza la virgola e senza l'anno corrente, e le combinazioni di
 * `options` non danno esattamente questa forma in italiano.
 */
export function formatDayLabel(d: Date, today = new Date()): string {
  const giorni = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86_400_000
  );
  if (giorni === 0) return 'Oggi';
  if (giorni === 1) return 'Ieri';
  const base = `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
  return d.getFullYear() === today.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export default function MatchDayList<T extends ChronoKey>({
  matches,
  render,
  isAdmin = false,
  sport,
  onReordered,
}: {
  matches: T[];
  render: (match: T) => MatchRender;
  isAdmin?: boolean;
  /** Serve solo per il riordino: senza, le frecce non compaiono. */
  sport?: SportKey;
  /** Chiamata dopo un riordino riuscito: la pagina ricarica i dati. */
  onReordered?: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const days = groupByDay(matches);

  const scambia = async (first: string, second: string) => {
    if (!sport) return;
    setBusy(first);
    setError(null);
    try {
      const res = await fetch('/api/matches/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, first, second }),
      });
      if (!res.ok) {
        // Un'azione che fallisce in silenzio è indistinguibile da un'app rotta:
        // qui si dice sempre il MOTIVO, non "operazione non riuscita".
        const j = await res.json().catch(() => ({}));
        setError(
          res.status === 401
            ? 'Sessione scaduta: rifai il login per riordinare.'
            : j.error || `Riordino non riuscito (errore ${res.status}).`
        );
        return;
      }
      onReordered?.();
    } catch {
      setError('Riordino non riuscito: connessione assente.');
    } finally {
      setBusy(null);
    }
  };

  const canReorder = isAdmin && !!sport && !!onReordered;

  return (
    <div className="day-groups">
      {error && <p className="day-group-error">{error}</p>}

      {days.map((day) => (
        <section key={day.key} className="day-group">
          <header className="day-group-head">
            <span className="day-group-date">{formatDayLabel(day.date)}</span>
            <span className="day-group-count">
              {day.matches.length} {day.matches.length === 1 ? 'partita' : 'partite'}
            </span>
          </header>

          <div className="day-group-body">
            {/* `day.matches` arriva in ordine di GIOCO (è il contratto del dato,
                quello che conta per le serie). A schermo si legge al contrario:
                più recente in cima, come le giornate. */}
            {[...day.matches].reverse().map((m, i, righe) => {
              const r = render(m);
              const numero = righe.length - i; // 1ª = la prima giocata, in fondo
              const sopra = righe[i - 1]; // riga sopra = giocata DOPO questa
              const sotto = righe[i + 1]; // riga sotto = giocata PRIMA di questa
              const solaDelGiorno = righe.length === 1;
              return (
                <article key={m.id} className="day-match">
                  <div className="day-match-head">
                    {/* Con una sola partita il numero è rumore: la data basta. */}
                    {!solaDelGiorno && <span className="day-match-seq">{numero}ª</span>}
                    {r.meta && <span className="day-match-meta">{r.meta}</span>}
                    <div className="day-match-actions">
                      {/* Ogni freccia o fa qualcosa o non c'è: niente tasti spenti. */}
                      {/* Le frecce seguono la LISTA, non l'orologio: ↑ porta la
                          partita più in alto, cioè più recente (scambio con la
                          riga sopra, che diventa la più vecchia delle due). */}
                      {canReorder && sopra && (
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => scambia(sopra.id, m.id)}
                          disabled={busy !== null}
                          title="Sposta su: questa è stata giocata dopo"
                          aria-label="Sposta su nella giornata"
                        >
                          ↑
                        </button>
                      )}
                      {canReorder && sotto && (
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => scambia(m.id, sotto.id)}
                          disabled={busy !== null}
                          title="Sposta giù: questa è stata giocata prima"
                          aria-label="Sposta giù nella giornata"
                        >
                          ↓
                        </button>
                      )}
                      {isAdmin && r.editHref && (
                        <Link href={r.editHref} className="match-row-edit" title="Modifica partita">
                          ✏️
                        </Link>
                      )}
                    </div>
                  </div>
                  {r.body}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
