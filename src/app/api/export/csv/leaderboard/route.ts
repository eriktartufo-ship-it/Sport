import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { computePlayerStats, type Medal } from '@/lib/scoring';
import { computeTeamRankings, type Match3v3Lite } from '@/lib/scoring-3v3';
import { computePlayerRankingsMachiavelli, type MatchMachiavelliLite } from '@/lib/scoring-machiavelli';
import { computePadelTeamRankings, parseSets, type MatchPadelLite } from '@/lib/scoring-padel';
import { toCsv, UTF8_BOM, type CsvColumn } from '@/lib/csv';

/**
 * GET /api/export/csv/leaderboard?sport=ko|3v3|machiavelli|padel&season=YYYY
 *   Esporta la CLASSIFICA di uno sport in CSV (UTF-8 BOM, Excel-friendly).
 *   Ogni sport ha la sua classifica "vera": ko + machiavelli = per GIOCATORE;
 *   3v3 = per SQUADRA; padel = per COPPIA. Colonne fedeli alla compute di ogni
 *   sport (legge gli stessi dati già esposti da /api/stats/<sport>).
 *   Default sport=ko (retro-compatibile).
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

// aggiunge la Posizione (1..N) a una classifica già ordinata
function withPos<T>(rows: T[]): (T & { pos: number })[] {
  return rows.map((r, i) => ({ ...r, pos: i + 1 }));
}

// --- K.O. (per giocatore) — colonne invariate per retro-compatibilità ---
async function buildKo(season: SeasonRange): Promise<string> {
  const sport = await prisma.sport.findUnique({ where: { name: 'K.O.' } });
  if (!sport) return UTF8_BOM + 'Posizione,Giocatore';

  const results = await prisma.matchResult.findMany({
    where: { match: { sportId: sport.id, ...(season ? { date: season } : {}) } },
    include: { player: true, match: { select: { date: true } } },
  });
  const stats = computePlayerStats(
    results.map((r) => ({
      matchId: r.matchId,
      playerId: r.playerId,
      medal: r.medal as Medal,
      player: { name: r.player.name },
      match: { date: r.match.date },
    }))
  );
  const rows = withPos(stats);
  const columns: CsvColumn<(typeof rows)[number]>[] = [
    { label: 'Posizione', value: (r) => r.pos },
    { label: 'Giocatore', value: (r) => r.name },
    { label: 'Score', value: (r) => r.score },
    { label: 'Oro', value: (r) => r.gold },
    { label: 'Argento', value: (r) => r.silver },
    { label: 'Bronzo', value: (r) => r.bronze },
    { label: 'Partite', value: (r) => r.matchesPlayed },
    { label: 'Giornate', value: (r) => r.daysPlayed },
    { label: 'Media', value: (r) => (r.score / (r.matchesPlayed || 1)).toFixed(2) },
    { label: 'Podio %', value: (r) => r.podiumPercentage },
    { label: 'Current Streak', value: (r) => r.currentStreak },
    { label: 'Best Streak', value: (r) => r.bestStreak },
    { label: 'Best Week (punti)', value: (r) => r.bestWeekPoints },
    { label: 'Best Week (chiave)', value: (r) => r.bestWeekKey },
    { label: 'Trend', value: (r) => r.trend },
    { label: 'Recent Avg', value: (r) => r.recentAvg },
    { label: 'Baseline Avg', value: (r) => r.baselineAvg },
  ];
  return UTF8_BOM + toCsv(rows, columns);
}

// --- 3v3 (per SQUADRA) ---
async function build3v3(season: SeasonRange): Promise<string> {
  const sport = await prisma.sport.findUnique({ where: { name: '3v3' } });
  if (!sport) return UTF8_BOM + 'Posizione,Squadra';

  const matches = await prisma.match3v3.findMany({
    where: { sportId: sport.id, ...(season ? { date: season } : {}) },
    orderBy: { date: 'asc' },
    include: { results: { include: { player: true } } },
  });
  const lite: Match3v3Lite[] = matches.map((m) => ({
    id: m.id,
    date: m.date,
    teamAScore: m.teamAScore,
    teamBScore: m.teamBScore,
    results: m.results.map((r) => ({
      playerId: r.playerId,
      teamSide: r.teamSide as 'A' | 'B',
      player: { name: r.player.name },
    })),
  }));
  const rows = withPos(computeTeamRankings(lite));
  const columns: CsvColumn<(typeof rows)[number]>[] = [
    { label: 'Posizione', value: (r) => r.pos },
    { label: 'Squadra', value: (r) => r.playerNames.join(' + ') },
    { label: 'Partite', value: (r) => r.played },
    { label: 'Vittorie', value: (r) => r.wins },
    { label: 'Sconfitte', value: (r) => r.losses },
    { label: 'WinRate %', value: (r) => Math.round(r.winRate * 100) },
    { label: 'Punti Fatti', value: (r) => r.pointsScoredTotal },
    { label: 'Punti Subiti', value: (r) => r.pointsConcededTotal },
    { label: 'Diff Media', value: (r) => r.pointDiffAvg.toFixed(2) },
  ];
  return UTF8_BOM + toCsv(rows, columns);
}

// --- Machiavelli (per GIOCATORE) ---
async function buildMachiavelli(season: SeasonRange): Promise<string> {
  const sport = await prisma.sport.findUnique({ where: { name: 'Machiavelli' } });
  if (!sport) return UTF8_BOM + 'Posizione,Giocatore';

  const matches = await prisma.matchMachiavelli.findMany({
    where: { sportId: sport.id, ...(season ? { date: season } : {}) },
    orderBy: { date: 'asc' },
    include: { results: { include: { player: true }, orderBy: { position: 'asc' } } },
  });
  const lite: MatchMachiavelliLite[] = matches.map((m) => ({
    id: m.id,
    date: m.date,
    results: m.results.map((r) => ({
      playerId: r.playerId,
      position: r.position,
      player: { name: r.player.name },
    })),
  }));
  const rows = withPos(computePlayerRankingsMachiavelli(lite));
  const columns: CsvColumn<(typeof rows)[number]>[] = [
    { label: 'Posizione', value: (r) => r.pos },
    { label: 'Giocatore', value: (r) => r.name },
    { label: 'Partite', value: (r) => r.played },
    { label: 'Vittorie', value: (r) => r.wins },
    { label: 'WinRate %', value: (r) => Math.round(r.winRate * 100) },
    { label: 'Punti Totali', value: (r) => r.points },
    { label: 'Media Punti', value: (r) => r.pointsAvg.toFixed(2) },
    { label: 'Current Streak', value: (r) => r.currentStreak },
    { label: 'Best Streak', value: (r) => r.bestStreak },
  ];
  return UTF8_BOM + toCsv(rows, columns);
}

// --- Padel (per COPPIA) ---
async function buildPadel(season: SeasonRange): Promise<string> {
  const sport = await prisma.sport.findUnique({ where: { name: 'Padel' } });
  if (!sport) return UTF8_BOM + 'Posizione,Coppia';

  const matches = await prisma.matchPadel.findMany({
    where: { sportId: sport.id, ...(season ? { date: season } : {}) },
    orderBy: { date: 'asc' },
    include: { results: { include: { player: true } } },
  });
  const lite: MatchPadelLite[] = matches.map((m) => ({
    id: m.id,
    date: m.date,
    sets: parseSets(m.setsJson),
    results: m.results.map((r) => ({
      playerId: r.playerId,
      teamSide: r.teamSide as 'A' | 'B',
      player: { name: r.player.name },
    })),
  }));
  const rows = withPos(computePadelTeamRankings(lite));
  const columns: CsvColumn<(typeof rows)[number]>[] = [
    { label: 'Posizione', value: (r) => r.pos },
    { label: 'Coppia', value: (r) => r.playerNames.join(' + ') },
    { label: 'Partite', value: (r) => r.played },
    { label: 'Vittorie', value: (r) => r.wins },
    { label: 'Sconfitte', value: (r) => r.losses },
    { label: 'WinRate %', value: (r) => Math.round(r.winRate * 100) },
    { label: 'Set Vinti', value: (r) => r.setsWon },
    { label: 'Set Persi', value: (r) => r.setsLost },
    { label: 'Game Vinti', value: (r) => r.gamesWon },
    { label: 'Game Persi', value: (r) => r.gamesLost },
    { label: 'Diff Game', value: (r) => r.gameDiff },
  ];
  return UTF8_BOM + toCsv(rows, columns);
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
  return `classifica-${sport}${seasonPart}-${date}.csv`;
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
