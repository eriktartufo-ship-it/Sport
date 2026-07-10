import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/summary
 *   Aggregati READ-ONLY per il colpo d'occhio nel cockpit Cognitive OS
 *   (bucket "gestionale unico", B3-proxy dal cockpit su traefik-net).
 *   Solo CONTEGGI + ultima data partita: nessun nome/PII.
 *   GET pubblico, coerente con le altre GET di Sport (auth solo su mutazioni).
 */
export async function GET() {
  try {
    const [players, sports, ko, m3v3, machiavelli, padel] = await Promise.all([
      prisma.player.count({ where: { deletedAt: null } }),
      prisma.sport.count(),
      prisma.match.count(),
      prisma.match3v3.count(),
      prisma.matchMachiavelli.count(),
      prisma.matchPadel.count(),
    ]);

    const lasts = await Promise.all([
      prisma.match.findFirst({ orderBy: { date: 'desc' }, select: { date: true } }),
      prisma.match3v3.findFirst({ orderBy: { date: 'desc' }, select: { date: true } }),
      prisma.matchMachiavelli.findFirst({ orderBy: { date: 'desc' }, select: { date: true } }),
      prisma.matchPadel.findFirst({ orderBy: { date: 'desc' }, select: { date: true } }),
    ]);
    const lastMatch =
      lasts
        .map((x) => x?.date?.toISOString() ?? null)
        .filter((d): d is string => d !== null)
        .sort()
        .pop() ?? null;

    return NextResponse.json({
      players,
      sports,
      matches: { total: ko + m3v3 + machiavelli + padel, ko, '3v3': m3v3, machiavelli, padel },
      lastMatch,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Errore nel calcolo del summary' }, { status: 500 });
  }
}
