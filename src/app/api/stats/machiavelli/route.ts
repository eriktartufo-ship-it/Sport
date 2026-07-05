import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  computePlayerRankingsMachiavelli,
  type MatchMachiavelliLite,
} from '@/lib/scoring-machiavelli';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const seasonParam = url.searchParams.get('season');

    const sport = await prisma.sport.findUnique({ where: { name: 'Machiavelli' } });
    if (!sport) return NextResponse.json({ players: [] });

    const where: { sportId: string; date?: { gte: Date; lt: Date } } = { sportId: sport.id };
    if (seasonParam && /^\d{4}$/.test(seasonParam)) {
      const year = parseInt(seasonParam, 10);
      where.date = {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      };
    }

    const matches = await prisma.matchMachiavelli.findMany({
      where,
      orderBy: { date: 'asc' },
      include: {
        results: { include: { player: true } },
      },
    });

    const lite: MatchMachiavelliLite[] = matches.map((m) => ({
      id: m.id,
      date: m.date,
      results: m.results.map((r) => ({
        playerId: r.playerId,
        isWinner: r.isWinner,
        player: { name: r.player.name },
      })),
    }));

    return NextResponse.json({
      players: computePlayerRankingsMachiavelli(lite),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Errore nel caricamento delle statistiche' }, { status: 500 });
  }
}
