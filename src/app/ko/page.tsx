"use client";

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import MatchHistory, { type Match } from '@/components/MatchHistory';
import StatsCharts from '@/components/StatsCharts';
import SeasonSelector from '@/components/SeasonSelector';
import HeadToHead from '@/components/HeadToHead';
import RegisterFab from '@/components/RegisterFab';
import PlayerManagementCard from '@/components/PlayerManagementCard';
import Leaderboard, { LbStat } from '@/components/Leaderboard';

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
              <Leaderboard
                rows={stats.map((s) => {
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
                  return {
                    id: s.id,
                    name: s.name,
                    badges: (
                      <>
                        {trendNode}
                        {s.currentStreak >= 2 && (
                          <span className="streak-badge" title={`${s.currentStreak} vittorie consecutive`}>
                            🔥{s.currentStreak}
                          </span>
                        )}
                      </>
                    ),
                    primaryValue: String(s.score),
                    primaryLabel: 'Score',
                    sub: (
                      <>
                        <span title="Oro">🥇 {s.gold}</span>
                        <span title="Argento">🥈 {s.silver}</span>
                        <span title="Bronzo">🥉 {s.bronze}</span>
                        <span className="lb-sub-sep">·</span> {s.matchesPlayed} partite
                      </>
                    ),
                    details: (
                      <>
                        <LbStat label="Media" value={mediaPunti} />
                        <LbStat label="Podio" value={`${s.podiumPercentage}%`} />
                        <LbStat label="Giornate" value={s.daysPlayed} />
                        <LbStat label="Serie migliore" value={s.bestStreak > 0 ? `🔥 ${s.bestStreak}` : '—'} />
                        <LbStat label="Best week" value={s.bestWeekPoints > 0 ? s.bestWeekPoints : '—'} />
                      </>
                    ),
                  };
                })}
              />
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
