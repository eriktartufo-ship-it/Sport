import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { toCsv, UTF8_BOM, type CsvColumn } from '@/lib/csv';
import { SCORE_BY_MEDAL, type Medal } from '@/lib/scoring';

/**
 * GET /api/export/csv/matches?sport=ko|3v3|machiavelli|padel&season=YYYY
 *   Esporta la cronologia di UNO sport in CSV "flat": 1 riga per giocatore
 *   per partita, con matchId/data ripetuti. Backup durevole e leggibile
 *   (apribile in Excel / Sheets / Numbers) — copia umana del DB, complementare
 *   al backup binario /api/db/export.
 *   Le colonne sono FEDELI alla forma-dati di ogni sport (ko=medaglie,
 *   3v3=punteggi+squadra, machiavelli=posizione, padel=set): così i punteggi
 *   e tutto il resto restano ricostruibili anche se l'app si rompe.
 *   Default sport=ko (retro-compatibile). Pubblico (legge solo dati già
 *   esposti dalle /api/matches/<sport>).
 */
type SeasonRange = { gte: Date; lt: Date } | undefined;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const seasonParam = url.searchParams.get('season');
    const sportParam = (url.searchParams.get('sport') || 'ko').toLowerCase();
    const season = seasonRange(seasonParam);

    let csv: string;
    switch (sportParam) {
      case 'ko':
        csv = await buildKo(season);
        break;
      case '3v3':
        csv = await build3v3(season);
        break;
      case 'machiavelli':
        csv = await buildMachiavelli(season);
        break;
      case 'padel':
        csv = await buildPadel(season);
        break;
      default:
        return NextResponse.json(
          { error: `Sport sconosciuto: "${sportParam}". Usa ko | 3v3 | machiavelli | padel.` },
          { status: 400 }
        );
    }

    return csvResponse(csv, filename(sportParam, seasonParam));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Errore nell'export CSV" }, { status: 500 });
  }
}

// --- K.O. (medaglie) — invariato per retro-compatibilità ---
async function buildKo(season: SeasonRange): Promise<string> {
  const sport = await prisma.sport.findUnique({ where: { name: 'K.O.' } });
  if (!sport) return UTF8_BOM + 'MatchId,Data';

  const matches = await prisma.match.findMany({
    where: { sportId: sport.id, ...(season ? { date: season } : {}) },
    orderBy: { date: 'desc' },
    include: { results: { include: { player: true } } },
  });

  type Row = { matchId: string; date: Date; playerCount: number; giocatore: string; medal: Medal; punti: number };
  const rows: Row[] = [];
  for (const m of matches) {
    for (const r of m.results) {
      rows.push({
        matchId: m.id,
        date: m.date,
        playerCount: m.playerCount,
        giocatore: r.player.name,
        medal: r.medal as Medal,
        punti: SCORE_BY_MEDAL[r.medal as Medal] ?? 0,
      });
    }
  }
  const columns: CsvColumn<Row>[] = [
    { label: 'MatchId', value: (r) => r.matchId },
    { label: 'Data', value: (r) => r.date.toISOString().slice(0, 10) },
    { label: 'Partecipanti', value: (r) => r.playerCount },
    { label: 'Giocatore', value: (r) => r.giocatore },
    { label: 'Medaglia', value: (r) => r.medal },
    { label: 'Punti', value: (r) => r.punti },
  ];
  return UTF8_BOM + toCsv(rows, columns);
}

