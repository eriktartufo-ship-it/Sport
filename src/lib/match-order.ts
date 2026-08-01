/**
 * Ordinamento cronologico canonico delle partite — UNICA fonte di verità.
 *
 * PERCHÉ ESISTE
 * `date` è una GIORNATA, non un istante: i form hanno un input `type="date"`,
 * quindi tutte le partite dello stesso giorno hanno la stessa `date` (mezzanotte).
 * Finché l'ordine è "date asc/desc" e basta, l'ordine di due partite dello stesso
 * giorno lo decide SQLite (non specificato). Conseguenza reale (Machiavelli,
 * 2026-08-01): la classifica leggeva le due partite del 26/07 in un ordine e la
 * cronologia le mostrava con la convenzione opposta → "serie di vittorie 3" con
 * due vittorie di fila. Un ordine non deciso da noi è un bug che cambia i numeri.
 *
 * LA REGOLA
 *   1. `date`      — la giornata
 *   2. `createdAt` — ordine di REGISTRAZIONE dentro la giornata (lo spareggio)
 *   3. `id`        — ultimo spareggio: arbitrario ma DETERMINISTICO (mai casuale)
 *
 * Sia le query Prisma (`matchOrder`) sia i calcoli in JS (`compareChrono`) usano
 * questa regola: cronologia e classifica non possono più divergere.
 */

export type ChronoKey = {
  id: string;
  date: string | Date;
  createdAt?: string | Date | null;
};

const toMs = (v: string | Date): number =>
  v instanceof Date ? v.getTime() : new Date(v).getTime();

/**
 * `orderBy` Prisma per i modelli partita (Match, Match3v3, MatchMachiavelli,
 * MatchPadel: hanno tutti `date`, `createdAt`, `id`).
 * ASC = dalla più vecchia (calcoli), DESC = dalla più recente (cronologia).
 */
export function matchOrder(dir: 'asc' | 'desc') {
  return [{ date: dir }, { createdAt: dir }, { id: dir }];
}

/** Come `matchOrder` ma per una query che parte dai RISULTATI (relazione `match`). */
export function matchResultOrder(dir: 'asc' | 'desc') {
  return [
    { match: { date: dir } },
    { match: { createdAt: dir } },
    { match: { id: dir } },
  ];
}

/**
 * Comparatore cronologico (ASC). Da usare in OGNI `sort` sulle partite.
 * `createdAt` mancante (riga non ancora riempita dal backfill) = più vecchia di
 * una riga che ce l'ha: coerente con l'ordinamento SQLite (NULL first in ASC).
 */
export function compareChrono(a: ChronoKey, b: ChronoKey): number {
  const da = toMs(a.date);
  const db = toMs(b.date);
  if (da !== db) return da - db;

  const ca = a.createdAt == null ? null : toMs(a.createdAt);
  const cb = b.createdAt == null ? null : toMs(b.createdAt);
  if (ca !== null && cb !== null) {
    if (ca !== cb) return ca - cb;
  } else if (ca !== cb) {
    return ca === null ? -1 : 1;
  }

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Chiave di giornata LOCALE (`YYYY-MM-DD`): stessa che si vede a schermo. */
export function dayKey(date: string | Date): string {
  const d = date instanceof Date ? date : new Date(date);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export type MatchDay<T> = {
  key: string;
  /** Data della giornata (mezzanotte locale) per formattare l'intestazione. */
  date: Date;
  /** Partite della giornata in ordine di gioco: 1ª, 2ª, 3ª… */
  matches: T[];
};

/**
 * Raggruppa le partite per giornata. Le giornate escono dalla più RECENTE alla
 * più vecchia (come la cronologia); dentro la giornata le partite escono in
 * ordine di GIOCO crescente, che è il contratto del dato — è l'ordine che
 * determina le serie di vittorie. Chi disegna la lista la rovescia per mostrarla
 * newest-first come tutto il resto (vedi `MatchDayList`): il verso della vista è
 * una scelta della vista, l'ordine di gioco no.
 */
export function groupByDay<T extends ChronoKey>(matches: T[]): MatchDay<T>[] {
  const groups = new Map<string, T[]>();
  for (const m of matches) {
    const k = dayKey(m.date);
    const bucket = groups.get(k);
    if (bucket) bucket.push(m);
    else groups.set(k, [m]);
  }

  return Array.from(groups.entries())
    .map(([key, list]) => {
      const [y, mo, d] = key.split('-').map(Number);
      return {
        key,
        date: new Date(y, mo - 1, d),
        matches: [...list].sort(compareChrono),
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}
