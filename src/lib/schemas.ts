import { z } from 'zod';

/**
 * Schemi Zod centralizzati per validare i body delle API.
 * Usare `parseBody(SCHEMA, body)` nel route per ottenere either:
 *   - { ok: true, data: T }
 *   - { ok: false, error: string }  -> return 400 con l'errore.
 */

export const LoginSchema = z.object({
  password: z.string().min(1, 'password obbligatoria'),
});

export const PlayerCreateSchema = z.object({
  name: z.string().trim().min(1, 'nome obbligatorio').max(60, 'nome troppo lungo'),
});

export const PlayerUpdateSchema = PlayerCreateSchema;

export const MedalSchema = z.enum(['GOLD', 'SILVER', 'BRONZE', 'NONE']);

export const MatchResultEntrySchema = z.object({
  playerId: z.string().min(1, 'playerId mancante'),
  medal: MedalSchema,
});

/**
 * Body per POST /api/matches/ko e PATCH /api/matches/ko/[id].
 * - results: almeno 3 partecipanti per una partita K.O. valida
 * - date: ISO string opzionale (Prisma default now() se assente)
 */
export const MatchUpsertSchema = z.object({
  date: z.string().optional().nullable(),
  results: z
    .array(MatchResultEntrySchema)
    .min(3, 'Una partita di K.O. richiede almeno 3 giocatori'),
});

/**
 * Body per POST /api/matches/3v3 e PATCH /api/matches/3v3/[id].
 * Regole 3vs3 (basket FIBA 3x3):
 *   - 3 player per squadra (teamA + teamB)
 *   - 6 player tutti distinti
 *   - punteggi 0..21 interi
 *   - vincitore SEMPRE a 21 (max(A,B) == 21)
 *   - no pareggio (A != B)
 */
export const Match3v3UpsertSchema = z
  .object({
    date: z.string().optional().nullable(),
    teamA: z.array(z.string().min(1)).length(3, 'Squadra A deve avere esattamente 3 giocatori'),
    teamB: z.array(z.string().min(1)).length(3, 'Squadra B deve avere esattamente 3 giocatori'),
    teamAScore: z.number().int().min(0).max(21),
    teamBScore: z.number().int().min(0).max(21),
  })
  .refine((d) => d.teamAScore !== d.teamBScore, {
    message: 'Una squadra deve vincere — i punteggi non possono essere uguali',
    path: ['teamBScore'],
  })
  .refine((d) => Math.max(d.teamAScore, d.teamBScore) === 21, {
    message: 'Il vincitore deve arrivare a 21 punti',
    path: ['teamAScore'],
  })
  .refine(
    (d) => {
      const all = [...d.teamA, ...d.teamB];
      return new Set(all).size === all.length;
    },
    { message: 'Un giocatore non può essere in entrambe le squadre', path: ['teamB'] }
  );

/**
 * Body per POST /api/matches/machiavelli e PATCH /api/matches/machiavelli/[id].
 * Regole Machiavelli (gioco di carte):
 *   - almeno 2 giocatori, tutti distinti
 *   - `orderedPlayerIds` è l'ORDINE di arrivo: primo = vincitore (chi finisce
 *     le carte per primo), ultimo = chi resta con le carte in mano.
 *     La posizione (1-based) determina i punti (position - 1).
 */
export const MatchMachiavelliUpsertSchema = z
  .object({
    date: z.string().optional().nullable(),
    orderedPlayerIds: z
      .array(z.string().min(1))
      .min(2, 'Una partita di Machiavelli richiede almeno 2 giocatori'),
  })
  .refine((d) => new Set(d.orderedPlayerIds).size === d.orderedPlayerIds.length, {
    message: 'Un giocatore non può comparire due volte',
    path: ['orderedPlayerIds'],
  });

/**
 * Un set di padel valido, secondo le regole di casa (oro al game, VANTAGGI al set):
 *  - vince chi arriva a 6 game con almeno 2 di scarto  → 6-0..6-4
 *  - sul 6-6 si va ai vantaggi (niente tie-break) → 7-5, 8-6, 9-7, ... (scarto ESATTO 2)
 * Quindi un set concluso (w, l) con w > l è valido sse:
 *  - w == 6 && l <= 4, oppure
 *  - w >= 7 && (w - l) == 2
 */
export function isValidPadelSet(a: number, b: number): boolean {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
  if (a < 0 || b < 0 || a > 30 || b > 30) return false;
  if (a === b) return false;
  const w = Math.max(a, b);
  const l = Math.min(a, b);
  if (w === 6 && l <= 4) return true;
  if (w >= 7 && w - l === 2) return true;
  return false;
}

/**
 * Body per POST /api/matches/padel e PATCH /api/matches/padel/[id].
 * Regole Padel:
 *   - 2 giocatori per squadra (teamA + teamB), 4 tutti distinti
 *   - da 1 a 5 set, ognuno un punteggio valido (isValidPadelSet)
 *   - la partita deve avere un vincitore: una squadra vince più set dell'altra
 */
const PadelSetSchema = z
  .object({ a: z.number().int().min(0).max(30), b: z.number().int().min(0).max(30) })
  .refine((s) => isValidPadelSet(s.a, s.b), {
    message: 'Set non valido: 6 con 2 di scarto (6-4), oppure ai vantaggi 7-5/8-6…',
  });

export const MatchPadelUpsertSchema = z
  .object({
    date: z.string().optional().nullable(),
    teamA: z.array(z.string().min(1)).length(2, 'Squadra A deve avere 2 giocatori'),
    teamB: z.array(z.string().min(1)).length(2, 'Squadra B deve avere 2 giocatori'),
    sets: z.array(PadelSetSchema).min(1, 'Serve almeno 1 set').max(5, 'Massimo 5 set'),
  })
  .refine(
    (d) => {
      const all = [...d.teamA, ...d.teamB];
      return new Set(all).size === all.length;
    },
    { message: 'Un giocatore non può essere in entrambe le squadre', path: ['teamB'] }
  )
  .refine(
    (d) => {
      let a = 0;
      let b = 0;
      for (const s of d.sets) {
        if (s.a > s.b) a++;
        else b++;
      }
      return a !== b;
    },
    { message: 'La partita deve avere un vincitore: una squadra deve vincere più set', path: ['sets'] }
  );

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Wrapper attorno a `schema.safeParse` che produce un messaggio di errore
 * piatto e leggibile per l'API (es. "results.1.medal: Invalid enum value").
 */
export function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): ParseResult<T> {
  const r = schema.safeParse(body);
  if (r.success) {
    return { ok: true, data: r.data };
  }
  const first = r.error.issues[0];
  const path = first.path.length > 0 ? `${first.path.join('.')}: ` : '';
  return { ok: false, error: `${path}${first.message}` };
}
