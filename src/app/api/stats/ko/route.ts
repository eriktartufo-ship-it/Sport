import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type Trend = 'up' | 'down' | 'stable' | 'unknown';

type StatRow = {
  id: string;
  name: string;
  matchesPlayed: number;
  daysPlayed: number;
  gold: number;
  silver: number;
  bronze: number;
  score: number;
  podiumPercentage: number;
  recentAvg: number | null;
  baselineAvg: number | null;
  trend: Trend;
};

const SCORE_BY_MEDAL: Record<string, number> = {
  GOLD: 10,
  SILVER: 5,
  BRONZE: 2,
  NONE: 0,
};

const RECENT_WINDOW = 5;
const TREND_MIN_MATCHES = 4;
const TREND_THRESHOLD = 0.1;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const seasonParam = url.searchParams.get('season');

    const sport = await prisma.sport.findUnique({ where: { name: 'K.O.' } });
    if (!sport) return NextResponse.json([]);

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

    const statsMap: Record<string, StatRow> = {};
    const perPlayerTimeline: Record<string, Array<{ date: Date; score: number }>> = {};
    // Set di "YYYY-MM-DD" per giocatore, per contare giornate distinte
    const perPlayerDays: Record<string, Set<string>> = {};

    for (const res of results) {
      const pid = res.playerId;
      if (!statsMap[pid]) {
        statsMap[pid] = {
          id: pid,
          name: res.player.name,
          matchesPlayed: 0,
          daysPlayed: 0,
          gold: 0,
          silver: 0,
          bronze: 0,
          score: 0,
          podiumPercentage: 0,
          recentAvg: null,
          baselineAvg: null,
          trend: 'unknown',
        };
      }
      const score = SCORE_BY_MEDAL[res.medal] ?? 0;
      statsMap[pid].matchesPlayed++;
      statsMap[pid].score += score;
      if (res.medal === 'GOLD') statsMap[pid].gold++;
      else if (res.medal === 'SILVER') statsMap[pid].silver++;
      else if (res.medal === 'BRONZE') statsMap[pid].bronze++;

      if (!perPlayerTimeline[pid]) perPlayerTimeline[pid] = [];
      perPlayerTimeline[pid].push({ date: res.match.date, score });

      // Conta giornata distinta (UTC, formato YYYY-MM-DD)
      if (!perPlayerDays[pid]) perPlayerDays[pid] = new Set();
      const dayKey = res.match.date.toISOString().slice(0, 10);
      perPlayerDays[pid].add(dayKey);
    }

    for (const pid of Object.keys(statsMap)) {
      const stat = statsMap[pid];
      const podiums = stat.gold + stat.silver + stat.bronze;
      stat.podiumPercentage = stat.matchesPlayed > 0
        ? Math.round((podiums / stat.matchesPlayed) * 100)
        : 0;
      stat.daysPlayed = perPlayerDays[pid]?.size ?? 0;

      const timeline = perPlayerTimeline[pid] ?? [];
      timeline.sort((a, b) => a.date.getTime() - b.date.getTime());
      if (timeline.length >= TREND_MIN_MATCHES) {
        const recentSlice = timeline.slice(-RECENT_WINDOW);
        const baselineSlice = timeline.slice(0, Math.max(0, timeline.length - recentSlice.length));
        const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

        const recent = avg(recentSlice.map((t) => t.score));
        stat.recentAvg = Math.round(recent * 100) / 100;

        if (baselineSlice.length > 0) {
          const baseline = avg(baselineSlice.map((t) => t.score));
          stat.baselineAvg = Math.round(baseline * 100) / 100;
          if (baseline === 0) {
            stat.trend = recent > 0 ? 'up' : 'stable';
          } else {
            const delta = (recent - baseline) / baseline;
            if (delta > TREND_THRESHOLD) stat.trend = 'up';
            else if (delta < -TREND_THRESHOLD) stat.trend = 'down';
            else stat.trend = 'stable';
          }
        } else {
          stat.trend = 'stable';
        }
      }
    }

    const statsArray = Object.values(statsMap);
    statsArray.sort((a, b) => b.score - a.score || b.podiumPercentage - a.podiumPercentage);

    return NextResponse.json(statsArray);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Errore nel caricamento delle statistiche' }, { status: 500 });
  }
}
