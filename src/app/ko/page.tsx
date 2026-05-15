"use client";

import { useEffect, useState, useCallback } from 'react';
import MatchHistory, { type Match } from '@/components/MatchHistory';
import StatsCharts from '@/components/StatsCharts';
import SlideTabs from '@/components/SlideTabs';
import SeasonSelector from '@/components/SeasonSelector';
import HeadToHead from '@/components/HeadToHead';

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
  currentStreak: number;
  bestStreak: number;
  bestWeekPoints: number;
  bestWeekKey: string | null;
};

type Player = { id: string; name: string; deletedAt?: string | null };
type TabId = 'classifica' | 'grafici' | 'dati' | 'h2h' | 'player';

const DASHBOARD_TABS_BASE = [
  { id: 'classifica' as const, label: 'Classifica', short: 'Top', icon: '🏆' },
  { id: 'grafici' as const, label: 'Grafici', short: 'Stats', icon: '📈' },
  { id: 'dati' as const, label: 'Dati', short: 'Match', icon: '📋' },
  { id: 'h2h' as const, label: 'Confronto', short: 'H2H', icon: '⚔️' },
  { id: 'player' as const, label: 'Player', short: 'Player', icon: '👥' },
];

// CTA "Registra partita" disponibile solo se admin loggato.
// È un Link (href), non un tab di stato: cliccarlo naviga a /ko/new-match,
// NON sposta il pill highlight della tab attiva.
const REGISTER_TAB = {
  id: 'register' as const,
  label: 'Registra',
  short: '+',
  icon: '➕',
  href: '/ko/new-match',
  variant: 'cta' as const,
};

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
  const [showDeletedPlayers, setShowDeletedPlayers] = useState(false);

  const load = useCallback(async (currentSeason: number | 'all', includeDeletedPlayers = false) => {
    setLoading(true);
    const seasonQS = currentSeason === 'all' ? '' : `?season=${currentSeason}`;
    const playersQS = includeDeletedPlayers ? '?includeDeleted=1' : '';
    try {
      const [statsRes, matchesRes, playersRes, authRes, seasonsRes] = await Promise.all([
        fetch(`/api/stats/ko${seasonQS}`, { cache: 'no-store' }),
        fetch(`/api/matches/ko${seasonQS}`, { cache: 'no-store' }),
        fetch(`/api/players${playersQS}`, { cache: 'no-store' }),
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
    load(season, showDeletedPlayers);
  }, [load, season, showDeletedPlayers]);

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
        load(season, showDeletedPlayers);
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
        load(season, showDeletedPlayers);
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
    if (!confirm(`Cancellare "${player.name}"? Non sarà più selezionabile per nuove partite, ma la sua storia (medaglie, classifica, cronologia) resterà intatta. Puoi ripristinarlo in qualsiasi momento.`)) return;
    try {
      const res = await fetch(`/api/players/${player.id}`, { method: 'DELETE' });
      if (res.ok) {
        load(season, showDeletedPlayers);
      } else {
        const err = await res.json();
        alert(err.error || 'Errore nella cancellazione');
      }
    } catch {
      alert('Errore di connessione');
    }
  };

  const handleRestore = async (player: Player) => {
    try {
      const res = await fetch(`/api/players/${player.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restore: true }),
      });
      if (res.ok) {
        load(season, showDeletedPlayers);
      } else {
        const err = await res.json();
        alert(err.error || 'Errore nel ripristino');
      }
    } catch {
      alert('Errore di connessione');
    }
  };

  return (
    <div>
      <div className="dashboard-tabs-sticky">
        <SlideTabs
          tabs={isAuthenticated ? [...DASHBOARD_TABS_BASE, REGISTER_TAB] : DASHBOARD_TABS_BASE}
          active={activeTab}
          /* REGISTER_TAB ha href → SlideTabs non chiamerà mai onChange con
             'register'. Ma TS non sa restringere il tipo, quindi il wrapper
             filtra esplicitamente per sicurezza. */
          onChange={(id) => {
            if (id === 'register') return;
            setActiveTab(id);
          }}
        />
      </div>

      <div className="dashboard-header">
        <h1 className="title dashboard-title">K.O.</h1>
        {activeTab !== 'player' && activeTab !== 'h2h' && (
          <SeasonSelector seasons={seasons} value={season} onChange={setSeason} />
        )}
      </div>

      {/* Il pulsante "+ Registra Partita" è ora nel nav (tab CTA visibile solo se admin). */}
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
              <div className="leaderboard-cards">
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
                  const mediaPunti = (s.score / (s.matchesPlayed || 1)).toFixed(1);
                  return (
                    <div key={s.id} className="lb-card">
                      <div className="mc-header">
                        <span className="mc-pos">#{idx + 1}</span>
                        <span className="mc-name">
                          {s.name}
                          {trendNode}
                          {s.currentStreak >= 2 && (
                            <span
                              className="streak-badge"
                              title={`${s.currentStreak} vittorie consecutive`}
                              aria-label={`${s.currentStreak} vittorie consecutive`}
                            >
                              🔥{s.currentStreak}
                            </span>
                          )}
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
                        <div><span className="mc-stat-label">Best Streak</span><span className="mc-stat-value">{s.bestStreak > 0 ? `🔥${s.bestStreak}` : '—'}</span></div>
                        <div title={s.bestWeekKey ?? undefined}><span className="mc-stat-label">Best Week</span><span className="mc-stat-value">{s.bestWeekPoints > 0 ? s.bestWeekPoints : '—'}</span></div>
                      </div>
                    </div>
                  );
                })}
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

        {activeTab === 'h2h' && <HeadToHead players={players} />}

        {activeTab === 'player' && (
          <div className="card">
            <div className="player-tab-header">
              <h2 className="card-title" style={{ margin: 0 }}>Giocatori</h2>
              {isAuthenticated && (
                <label className="show-deleted-toggle">
                  <input
                    type="checkbox"
                    checked={showDeletedPlayers}
                    onChange={(e) => setShowDeletedPlayers(e.target.checked)}
                  />
                  <span>Mostra cancellati</span>
                </label>
              )}
            </div>

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
                            {isDeleted && <span className="player-deleted-tag" title={`Cancellato il ${new Date(p.deletedAt!).toLocaleDateString('it-IT')}`}>cancellato</span>}
                          </span>
                          {isAuthenticated && (
                            <div className="player-card-actions">
                              {isDeleted ? (
                                <button
                                  className="icon-btn icon-btn-restore"
                                  onClick={() => handleRestore(p)}
                                  aria-label={`Ripristina ${p.name}`}
                                  title="Ripristina"
                                >↩️</button>
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
        )}
      </div>
    </div>
  );
}