// --- 3v3 (basket a squadre) ---
async function build3v3(season: SeasonRange): Promise<string> {
  const sport = await prisma.sport.findUnique({ where: { name: '3v3' } });
  if (!sport) return UTF8_BOM + 'MatchId,Data';

  const matches = await prisma.match3v3.findMany({
    where: { sportId: sport.id, ...(season ? { date: season } : {}) },
    orderBy: { date: 'desc' },
    include: { results: { include: { player: true } } },
  });

  type Row = { matchId: string; date: Date; teamAScore: number; teamBScore: number; giocatore: string; squadra: string };
  const rows: Row[] = [];
  for (const m of matches) {
    for (const r of m.results) {
      rows.push({
        matchId: m.id,
        date: m.date,
        teamAScore: m.teamAScore,
        teamBScore: m.teamBScore,
        giocatore: r.player.name,
        squadra: r.teamSide,
      });
    }
  }
  const columns: CsvColumn<Row>[] = [
    { label: 'MatchId', value: (r) => r.matchId },
    { label: 'Data', value: (r) => r.date.toISOString().slice(0, 10) },
    { label: 'PunteggioA', value: (r) => r.teamAScore },
    { label: 'PunteggioB', value: (r) => r.teamBScore },
    { label: 'Giocatore', value: (r) => r.giocatore },
    { label: 'Squadra', value: (r) => r.squadra },
  ];
  return UTF8_BOM + toCsv(rows, columns);
}

// --- Machiavelli (ordine di arrivo) ---
async function buildMachiavelli(season: SeasonRange): Promise<string> {
  const sport = await prisma.sport.findUnique({ where: { name: 'Machiavelli' } });
  if (!sport) return UTF8_BOM + 'MatchId,Data';

  const matches = await prisma.matchMachiavelli.findMany({
    where: { sportId: sport.id, ...(season ? { date: season } : {}) },
    orderBy: { date: 'desc' },
    include: { results: { include: { player: true } } },
  });

  type Row = { matchId: string; date: Date; giocatore: string; posizione: number };
  const rows: Row[] = [];
  for (const m of matches) {
    for (const r of m.results) {
      rows.push({
        matchId: m.id,
        date: m.date,
        giocatore: r.player.name,
        posizione: r.position,
      });
    }
  }
  const columns: CsvColumn<Row>[] = [
    { label: 'MatchId', value: (r) => r.matchId },
    { label: 'Data', value: (r) => r.date.toISOString().slice(0, 10) },
    { label: 'Giocatore', value: (r) => r.giocatore },
    { label: 'Posizione', value: (r) => r.posizione },
  ];
  return UTF8_BOM + toCsv(rows, columns);
}

// --- Padel (2v2, punteggio a set) ---
async function buildPadel(season: SeasonRange): Promise<string> {
  const sport = await prisma.sport.findUnique({ where: { name: 'Padel' } });
  if (!sport) return UTF8_BOM + 'MatchId,Data';

  const matches = await prisma.matchPadel.findMany({
    where: { sportId: sport.id, ...(season ? { date: season } : {}) },
    orderBy: { date: 'desc' },
    include: { results: { include: { player: true } } },
  });

  type Row = { matchId: string; date: Date; set: string; giocatore: string; squadra: string };
  const rows: Row[] = [];
  for (const m of matches) {
    for (const r of m.results) {
      rows.push({
        matchId: m.id,
        date: m.date,
        set: formatSets(m.setsJson),
        giocatore: r.player.name,
        squadra: r.teamSide,
      });
    }
  }
  const columns: CsvColumn<Row>[] = [
    { label: 'MatchId', value: (r) => r.matchId },
    { label: 'Data', value: (r) => r.date.toISOString().slice(0, 10) },
    { label: 'Set', value: (r) => r.set },
    { label: 'Giocatore', value: (r) => r.giocatore },
    { label: 'Squadra', value: (r) => r.squadra },
  ];
  return UTF8_BOM + toCsv(rows, columns);
}

/** setsJson = "[[6,4],[3,6],[6,2]]" → "6-4 3-6 6-2" (leggibile in CSV). */
function formatSets(setsJson: string): string {
  try {
    const sets = JSON.parse(setsJson) as [number, number][];
    return sets.map(([a, b]) => `${a}-${b}`).join(' ');
  } catch {
    return setsJson;
  }
}

function seasonRange(season: string | null): SeasonRange {
  if (season && /^\d{4}$/.test(season)) {
    const year = parseInt(season, 10);
    return { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) };
  }
  return undefined;
}

function filename(sport: string, season: string | null): string {
  const date = new Date().toISOString().slice(0, 10);
  const seasonPart = season && /^\d{4}$/.test(season) ? `-${season}` : '';
  return `cronologia-${sport}${seasonPart}-${date}.csv`;
}

function csvResponse(body: string, name: string): NextResponse {
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  });
}
