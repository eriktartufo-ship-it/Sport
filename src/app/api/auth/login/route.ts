import { NextResponse } from 'next/server';
import { createAuthToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { LoginSchema, parseBody } from '@/lib/schemas';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = parseBody(LoginSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword || parsed.data.password !== adminPassword) {
      return NextResponse.json({ error: 'Password non valida' }, { status: 401 });
    }

    const token = await createAuthToken();
    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30, // 30 giorni
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
