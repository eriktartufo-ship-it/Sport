# Sport — Product Specification

> Versione: 5.0 — 2026-07-05 (post pack #39 — nuovo sport Machiavelli, gioco di carte)
> Stato: living document, congelare le sezioni "Scope" e "Modello dati" prima di
> implementare ogni nuova feature.

## Requisito globale: Mobile-first

Ogni schermata deve essere **smartphone-friendly** per default
(≥360px width). Vedi memoria
`memory/feedback_mobile_friendly.md`. Riferimento estetico = Macro Analyzer
(Liquid Glass dark, Inter, gradient titoli, slide-tabs bottom-nav su mobile).
Touch target ≥40px, input font 16px (no zoom iOS), tabelle wide in
container scrollabile, grid che collassa a colonna singola sotto 1024px.

## Scope

Tracker locale, single-tenant, per partite di sport amatoriali tra un gruppo
di amici. Un solo admin (single-password). Lettura pubblica della classifica
e della cronologia. Solo la mutazione (aggiungere giocatori, modificare nomi,
registrare partite, importare/esportare DB) richiede admin.

Moduli attivi (dal pack #32, 2026-05-16):
- **K.O. (Basket)** — gioco a eliminazione, medaglie 🥇🥈🥉
- **3vs3 (Basket FIBA 3x3)** — squadre da 3, punteggi 0–21, vincitore obbligato a 21
- **Machiavelli (carte, pack #39 2026-07-05)** — partita libera con 2+ giocatori,
  chi resta con le carte in mano perde: si registra solo il vincitore (1 per match).
  Classifica per persona (vittorie, win-rate, serie di vittorie corrente/migliore).

I `Player` sono condivisi tra i moduli. Gestione player disponibile in ogni modulo
(`?tab=player`, componente condiviso `PlayerManagementCard`).

### Out of scope (deliberatamente)

- Multi-tenant / gestione utenti / RBAC.
- Cancellazione/edit di partite via UI (workaround: export → SQLite editing → import).
- Notifiche, social, sharing.
- Multi-language (UI è in italiano fisso).

## Modello dati

`prisma/schema.prisma`:

- `Player(id, name@unique, createdAt)` 1:N MatchResult.
- `Sport(id, name@unique)` 1:N Match.
- `Match(id, sportId→Sport, date@default(now()), playerCount)` 1:N MatchResult.
- `MatchResult(id, matchId→Match, playerId→Player, medal: "GOLD"|"SILVER"|"BRONZE"|"NONE")`,
  unique `(matchId, playerId)`.
- `Match3v3(id, sportId→Sport, date, teamAScore, teamBScore)` 1:N Match3v3Player
  (`teamSide: "A"|"B"`, unique `(matchId, playerId)`).
- `MatchMachiavelli(id, sportId→Sport, date)` 1:N MatchMachiavelliPlayer
  (`isWinner: bool`, unique `(matchId, playerId)`; esattamente 1 winner garantito
  dalla validation Zod `MatchMachiavelliUpsertSchema`).

## Regole di scoring K.O

| Medaglia | Punti |
| --- | --- |
| Oro | 10 |
| Argento | 5 |
| Bronzo | 2 |
| Nessuna | 0 |

> **Nota storica**: la v1/v2 usavano 3/2/1, dal feature pack #1 5/3/1, dal
> feature pack #3 (2026-05-02 notte) 10/5/2. Cambiare scoring NON richiede
> migrazione DB — il calcolo è server-side a runtime, le partite storiche
> vengono semplicemente ricalcolate al primo refresh.

Classifica: ordinata per `score` desc, in caso di parità per `% podio` desc.

## Regole di assegnazione medaglie per partita

- Minimo 3 giocatori.
- ≥3 giocatori → Oro obbligatorio.
- ≥4 giocatori → anche Argento obbligatorio.
- ≥5 giocatori → anche Bronzo obbligatorio.
- Una sola medaglia per tipo per partita (assegnarla a un altro la rimuove
  dal precedente).

## Feature attive (UI)

### Globali

- **Header sticky**: titolo "🏀 Sport" (link a home), stato sessione admin
  (icona/etichetta), pulsante "Login" o "Logout" sempre visibile dovunque.
- Estetica Liquid Glass dark coerente con `ai_graphic_style.md`.

### Home (`/`)

- Cards degli sport disponibili. Solo K.O. attivo.

### Settings (`/settings`)

- Form login (POST `ADMIN_PASSWORD`).
- Esporta DB SQLite raw (admin only).
- Importa DB SQLite raw (admin only, distruttivo).

### Dashboard K.O. (`/ko`)

- **Header sticky**: titolo K.O. + `SeasonSelector` (alimentato da
  `/api/seasons/ko`).
- **Tab nav sticky in alto** (Liquid Glass Apple-style, blur 28px
  saturate 1.8, inner highlight 1px, pill animata con cubic-bezier).
  4 tab:
  - **🏆 Classifica**: tabella classifica. Su mobile diventa
    **card grid 3x3** (riga 1: posizione + nome + score; riga 2:
    oro/argento/bronzo a 3 colonne; riga 3: partite/media/podio).
    Trend arrow ↗↘→ accanto al nome.
  - **📈 Grafici**: BarChart medaglie top 8 + LineChart score
    cumulativo top 5 + LineChart **andamento mensile top 5**.
  - **📋 Dati**: cronologia partite (ultime 50 desc per data,
    pulsante ✏️ per editare se admin).
  - **👥 Player**: gestione giocatori (add/edit/delete in player grid).

### Trend dei player

Il backend calcola in `/api/stats/ko` per ogni giocatore:

- `recentAvg`: media punti delle ultime 5 partite.
- `baselineAvg`: media punti delle partite precedenti alle ultime 5.
- `trend`: `up` (recent > baseline × 1.10), `down` (recent < baseline × 0.90),
  `stable` altrimenti, `unknown` se il giocatore ha < 4 match.

L'icona freccia (↗ verde / ↘ rosso / → grigio) appare accanto al nome
nelle card mobile e nel tooltip mostra i due valori.

- **Sidebar admin** (1024px+): aggiungi giocatore + lista giocatori con
  rename inline (✏️) e cancellazione (🗑️ con conferma, cascade delete dei
  suoi MatchResult). Sotto i 1024px la sidebar finisce sotto al main.

### Nuova partita K.O. (`/ko/new-match`, admin only)

- **Selettore data partita** con default oggi.
- Step 1: selezione partecipanti.
- Step 2: assegnazione medaglie con regole sopra.

## API

| Method | Path | Auth | Note |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | pubblico | Body: `{password}` → cookie auth_token |
| GET | `/api/auth/me` | pubblico | `{authenticated:bool}` |
| POST | `/api/auth/logout` | qualsiasi | cancella cookie |
| GET | `/api/players?includeDeleted=1` | pubblico | array player. Default solo attivi (`deletedAt:null`). `?includeDeleted=1` include i soft-deleted. |
| POST | `/api/players` | admin | crea player. P2002 ora distingue tra duplicato attivo e duplicato cancellato (suggerisce restore). |
| PATCH | `/api/players/[id]` | admin | `{name}` rinomina · `{restore:true}` ripristina soft-deleted. P2002/P2025 → 400/404. |
| DELETE | `/api/players/[id]` | admin | **Soft-delete**: marca `deletedAt`. Player sparisce da add/new-match ma resta in classifica/cronologia/H2H. |
| GET | `/api/seasons/ko` | pubblico | array di anni con almeno una partita, desc |
| GET | `/api/matches/ko?season=YYYY` | pubblico | cronologia, max 50, opzionale filtro stagione |
| POST | `/api/matches/ko` | admin | body: `{date?, results:[{playerId, medal}]}` |
| GET | `/api/matches/ko/[id]` | pubblico | singola partita con results.player |
| PATCH | `/api/matches/ko/[id]` | admin | replace medaglie e/o date, validazione: ≥3 risultati, medaglia ∈ enum, date parse valida |
| DELETE | `/api/matches/ko/[id]` | admin | cancella partita + cascade dei suoi MatchResult |
| GET | `/api/stats/ko?season=YYYY` | pubblico | classifica con filtro stagione opzionale + trend/streak/bestWeek |
| GET | `/api/stats/h2h?p1=&p2=` | pubblico | confronto diretto: wins/ties/cronologia. 400 missing/uguale, 404 player inesistente |
| GET | `/api/seasons/machiavelli` | pubblico | array di anni con almeno una partita Machiavelli, desc |
| GET | `/api/matches/machiavelli?season=YYYY` | pubblico | cronologia Machiavelli, max 50 |
| POST | `/api/matches/machiavelli` | admin | body: `{date?, playerIds:[..min 2], winnerId}` (winner ∈ playerIds) |
| GET | `/api/matches/machiavelli/[id]` | pubblico | singola partita con results.player |
| PATCH | `/api/matches/machiavelli/[id]` | admin | replace partecipanti/vincitore/data |
| DELETE | `/api/matches/machiavelli/[id]` | admin | cancella partita + cascade results |
| GET | `/api/stats/machiavelli?season=YYYY` | pubblico | `{players}`: classifica con streak corrente/migliore |
| GET | `/api/db/export` | admin | binario SQLite (backup completo) |
| POST | `/api/db/import` | admin | multipart, distruttivo |
| GET | `/api/export/csv/leaderboard?season=YYYY` | pubblico | classifica in CSV (UTF-8 BOM) per Excel/Sheets |
| GET | `/api/export/csv/matches?season=YYYY` | pubblico | cronologia flat 1-riga-per-MatchResult in CSV |

## Persistenza del database

**Il DB SQLite è progettato per non perdere mai dati durante un avvio
o un update.**

### Locale (dev su PC)

- File: `prisma/data/dev.db`. È sul disco, sopravvive a riavvii del PC e
  a chiusure del bat.
- Il bat fa `prisma db push` che è **non distruttivo**: aggiorna solo lo
  schema, non tocca i dati.
- Prima di ogni `db push` il bat copia `dev.db` in `dev.db.bak` come
  backup di sicurezza. Se qualcosa va storto, basta sostituire.
- Reset distruttivo: solo manuale con `rm prisma/data/dev.db && npx
  prisma db push` (e si perde tutto).

### Docker (deploy VPS)

- Volume Docker NAMED `sqlite-data` montato su `/app/prisma/data`.
- Persiste tra `docker compose down`, `docker compose up`, `docker
  compose up --build` e tag updates dell'immagine.
- Si perde SOLO con `docker compose down -v` esplicito.
- Backup dal host: `docker run --rm -v sport_sqlite-data:/data -v $PWD:/backup alpine cp /data/dev.db /backup/dev.db`.

## Sicurezza

- JWT cookie httpOnly, sameSite=strict, secure in produzione.
- Tutti i POST/PATCH mutation passano per `getAdminSession()`.
- Validazione body con **Zod** su tutte le POST/PATCH (`src/lib/schemas.ts`).
  Errori 400 strutturati formato `"path.field: messaggio"`.
- Test suite Vitest: 27 test verdi (`src/lib/scoring.test.ts`,
  `src/lib/schemas.test.ts`). Comando: `npm test`.

## TODO architetturali (parking lot)

1. Validazione Zod su body POST/PATCH.
2. Test suite: zero test oggi. Iniziare da `api/stats/ko` (TDD).
3. Soft-delete partite via UI (oggi solo via DB import).
4. Cancellazione player con cascading o soft-delete.
5. Pagination cronologia se > 200 partite.
