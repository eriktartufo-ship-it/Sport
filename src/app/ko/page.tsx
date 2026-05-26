"use client";

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import MatchHistory, { type Match } from '@/components/MatchHistory';
import StatsCharts from '@/components/StatsCharts';
import SeasonSelector from '@/components/SeasonSelector';
import HeadToHead from '@/components/HeadToHead';
import RegisterFab from '@/components/RegisterFab';
import PlayerManagementCard from '@/components/PlayerManagementCard';

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

const VALID_TABS: TabId[] = ['classifica', 'grafici', 'dati', 'h2h', 'player'];

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showDeletedPlayers, setShowDeletedPlayers] = useState(false);

  // activeTab è derived da ?tab= nell'URL (gestito dal nav nel layout).
  // Default 'classifica' se param mancante/non valido.
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: TabId = VALID_TABS.includes(tabParam as TabId)
    ? (tabParam as TabId)
    : 'classifica';

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

  return (
    <div>
      {/* Il nav (DashboardNav) è montato nel ko/layout.tsx, visibile su
          tutte le pagine /ko/*. Qui sotto solo il content. */}

      <RegisterFab visible={isAuthenticated} />

      <div className="dashboard-header">
        <h1 className="title dashboard-title">K.O.</h1>
        {activeTab !== 'player' && activeTab !== 'h2h' && (
          <SeasonSelector seasons={seasons} value={season} onChange={setSeason} />
        )}
        {activeTab === 'player' && isAuthenticated && (
          <button
            type="button"
            className={`deleted-toggle${showDeletedPlayers ? ' is-active' : ''}`}
            onClick={() => setShowDeletedPlayers((v) => !v)}
            aria-pressed={showDeletedPlayers}
          >
            Mostra cancellati
          </button>
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
          <PlayerManagementCard
            players={players}
            isAuthenticated={isAuthenticated}
            onReload={() => load(season, showDeletedPlayers)}
          />
        )}
      </div>
    </div>
  );
}
