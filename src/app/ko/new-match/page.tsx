"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Player = { id: string, name: string };
type Medal = 'GOLD' | 'SILVER' | 'BRONZE' | 'NONE';

export default function NewKOMatch() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [medals, setMedals] = useState<Record<string, Medal>>({});
  
  const [saving, setSaving] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check Auth
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(auth => {
        if (!auth.authenticated) {
          alert('Devi effettuare il login per registrare una partita');
          router.push('/settings');
        } else {
          setIsAuthenticated(true);
          // Fetch players
          fetch('/api/players')
            .then(r => r.json())
            .then(data => {
              setPlayers(data);
              setLoading(false);
            });
        }
      })
      .catch(e => {
        console.error(e);
        router.push('/ko');
      });
  }, [router]);

  const togglePlayer = (id: string) => {
    setSelectedPlayers(prev => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        // Rimuovi medaglia se deselezionato
        const newMedals = { ...medals };
        delete newMedals[id];
        setMedals(newMedals);
        return prev.filter(p => p !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const assignMedal = (id: string, medal: Medal) => {
    setMedals(prev => {
      const newMedals = { ...prev };
      // Se assegno un Oro, rimuovo l'Oro dagli altri
      if (medal !== 'NONE') {
        Object.keys(newMedals).forEach(pid => {
          if (newMedals[pid] === medal) newMedals[pid] = 'NONE';
        });
      }
      newMedals[id] = medal;
      return newMedals;
    });
  };

  const handleSave = async () => {
    if (selectedPlayers.length < 3) {
      alert("Servono almeno 3 giocatori per una partita K.O.");
      return;
    }

    // Costruiamo i risultati, chi non ha medaglia prende NONE
    const results = selectedPlayers.map(id => ({
      playerId: id,
      medal: medals[id] || 'NONE'
    }));

    // Verifica regole
    const hasGold = results.some(r => r.medal === 'GOLD');
    if (!hasGold) {
      alert("Devi assegnare l'Oro!");
      return;
    }

    if (selectedPlayers.length >= 4) {
      const hasSilver = results.some(r => r.medal === 'SILVER');
      if (!hasSilver) {
        alert("Con 4 o più giocatori devi assegnare l'Argento!");
        return;
      }
    }

    if (selectedPlayers.length >= 5) {
      const hasBronze = results.some(r => r.medal === 'BRONZE');
      if (!hasBronze) {
        alert("Con 5 o più giocatori devi assegnare il Bronzo!");
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch('/api/matches/ko', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results })
      });
      
      if (res.ok) {
        alert("Partita salvata con successo!");
        router.push('/ko');
        router.refresh();
      } else {
        const err = await res.json();
        alert(err.error || "Errore nel salvataggio");
      }
    } catch (e) {
      alert("Errore di connessione");
    }
    setSaving(false);
  };

  if (loading) return <p>Caricamento giocatori...</p>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 className="title" style={{ fontSize: '2.5rem', textAlign: 'left' }}>Nuova Partita K.O.</h1>
      
      <div className="card" style={{ marginBottom: '2rem', background: 'linear-gradient(145deg, rgba(30,41,59,0.8), rgba(15,23,42,0.9))', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)' }}>
        <h2 style={{ marginBottom: '1rem' }}>1. Seleziona i partecipanti</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {players.map(p => {
            const isSelected = selectedPlayers.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePlayer(p.id)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '20px',
                  border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--card-border)'}`,
                  background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                  color: 'white',
                  transition: 'all 0.2s'
                }}
              >
                {p.name}
              </button>
            )
          })}
        </div>
        {players.length === 0 && <p>Nessun giocatore disponibile. Aggiungine uno dalla dashboard.</p>}
      </div>

      {selectedPlayers.length > 0 && (
        <div className="card animate-fade-in" style={{ marginBottom: '2rem', background: 'linear-gradient(145deg, rgba(30,41,59,0.8), rgba(15,23,42,0.9))', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)' }}>
          <h2 style={{ marginBottom: '1rem' }}>2. Assegna le Medaglie</h2>
          <p style={{ marginBottom: '1rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
            Giocatori in partita: <strong>{selectedPlayers.length}</strong> 
            {selectedPlayers.length < 3 && <span style={{ color: '#ef4444', marginLeft: '10px' }}>(Minimo 3 richiesti)</span>}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {selectedPlayers.map(id => {
              const player = players.find(p => p.id === id);
              const currentMedal = medals[id] || 'NONE';
              
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{player?.name}</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => assignMedal(id, 'GOLD')}
                      className={`btn ${currentMedal === 'GOLD' ? 'medal-gold' : 'medal-none'}`}
                      style={{ background: currentMedal === 'GOLD' ? 'rgba(251, 191, 36, 0.2)' : 'transparent', border: '1px solid currentColor' }}
                    >🥇 Oro</button>
                    
                    {selectedPlayers.length >= 4 && (
                      <button 
                        onClick={() => assignMedal(id, 'SILVER')}
                        className={`btn ${currentMedal === 'SILVER' ? 'medal-silver' : 'medal-none'}`}
                        style={{ background: currentMedal === 'SILVER' ? 'rgba(148, 163, 184, 0.2)' : 'transparent', border: '1px solid currentColor' }}
                      >🥈 Arg</button>
                    )}

                    {selectedPlayers.length >= 5 && (
                      <button 
                        onClick={() => assignMedal(id, 'BRONZE')}
                        className={`btn ${currentMedal === 'BRONZE' ? 'medal-bronze' : 'medal-none'}`}
                        style={{ background: currentMedal === 'BRONZE' ? 'rgba(180, 83, 9, 0.2)' : 'transparent', border: '1px solid currentColor' }}
                      >🥉 Bro</button>
                    )}

                    <button 
                      onClick={() => assignMedal(id, 'NONE')}
                      className="btn"
                      style={{ background: currentMedal === 'NONE' ? 'rgba(255,255,255,0.1)' : 'transparent', border: '1px solid rgba(255,255,255,0.2)' }}
                    >❌ Nessuna</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedPlayers.length >= 3 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
          <button className="btn" onClick={handleSave} disabled={saving} style={{ fontSize: '1.2rem', padding: '1rem 3rem' }}>
            {saving ? 'Salvataggio...' : 'Salva Partita'}
          </button>
        </div>
      )}
    </div>
  );
}
