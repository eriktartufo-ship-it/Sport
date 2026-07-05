"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PadelMatchForm, { type PadelSubmitPayload } from '@/components/PadelMatchForm';

type Player = { id: string; name: string };

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function NewMatchPadel() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((auth) => {
        if (!auth.authenticated) {
          alert('Devi effettuare il login per registrare una partita');
          router.push('/settings');
          return;
        }
        return fetch('/api/players')
          .then((r) => r.json())
          .then((data) => {
            setPlayers(data);
            setLoading(false);
          });
      })
      .catch((e) => {
        console.error(e);
        router.push('/padel');
      });
  }, [router]);

  const handleSubmit = async (payload: PadelSubmitPayload) => {
    const res = await fetch('/api/matches/padel', {
      method: 'POST',
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

  if (loading) return <p>Caricamento giocatori...</p>;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h1 className="title match-form-title">Nuova Partita Padel</h1>
      <PadelMatchForm
        players={players}
        initialDate={todayIso()}
        submitLabel="Salva Partita"
        onSubmit={handleSubmit}
        onCancel={() => router.push('/padel')}
      />
    </div>
  );
}
