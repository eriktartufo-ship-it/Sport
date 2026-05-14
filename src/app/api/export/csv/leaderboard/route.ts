import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { computePlayerStats, type Medal } from '@/lib/scoring';
import { toCsv, UTF8_BOM } from '@/lib/csv';

/**
 * GET /api/export/csv/leaderboard?season=YYYY
 *   Esporta la classifica corrente in CSV. UTF-8 con BOM (Excel-friendly).
 *   Pubblico (legge solo dati già esposti da /api/stats/ko).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const seasonParam = url.searchParams.get('season');

    const sport = await prisma.sport.findUnique({ where: { name: 'K.O.' } });
    if (!sport) {
      const csv = UTF8_BOM + 'Posizione,Giocatore';
      return csvResponse(csv, filename('classifica', seasonParam));
    }

    const where: { match: { sportId: string; date?: { gte: Date; lt: Date } } } = {
      match: { sportId: sport.id },
    };
    if (seasonParam && /^\d{4}$/.test(seasonParam)) {
      const year = parseInt(seasonParam, 10);
      where.match.date = {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      };
    }

    const results = await prisma.matchResult.findMany({
      where,
      include: { player: true, match: { select: { date: true } } },
    });

    const stats = computePlayerStats(
      results.map((r) => ({
        matchId: r.matchId,
        playerId: r.playerId,
        medal: r.medal as Medal,
        player: { name: r.player.name },
        match: { date: r.match.date },
      })),
    );

    const csv = UTF8_BOM + toCsv(stats, [
      { label: 'Posizione', value: (_s) => 0 },  // riempito dopo con index
      { label: 'Giocatore', value: (s) => s.name },
      { label: 'Score', value: (s) => s.score },
      { label: 'Oro', value: (s) => s.gold },
      { label: 'Argento', value: (s) => s.silver },
      { label: 'Bronzo', value: (s) => s.bronze },
      { label: 'Partite', value: (s) => s.matchesPlayed },
      { label: 'Giornate', value: (s) => s.daysPlayed },
      { label: 'Media', value: (s) => (s.score / (s.matchesPlayed || 1)).toFixed(2) },
      { label: 'Podio %', value: (s) => s.podiumPercentage },
      { label: 'Current Streak', value: (s) => s.currentStreak },
      { label: 'Best Streak', value: (s) => s.bestStreak },
      { label: 'Best Week (punti)', value: (s) => s.bestWeekPoints },
      { label: 'Best Week (chiave)', value: (s) => s.bestWeekKey },
      { label: 'Trend', value: (s) => s.trend },
      { label: 'Recent Avg', value: (s) => s.recentAvg },
      { label: 'Baseline Avg', value: (s) => s.baselineAvg },
    ]);

    // Sostituisci la prima colonna "Posizione" con l'index corretto:
    // toCsv non ha accesso all'index, lo patchiamo qui line-by-line.
    const lines = csv.split('\r\n');
    for (let i = 1; i < lines.length; i++) {
      // ogni riga inizia con "0," (placeholder) → sostituisci con i,
      lines[i] = lines[i].replace(/^0,/, `${i},`);
    }
    const finalCsv = lines.join('\r\n');

    return csvResponse(finalCsv, filename('classifica', seasonParam));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Errore nell'export CSV" }, { status: 500 });
  }
}

function filename(base: string, season: string | null): string {
  const date = new Date().toISOString().slice(0, 10);
  const seasonPart = season && /^\d{4}$/.test(season) ? `-${season}` : '';
  return `${base}${seasonPart}-${date}.csv`;
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
