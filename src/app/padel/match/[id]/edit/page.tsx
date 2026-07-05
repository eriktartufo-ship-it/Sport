"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import PadelMatchForm, { type PadelSubmitPayload } from '@/components/PadelMatchForm';

type Player = { id: string; name: string };
type Side = 'A' | 'B';

const dateToIso = (d: string | Date) => {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

type MatchPadelResp = {
  id: string;
  date: string;
  setsJson: string;
  results: { id: string; playerId: string; teamSide: Side; player: Player }[];
};

export default function EditMatchPadel({ params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = use(params);
  const router = useRouter();

  const [players, setPlayers] = useState<Player[]>([]);
  const [initialAssign, setInitialAssign] = useState<Record<string, Side | null>>({});
  const [initialSets, setInitialSets] = useState<{ a: number; b: number }[]>([]);
  const [initialDate, setInitialDate] = useState(dateToIso(new Date()));
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const auth = await fetch('/api/auth/me').then((r) => r.json());
        if (!auth.authenticated) {
          alert('Devi effettuare il login per modificare una partita');
          router.push('/padel');
          return;
        }
        const [matchRes, playersRes] = await Promise.all([
          fetch(`/api/matches/padel/${matchId}`),
          fetch('/api/players?includeDeleted=1'),
        ]);
        if (!matchRes.ok) {
          setErrorMsg('Partita non trovata');
          setLoading(false);
          return;
        }
        const match: MatchPadelResp = await matchRes.json();
        setPlayers(await playersRes.json());
        setInitialDate(dateToIso(match.date));
        const assign: Record<string, Side | null> = {};
        for (const r of match.results) assign[r.playerId] = r.teamSide;
        setInitialAssign(assign);
        try {
          const raw = JSON.parse(match.setsJson);
          setInitialSets(Array.isArray(raw) ? raw.map((s: [number, number]) => ({ a: Number(s[0]), b: Number(s[1]) })) : []);
        } catch {
          setInitialSets([]);
        }
        setLoading(false);
      } catch (e) {
        console.error(e);
        setErrorMsg('Errore di connessione');
        setLoading(false);
      }
    })();
  }, [matchId, router]);

  const handleSubmit = async (payload: PadelSubmitPayload) => {
    const res = await fetch(`/api/matches/padel/${matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      router.push('/padel?tab=dati');
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Errore');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Cancellare definitivamente questa partita? Azione irreversibile.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/matches/padel/${matchId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/padel?tab=dati');
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || 'Errore nella cancellazione');
      }
    } catch {
      setErrorMsg('Errore di connessione');
    }
    setDeleting(false);
  };

  if (loading) return <p>Caricamento...</p>;
  if (errorMsg && !players.length) return <p style={{ color: 'var(--danger)' }}>{errorMsg}</p>;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h1 className="title match-form-title">Modifica Partita Padel</h1>
      <PadelMatchForm
        players={players}
        initialDate={initialDate}
        initialAssign={initialAssign}
        initialSets={initialSets}
        submitLabel="Salva modifiche"
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        onCancel={() => router.push('/padel?tab=dati')}
        deleting={deleting}
      />
      {errorMsg && (
        <p className="muted" style={{ color: 'var(--danger)', textAlign: 'center', marginTop: '1rem' }}>{errorMsg}</p>
      )}
    </div>
  );
}
