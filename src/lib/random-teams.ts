/**
 * Squadre casuali — funzioni pure, separate dalla pagina per testabilità.
 *
 * Regole (Erik, 2026-10-01):
 *  - servono almeno 4 giocatori (il minimo per un 2 contro 2);
 *  - almeno 2 squadre, e ogni squadra ha almeno 2 giocatori ⇒ al massimo n/2 squadre;
 *  - le squadre sono il più possibile uguali: le taglie differiscono al massimo di 1
 *    (5 giocatori in 2 squadre = 3 + 2).
 *
 * Metodo: mescolo tutti (Fisher-Yates) e distribuisco a giro come le carte
 * (1° alla A, 2° alla B, …). Il mescolamento uniforme rende uniforme anche
 * l'assegnazione; il giro garantisce le taglie bilanciate.
 */

export const MIN_PLAYERS = 4;
export const MIN_TEAMS = 2;
export const MIN_PER_TEAM = 2;

/** Numero massimo di squadre con `playerCount` giocatori (mai sotto MIN_TEAMS). */
export function maxTeams(playerCount: number): number {
  return Math.max(MIN_TEAMS, Math.floor(playerCount / MIN_PER_TEAM));
}

/** Perché non si può ancora mescolare — `null` se si può. Testo per l'utente. */
export function teamsProblem(playerCount: number, teamCount: number): string | null {
  if (playerCount < MIN_PLAYERS) {
    const missing = MIN_PLAYERS - playerCount;
    return `Seleziona almeno ${MIN_PLAYERS} giocatori: ne ${missing === 1 ? 'manca 1' : `mancano ${missing}`}.`;
  }
  if (teamCount < MIN_TEAMS) return `Servono almeno ${MIN_TEAMS} squadre.`;
  if (teamCount > maxTeams(playerCount)) {
    return `Con ${playerCount} giocatori puoi fare al massimo ${maxTeams(playerCount)} squadre da almeno ${MIN_PER_TEAM}.`;
  }
  return null;
}

/** Taglie delle squadre, nell'ordine A, B, C… (es. 5 in 2 → [3, 2]). */
export function teamSizes(playerCount: number, teamCount: number): number[] {
  const base = Math.floor(playerCount / teamCount);
  const extra = playerCount % teamCount;
  return Array.from({ length: teamCount }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Numero casuale in [0, 1): crittografico quando disponibile. */
export function cryptoRandom(): number {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return buf[0] / 2 ** 32;
  }
  return Math.random();
}

/** Fisher-Yates: copia mescolata, non tocca l'array originale. */
export function shuffle<T>(items: readonly T[], rand: () => number = cryptoRandom): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type RandomTeams<T> = {
  /** Le squadre, nell'ordine A, B, C… */
  teams: T[][];
  /** Ordine in cui i giocatori sono stati "distribuiti" (serve all'animazione). */
  dealOrder: T[];
};

/**
 * Divide `players` in `teamCount` squadre casuali e bilanciate.
 * Lancia se i vincoli non sono rispettati: la pagina li controlla prima con `teamsProblem`.
 */
export function makeRandomTeams<T>(
  players: readonly T[],
  teamCount: number,
  rand: () => number = cryptoRandom
): RandomTeams<T> {
  const problem = teamsProblem(players.length, teamCount);
  if (problem) throw new Error(problem);

  const dealOrder = shuffle(players, rand);
  const teams: T[][] = Array.from({ length: teamCount }, () => []);
  dealOrder.forEach((p, i) => teams[i % teamCount].push(p));
  return { teams, dealOrder };
}

/** Lettera della squadra: 0 → A, 1 → B, … */
export function teamLetter(index: number): string {
  return String.fromCharCode(65 + index);
}
