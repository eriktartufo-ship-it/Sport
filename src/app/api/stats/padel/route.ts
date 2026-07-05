import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  computePadelTeamRankings,
  computePadelPlayerRankings,
  parseSets,
  type MatchPadelLite,
  type Side,
} from '@/lib/scoring-padel';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const seasonParam = url.searchParams.get('season');

    const sport = await prisma.sport.findUnique({ where: { name: 'Padel' } });
    if (!sport) return NextResponse.json({ teams: [], players: [] });

    const where: { sportId: string; date?: { gte: Date; lt: Date } } = { sportId: sport.id };
    if (seasonParam && /^\d{4}$/.test(seasonParam)) {
      const year = parseInt(seasonParam, 10);
      where.date = {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      };
    }

    const matches = await prisma.matchPadel.findMany({
      where,
      orderBy: { date: 'asc' },
      include: { results: { include: { player: true } } },
    });

    const lite: MatchPadelLite[] = matches.map((m) => ({
      id: m.id,
      date: m.date,
      sets: parseSets(m.setsJson),
      results: m.results.map((r) => ({
        playerId: r.playerId,
        teamSide: r.teamSide as Side,
        player: { name: r.player.name },
      })),
    }));

    return NextResponse.json({
      teams: computePadelTeamRankings(lite),
      players: computePadelPlayerRankings(lite),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Errore nel caricamento delle statistiche' }, { status: 500 });
  }
}
