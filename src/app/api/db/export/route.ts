import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAdminSession } from '@/lib/auth';

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  try {
    const dbPath = path.join(process.cwd(), 'prisma', 'data', 'dev.db');
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: 'Database non trovato' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(dbPath);
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="dev.db"',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Errore durante l\'esportazione' }, { status: 500 });
  }
}
