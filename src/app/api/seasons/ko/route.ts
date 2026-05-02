import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const sport = await prisma.sport.findUnique({ where: { name: 'K.O.' } });
    if (!sport) return NextResponse.json([]);

    const matches = await prisma.match.findMany({
      where: { sportId: sport.id },
      select: { date: true },
    });

    const years = new Set<number>();
    matches.forEach((m) => years.add(m.date.getUTCFullYear()));

    const sorted = Array.from(years).sort((a, b) => b - a);
    return NextResponse.json(sorted);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Errore nel caricamento delle stagioni' }, { status: 500 });
  }
}
