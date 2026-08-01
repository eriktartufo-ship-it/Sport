-- Backfill dello spareggio di ordinamento delle partite (`createdAt`).
-- Girato a ogni avvio da `docker-entrypoint.sh`, subito dopo `prisma db push`.
--
-- PERCHÉ: `date` è una giornata (i form hanno `type="date"` → mezzanotte), quindi
-- due partite dello stesso giorno hanno data IDENTICA e il loro ordine reciproco
-- lo decideva SQLite. Vedi `src/lib/match-order.ts` per il difetto che ne è nato.
--
-- COME: `rowid` è l'ordine di inserimento (SQLite lo assegna crescente, e
-- restituisce le righe pari-data proprio in quest'ordine — verificato). Sommarlo
-- ai millisecondi di `date` dà una chiave crescente nell'ordine di registrazione.
-- Il valore assoluto non conta: `createdAt` è SOLO lo spareggio a parità di `date`.
--
-- IDEMPOTENTE: ogni UPDATE è filtrato su `createdAt IS NULL`, quindi passa una
-- volta sola. Fondamentale: dopo il primo giro le partite riordinate a mano da
-- dentro l'app (frecce ↑↓ nella cronologia) non vengono MAI più toccate da qui —
-- un riallineamento automatico non deve poter sovrascrivere una decisione umana.
--
-- `typeof(date) = 'integer'`: Prisma scrive le DateTime SQLite come epoch ms
-- (verificato sul DB). Su una riga con data in altro formato la somma darebbe una
-- data del 1970: meglio lasciarla NULL (il comparatore la tratta come più vecchia).

-- ---------------------------------------------------------------------------
-- Correzione una-tantum: Machiavelli, 26/07/2026.
-- Quel giorno le due partite risultano registrate nell'ordine inverso rispetto a
-- come sono state giocate (Erik segnala: quella vinta da lui è stata l'ultima).
-- Con l'ordine registrato la serie di Irene risultava 3 invece di 2.
-- Va PRIMA del backfill generico e vale solo finché `createdAt IS NULL`: passa
-- una volta sola e poi non ridiscute mai più l'ordine di quella giornata.
-- ---------------------------------------------------------------------------
UPDATE "MatchMachiavelli" SET "createdAt" = "date" + 1
 WHERE "id" = 'bb907838-9d3b-4cb8-84c6-583619e243fd' AND "createdAt" IS NULL; -- 1ª: vince Irene
UPDATE "MatchMachiavelli" SET "createdAt" = "date" + 2
 WHERE "id" = '6560ed1d-c629-4562-920b-b883966a17e7' AND "createdAt" IS NULL; -- 2ª: vince Erik

-- --------------------------- backfill generico -----------------------------
UPDATE "Match"            SET "createdAt" = "date" + rowid WHERE "createdAt" IS NULL AND typeof("date") = 'integer';
UPDATE "Match3v3"         SET "createdAt" = "date" + rowid WHERE "createdAt" IS NULL AND typeof("date") = 'integer';
UPDATE "MatchMachiavelli" SET "createdAt" = "date" + rowid WHERE "createdAt" IS NULL AND typeof("date") = 'integer';
UPDATE "MatchPadel"       SET "createdAt" = "date" + rowid WHERE "createdAt" IS NULL AND typeof("date") = 'integer';
