# Sport — Product Specification

> Versione: 1.3 — 2026-05-03 (mattino, post pack #12 — fix runtime VPS volume permissions)
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

Per ora è attivo solo il modulo **K.O. (Basket)**. La struttura del DB
prevede un `Sport` come entità separata in vista di sport futuri, ma niente
viene implementato finché non richiesto.

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
| GET | `/api/players` | pubblico | array di player |
| POST | `/api/players` | admin | crea player, P2002 dup → 400 |
| PATCH | `/api/players/[id]` | admin | rinomina (body: `{name}`), P2002 → 400, P2025 → 404 |
| DELETE | `/api/players/[id]` | admin | cancella player + cascade dei suoi MatchResult |
| GET | `/api/seasons/ko` | pubblico | array di anni con almeno una partita, desc |
| GET | `/api/matches/ko?season=YYYY` | pubblico | cronologia, max 50, opzionale filtro stagione |
| POST | `/api/matches/ko` | admin | body: `{date?, results:[{playerId, medal}]}` |
| GET | `/api/matches/ko/[id]` | pubblico | singola partita con results.player |
| PATCH | `/api/matches/ko/[id]` | admin | replace medaglie e/o date, validazione: ≥3 risultati, medaglia ∈ enum, date parse valida |
| DELETE | `/api/matches/ko/[id]` | admin | cancella partita + cascade dei suoi MatchResult |
| GET | `/api/stats/ko?season=YYYY` | pubblico | classifica con filtro stagione opzionale |
| GET | `/api/db/export` | admin | binario SQLite |
| POST | `/api/db/import` | admin | multipart, distruttivo |

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
- Validazione body con Zod **TODO** (oggi è `await request.json()` raw).

## TODO architetturali (parking lot)

1. Validazione Zod su body POST/PATCH.
2. Test suite: zero test oggi. Iniziare da `api/stats/ko` (TDD).
3. Soft-delete partite via UI (oggi solo via DB import).
4. Cancellazione player con cascading o soft-delete.
5. Pagination cronologia se > 200 partite.
