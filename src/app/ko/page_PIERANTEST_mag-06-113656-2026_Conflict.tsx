"use client";

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import MatchHistory, { type Match } from '@/components/MatchHistory';
import StatsCharts from '@/components/StatsCharts';
import SlideTabs from '@/components/SlideTabs';
import SeasonSelector from '@/components/SeasonSelector';

type Trend = 'up' | 'down' | 'stable' | 'unknown';

type PlayerStat = {
  id: string;
  name: string;
  matchesPlayed: number;
  daysPlayed: number;
  gold: number;
  silver: number;
  bronze: number;
  score: number;
  podiumPercentage: number;
  recentAvg: number | null;
  baselineAvg: number | null;
  trend: Trend;
};

type Player = { id: string; name: string };
type TabId = 'classifica' | 'grafici' | 'dati' | 'player';

const DASHBOARD_TABS = [
  { id: 'classifica' as const, label: 'Classifica', short: 'Top', icon: '🏆' },
  { id: 'grafici' as const, label: 'Grafici', short: 'Stats', icon: '📈' },
  { id: 'dati' as const, label: 'Dati', short: 'Match', icon: '📋' },
  { id: 'player' as const, label: 'Player', short: 'Player', icon: '👥' },
];

const TREND_ICON: Record<Trend, string> = {
  up: '↗',
  down: '↘',
  stable: '→',
  unknown: '',
};

const TREND_LABEL: Record<Trend, string> = {
  up: 'In crescita',
  down: 'In calo',
  stable: 'Costante',
  unknown: 'Pochi dati',
};

