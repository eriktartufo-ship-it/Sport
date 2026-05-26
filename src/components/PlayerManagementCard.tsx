"use client";

import { useState } from 'react';

export type ManagedPlayer = { id: string; name: string; deletedAt?: string | null };

/**
 * Card di gestione giocatori condiviso tra /ko?tab=player e /3v3?tab=player.
 * Tutta la logica (add, rename inline, soft delete, restore, hard delete)
 * vive qui. Il parent passa lista + flag auth + callback di reload.
 *
 * Hard delete bloccato server-side a 409 se il player ha results in K.O.
 * o 3v3 → l'utente deve prima cancellare le partite o usare soft-delete.
 */
export default function PlayerManagementCard({
  players,
  isAuthenticated,
  onReload,
}: {
  players: ManagedPlayer[];
  isAuthenticated: boolean;
  onReload: () => void;
}) {
  const [newPlayerName, setNewPlayerName] = useState('');
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    setAddingPlayer(true);
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPlayerName }),
      });
      if (res.ok) {
        setNewPlayerName('');
        onReload();
      } else {
        const err = await res.json();
        alert(err.error || 'Errore');
      }
    } catch {
      alert('Errore di connessione');
    }
    setAddingPlayer(false);
  };

  const startEdit = (player: ManagedPlayer) => {
    setEditingId(player.id);
    setEditingName(player.name);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const saveEdit = async (id: string) => {
    if (!editingName.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/players/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName }),
      });
      if (res.ok) {
        cancelEdit();
        onReload();
      } else {
        const err = await res.json();
        alert(err.error || 'Errore');
      }
    } catch {
      alert('Errore di connessione');
    }
    setSavingEdit(false);
  };

  const handleDelete = async (player: ManagedPlayer) => {
    if (
      !confirm(
        `Cancellare "${player.name}"? Non sarà più selezionabile per nuove partite, ma la sua storia resterà intatta. Puoi ripristinarlo in qualsiasi momento.`
      )
    ) return;
    try {
      const res = await fetch(`/api/players/${player.id}`, { method: 'DELETE' });
      if (res.ok) {
        onReload();
      } else {
        const err = await res.json();
        alert(err.error || 'Errore nella cancellazione');
      }
    } catch {
      alert('Errore di connessione');
    }
  };

  const handleRestore = async (player: ManagedPlayer) => {
    try {
      const res = await fetch(`/api/players/${player.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restore: true }),
      });
      if (res.ok) {
        onReload();
      } else {
        const err = await res.json();
        alert(err.error || 'Errore nel ripristino');
      }
    } catch {
      alert('Errore di connessione');
    }
  };

  const handleHardDelete = async (player: ManagedPlayer) => {
    if (
      !confirm(
        `Eliminare DEFINITIVAMENTE "${player.name}" dal database? Azione irreversibile. Funziona solo se il giocatore non ha mai giocato partite.`
      )
    ) return;
    try {
      const res = await fetch(`/api/players/${player.id}?force=1`, { method: 'DELETE' });
      if (res.ok) {
        onReload();
      } else {
        const err = await res.json();
        alert(err.error || 'Errore nella cancellazione definitiva');
      }
    } catch {
      alert('Errore di connessione');
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">Giocatori</h2>

      {isAuthenticated && (
        <form onSubmit={handleAddPlayer} className="add-player-inline">
          <input
            type="text"
            className="input add-player-input"
            placeholder="Aggiungi giocatore..."
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            required
            aria-label="Nome del nuovo giocatore"
          />
          <button
            type="submit"
            className="icon-btn-cta"
            disabled={addingPlayer}
            aria-label="Aggiungi giocatore"
            title="Aggiungi giocatore"
          >
            {addingPlayer ? '…' : '+'}
          </button>
        </form>
      )}

      {players.length === 0 ? (
        <p className="muted">Nessun giocatore.</p>
      ) : (
        <div className="player-grid">
          {players.map((p) => {
            const isDeleted = !!p.deletedAt;
            return (
              <div key={p.id} className={`player-card${isDeleted ? ' player-card-deleted' : ''}`}>
                {editingId === p.id ? (
                  <>
                    <input
                      type="text"
                      className="input input-sm player-edit-input"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(p.id);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                    />
                    <button
                      className="icon-btn"
                      onClick={() => saveEdit(p.id)}
                      disabled={savingEdit}
                      aria-label="Salva"
                    >✓</button>
                    <button className="icon-btn" onClick={cancelEdit} aria-label="Annulla">✕</button>
                  </>
                ) : (
                  <>
                    <span className="player-card-name">
                      {p.name}
                      {isDeleted && (
                        <span
                          className="player-deleted-tag"
                          title={`Cancellato il ${new Date(p.deletedAt!).toLocaleDateString('it-IT')}`}
                        >
                          cancellato
                        </span>
                      )}
                    </span>
                    {isAuthenticated && (
                      <div className="player-card-actions">
                        {isDeleted ? (
                          <>
                            <button
                              className="icon-btn icon-btn-restore"
                              onClick={() => handleRestore(p)}
                              aria-label={`Ripristina ${p.name}`}
                              title="Ripristina"
                            >↩️</button>
                            <button
                              className="icon-btn icon-btn-danger"
                              onClick={() => handleHardDelete(p)}
                              aria-label={`Elimina definitivamente ${p.name}`}
                              title="Elimina definitivamente (solo se 0 partite)"
                            >🗑️</button>
                          </>
                        ) : (
                          <>
                            <button
                              className="icon-btn"
                              onClick={() => startEdit(p)}
                              aria-label={`Modifica ${p.name}`}
                              title="Modifica nome"
                            >✏️</button>
                            <button
                              className="icon-btn icon-btn-danger"
                              onClick={() => handleDelete(p)}
                              aria-label={`Cancella ${p.name}`}
                              title="Cancella"
                            >🗑️</button>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
