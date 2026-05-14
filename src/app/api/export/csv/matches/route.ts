import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { toCsv, UTF8_BOM, type CsvColumn } from '@/lib/csv';
import { SCORE_BY_MEDAL, type Medal } from '@/lib/scoring';

/**
 * GET /api/export/csv/matches?season=YYYY
 *   Esporta la cronologia in CSV "flat": 1 riga per MatchResult, con
 *   matchId/data ripetuti. Comodo per pivot table in Excel.
 *   Pubblico (legge solo dati già esposti da /api/matches/ko).
 */
type Row = {
  matchId: string;
  date: Date;
  playerCount: number;
  giocatore: string;
  medal: Medal;
  punti: number;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const seasonParam = url.searchParams.get('season');

    const sport = await prisma.sport.findUnique({ where: { name: 'K.O.' } });
    if (!sport) {
      return csvResponse(UTF8_BOM + 'MatchId,Data', filename(seasonParam));
    }

    const where: { sportId: string; date?: { gte: Date; lt: Date } } = { sportId: sport.id };
    if (seasonParam && /^\d{4}$/.test(seasonParam)) {
      const year = parseInt(seasonParam, 10);
      where.date = {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      };
    }

    const matches = await prisma.match.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { results: { include: { player: true } } },
    });

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

    const csv = UTF8_BOM + toCsv(rows, columns);
    return csvResponse(csv, filename(seasonParam));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Errore nell'export CSV" }, { status: 500 });
  }
}

function filename(season: string | null): string {
  const date = new Date().toISOString().slice(0, 10);
  const seasonPart = season && /^\d{4}$/.test(season) ? `-${season}` : '';
  return `cronologia${seasonPart}-${date}.csv`;
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