export default function KODashboard() {
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasons, setSeasons] = useState<number[]>([]);
  const [season, setSeason] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('classifica');

  const load = useCallback(async (currentSeason: number | 'all') => {
    setLoading(true);
    const seasonQS = currentSeason === 'all' ? '' : `?season=${currentSeason}`;
    try {
      const [statsRes, matchesRes, playersRes, authRes, seasonsRes] = await Promise.all([
        fetch(`/api/stats/ko${seasonQS}`, { cache: 'no-store' }),
        fetch(`/api/matches/ko${seasonQS}`, { cache: 'no-store' }),
        fetch('/api/players', { cache: 'no-store' }),
        fetch('/api/auth/me', { cache: 'no-store' }),
        fetch('/api/seasons/ko', { cache: 'no-store' }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (matchesRes.ok) setMatches(await matchesRes.json());
      if (playersRes.ok) setPlayers(await playersRes.json());
      if (authRes.ok) setIsAuthenticated((await authRes.json()).authenticated);
      if (seasonsRes.ok) setSeasons(await seasonsRes.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(season);
  }, [load, season]);

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
        load(season);
      } else {
        const err = await res.json();
        alert(err.error || 'Errore');
      }
    } catch {
      alert('Errore di connessione');
    }
    setAddingPlayer(false);
  };

  const startEdit = (player: Player) => {
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
        load(season);
      } else {
        const err = await res.json();
        alert(err.error || 'Errore');
      }
    } catch {
      alert('Errore di connessione');
    }
    setSavingEdit(false);
  };

  const handleDelete = async (player: Player) => {
    if (!confirm(`Cancellare "${player.name}"? Verranno rimosse anche tutte le sue medaglie e risultati. L'azione è irreversibile.`)) return;
    try {
      const res = await fetch(`/api/players/${player.id}`, { method: 'DELETE' });
      if (res.ok) {
        load(season);
      } else {
        const err = await res.json();
        alert(err.error || 'Errore nella cancellazione');
      }
    } catch {
      alert('Errore di connessione');
    }
  };

  return (
    <div>
      <div className="dashboard-tabs-sticky">
        <SlideTabs tabs={DASHBOARD_TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      <div className="dashboard-header">
        <h1 className="title dashboard-title">K.O.</h1>
        {activeTab !== 'player' && (
          <SeasonSelector seasons={seasons} value={season} onChange={setSeason} />
        )}
      </div>

      {isAuthenticated && (
        <div className="dashboard-actions">
          <Link href="/ko/new-match" className="btn">+ Registra Partita</Link>
        </div>
      )}
      {!isAuthenticated && activeTab === 'player' && (
        <p className="muted" style={{ marginBottom: '1.5rem' }}>
          Effettua il login dall&apos;header per gestire i giocatori.
        </p>
      )}

      <div className="dashboard-content">
        {activeTab === 'classifica' && (
          <div className="card">
            <h2 className="card-title">Classifica Generale</h2>
            {loading ? (
              <p>Caricamento...</p>
            ) : stats.length === 0 ? (
              <p>Nessuna partita {season !== 'all' ? `nella stagione ${season}` : 'registrata'}.</p>
            ) : (
              <div className="table-wrap">
                <table className="leaderboard">
                  <thead>
                    <tr>
                      <th>Pos</th>
                      <th>Giocatore</th>
                      <th>Score</th>
                      <th className="medal-gold">🥇 Oro</th>
                      <th className="medal-silver">🥈 Arg</th>
                      <th className="medal-bronze">🥉 Bro</th>
                      <th>Partite</th>
                      <th>Giornate</th>
                      <th>Media</th>
                      <th>% Podio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((s, idx) => {
                      const trendNode = s.trend !== 'unknown' && (
                        <span
                          className={`trend trend-${s.trend}`}
                          title={`${TREND_LABEL[s.trend]} — ultime ${s.recentAvg !== null ? `${s.recentAvg} pt/match` : ''} vs storico ${s.baselineAvg !== null ? `${s.baselineAvg} pt/match` : ''}`}
                          aria-label={TREND_LABEL[s.trend]}
                        >
                          {TREND_ICON[s.trend]}
                        </span>
                      );
                      const podioBar = (
                        <div className="podium-cell">
                          <div className="podium-bar">
                            <div
                              className="podium-bar-fill"
                              style={{
                                width: `${s.podiumPercentage}%`,
                                background: s.podiumPercentage > 50 ? '#10b981' : 'var(--primary)',
                              }}
                            />
                          </div>
                          <span className="podium-pct">{s.podiumPercentage}%</span>
                        </div>
                      );
                      const mediaPunti = (s.score / (s.matchesPlayed || 1)).toFixed(1);
                      return (
                        <tr key={s.id}>
                          {/* Desktop: 9 td separati */}
                          <td className="dt-cell pos">#{idx + 1}</td>
                          <td className="dt-cell name-cell">
                            <span className="player-name-text">{s.name}</span>
                            {trendNode}
                          </td>
                          <td className="dt-cell score">{s.score}</td>
                          <td className="dt-cell">{s.gold}</td>
                          <td className="dt-cell">{s.silver}</td>
                          <td className="dt-cell">{s.bronze}</td>
                          <td className="dt-cell">{s.matchesPlayed}</td>
                          <td className="dt-cell">{s.daysPlayed}</td>
                          <td className="dt-cell muted">{mediaPunti}</td>
                          <td className="dt-cell">{podioBar}</td>

                          {/* Mobile: single card layout, hidden su desktop */}
                          <td className="mobile-card" colSpan={10}>
                            <div className="mc-header">
                              <span className="mc-pos">#{idx + 1}</span>
                              <span className="mc-name">
                                {s.name}
                                {trendNode}
                              </span>
                              <div className="mc-score-block">
                                <span className="mc-score-label">Score</span>
                                <span className="mc-score-value">{s.score}</span>
                              </div>
                            </div>
                            <div className="mc-medals">
                              <div className="mc-medal"><span aria-hidden="true">🥇</span> {s.gold}</div>
                              <div className="mc-medal"><span aria-hidden="true">🥈</span> {s.silver}</div>
                              <div className="mc-medal"><span aria-hidden="true">🥉</span> {s.bronze}</div>
                            </div>
                            <div className="mc-stats">
                              <div><span className="mc-stat-label">Partite</span><span className="mc-stat-value">{s.matchesPlayed}</span></div>
                              <div><span className="mc-stat-label">Giornate</span><span className="mc-stat-value">{s.daysPlayed}</span></div>
                              <div><span className="mc-stat-label">Media</span><span className="mc-stat-value">{mediaPunti}</span></div>
                              <div><span className="mc-stat-label">Podio</span><span className="mc-stat-value">{s.podiumPercentage}%</span></div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'grafici' && (
          <>
            {loading ? (
              <div className="card"><p>Caricamento grafici...</p></div>
            ) : stats.length === 0 ? (
              <div className="card">
                <p className="muted">
                  Nessun dato per {season !== 'all' ? `la stagione ${season}` : 'questa selezione'}.
                </p>
              </div>
            ) : (
              <StatsCharts stats={stats} matches={matches} />
            )}
          </>
        )}

        {activeTab === 'dati' && (
          <div className="card">
            <h2 className="card-title">Cronologia Partite</h2>
            {loading ? <p>Caricamento...</p> : <MatchHistory matches={matches} isAdmin={isAuthenticated} />}
          </div>
        )}

        {activeTab === 'player' && (
          <div className="card">
            <h2 className="card-title">Giocatori</h2>

            {isAuthenticated && (
              <form onSubmit={handleAddPlayer} className="add-player-form-inline">
                <input
                  type="text"
                  className="input"
                  placeholder="Nome del nuovo giocatore..."
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  required
                />
                <button type="submit" className="btn" disabled={addingPlayer}>
                  {addingPlayer ? 'Aggiunta...' : '+ Aggiungi'}
                </button>
              </form>
            )}

            {players.length === 0 ? (
              <p className="muted">Nessun giocatore.</p>
            ) : (
              <div className="player-grid">
                {players.map((p) => (
                  <div key={p.id} className="player-card">
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
                        <span className="player-card-name">{p.name}</span>
                        {isAuthenticated && (
                          <div className="player-card-actions">
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
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
