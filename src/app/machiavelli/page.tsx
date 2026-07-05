"use client";

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import SeasonSelector from '@/components/SeasonSelector';
import RegisterFab from '@/components/RegisterFab';
import PlayerManagementCard from '@/components/PlayerManagementCard';
import Leaderboard, { LbStat } from '@/components/Leaderboard';

type PlayerRankingMachiavelli = {
  id: string;
  name: string;
  played: number;
  wins: number;
  winRate: number;
  points: number;
  pointsAvg: number;
  currentStreak: number;
  bestStreak: number;
  lastWinDate: string | null;
};

type MatchMachiavelli = {
  id: string;
  date: string;
  results: { id: string; playerId: string; position: number; player: { id: string; name: string } }[];
};

type Player = { id: string; name: string; deletedAt?: string | null };
type TabId = 'classifica' | 'dati' | 'player';

const VALID_TABS: TabId[] = ['classifica', 'dati', 'player'];

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function DashboardMachiavelli() {
  const [persons, setPersons] = useState<PlayerRankingMachiavelli[]>([]);
  const [matches, setMatches] = useState<MatchMachiavelli[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasons, setSeasons] = useState<number[]>([]);
  const [season, setSeason] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showDeletedPlayers, setShowDeletedPlayers] = useState(false);

  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: TabId = VALID_TABS.includes(tabParam as TabId)
    ? (tabParam as TabId)
    : 'classifica';

  const load = useCallback(async (currentSeason: number | 'all', includeDeleted = false) => {
    setLoading(true);
    const seasonQS = currentSeason === 'all' ? '' : `?season=${currentSeason}`;
    const playersQS = includeDeleted ? '?includeDeleted=1' : '';
    try {
      const [statsRes, matchesRes, playersRes, authRes, seasonsRes] = await Promise.all([
        fetch(`/api/stats/machiavelli${seasonQS}`, { cache: 'no-store' }),
        fetch(`/api/matches/machiavelli${seasonQS}`, { cache: 'no-store' }),
        fetch(`/api/players${playersQS}`, { cache: 'no-store' }),
        fetch('/api/auth/me', { cache: 'no-store' }),
        fetch('/api/seasons/machiavelli', { cache: 'no-store' }),
      ]);

      if (statsRes.ok) {
        const j = await statsRes.json();
        setPersons(j.players || []);
      }
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
      <RegisterFab visible={isAuthenticated} href="/machiavelli/new-match" />

      <div className="dashboard-header">
        <h1 className="title dashboard-title">Machiavelli</h1>
        {activeTab !== 'player' && (
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

      {!isAuthenticated && activeTab === 'player' && (
        <p className="muted" style={{ marginBottom: '1.5rem' }}>
          Effettua il login dall&apos;header per gestire i giocatori.
        </p>
      )}

      <div className="dashboard-content">
        {activeTab === 'classifica' && (
          <div className="card">
            <h2 className="card-title">Classifica</h2>
            <p className="card-hint">Vince chi ha la media punti più bassa. Tocca una riga per i dettagli.</p>
            {loading ? (
              <p>Caricamento...</p>
            ) : persons.length === 0 ? (
              <p>Nessuna partita {season !== 'all' ? `nella stagione ${season}` : 'registrata'}.</p>
            ) : (
              <Leaderboard
                rows={persons.map((p, idx) => ({
                  id: p.id,
                  name: p.name,
                  crown: idx === 0 && p.played > 0,
                  badges: p.currentStreak > 1 ? <span className="streak-badge">🔥{p.currentStreak}</span> : undefined,
                  primaryValue: p.pointsAvg.toFixed(2),
                  primaryLabel: 'Media pt',
                  sub: (
                    <>
                      🏆 {p.wins} vittorie <span className="lb-sub-sep">·</span> {p.played} partite
                    </>
                  ),
                  details: (
                    <>
                      <LbStat label="Punti totali" value={p.points} />
                      <LbStat label="Vittorie" value={p.wins} />
                      <LbStat label="Serie in corso" value={p.currentStreak > 0 ? `🔥 ${p.currentStreak}` : '—'} />
                      <LbStat label="Serie migliore" value={p.bestStreak} />
                    </>
                  ),
                }))}
              />
            )}
          </div>
        )}

        {activeTab === 'dati' && (
          <div className="card">
            <h2 className="card-title">Cronologia Partite</h2>
            {loading ? (
              <p>Caricamento...</p>
            ) : matches.length === 0 ? (
              <p className="muted">Nessuna partita registrata.</p>
            ) : (
              <div>
                {matches.map((m) => {
                  const ranked = [...m.results].sort((a, b) => a.position - b.position);
                  return (
                    <div key={m.id} className="match-row">
                      <div className="match-row-head">
                        <span className="match-row-date">{formatDate(m.date)}</span>
                        <span className="match-row-count">{m.results.length} giocatori</span>
                        {isAuthenticated && (
                          <Link href={`/machiavelli/match/${m.id}/edit`} className="match-row-edit" title="Modifica partita">
                            ✏️
                          </Link>
                        )}
                      </div>
                      <div className="mk-standings">
                        {ranked.map((r) => (
                          <span
                            key={r.id}
                            className={`mk-standing${r.position === 1 ? ' is-winner' : ''}`}
                          >
                            <span className="mk-standing-pos" aria-hidden="true">
                              {r.position === 1 ? '👑' : `${r.position}°`}
                            </span>
                            <span className="mk-standing-name">{r.player.name}</span>
                            <span className="mk-standing-pts" aria-hidden="true">
                              {r.position === 1 ? '0' : `+${r.position - 1}`}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
