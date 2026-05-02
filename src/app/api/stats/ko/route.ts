import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const sport = await prisma.sport.findUnique({ where: { name: 'K.O.' } });
    if (!sport) {
      return NextResponse.json([]); // Nessun dato ancora
    }

    // Recuperiamo tutti i risultati del K.O.
    const results = await prisma.matchResult.findMany({
      where: {
        match: {
          sportId: sport.id
        }
      },
      include: {
        player: true
      }
    });

    // Calcoliamo le statistiche
    const statsMap: Record<string, any> = {};

    results.forEach((res) => {
      const pid = res.playerId;
      if (!statsMap[pid]) {
        statsMap[pid] = {
          id: pid,
          name: res.player.name,
          matchesPlayed: 0,
          gold: 0,
          silver: 0,
          bronze: 0,
          score: 0, // Gold = 3, Silver = 2, Bronze = 1
        };
      }
      
      statsMap[pid].matchesPlayed++;
      
      if (res.medal === 'GOLD') {
        statsMap[pid].gold++;
        statsMap[pid].score += 5;
      } else if (res.medal === 'SILVER') {
        statsMap[pid].silver++;
        statsMap[pid].score += 3;
      } else if (res.medal === 'BRONZE') {
        statsMap[pid].bronze++;
        statsMap[pid].score += 1;
      }
    });

    // Convertiamo in array e calcoliamo stats derivate
    const statsArray = Object.values(statsMap).map(stat => {
      const podiums = stat.gold + stat.silver + stat.bronze;
      stat.podiumPercentage = stat.matchesPlayed > 0 
        ? Math.round((podiums / stat.matchesPlayed) * 100) 
        : 0;
      return stat;
    });

    // Ordiniamo per score, poi per percentuale podi
    statsArray.sort((a, b) => b.score - a.score || b.podiumPercentage - a.podiumPercentage);

    return NextResponse.json(statsArray);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Errore nel caricamento delle statistiche' }, { status: 500 });
  }
}
