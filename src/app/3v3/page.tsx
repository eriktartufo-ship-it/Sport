"use client";

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import SeasonSelector from '@/components/SeasonSelector';
import RegisterFab from '@/components/RegisterFab';
import PlayerManagementCard from '@/components/PlayerManagementCard';
import Leaderboard, { LbStat } from '@/components/Leaderboard';

type Side = 'A' | 'B';

type TeamRanking = {
  teamKey: string;
  playerIds: string[];
  playerNames: string[];
  played: number;
  wins: number;
  losses: number;
  winRate: number;
  pointsScoredTotal: number;
  pointsConcededTotal: number;
  pointDiffAvg: number;
};

type Teammate = {
  playerId: string;
  name: string;
  matchesTogether: number;
  winsTogether: number;
  winRateTogether: number;
};

type PlayerRanking3v3 = {
  id: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  winRate: number;
  pointsScoredAvg: number;
  pointsScoredTotal: number;
  marginAvg: number;
  marginAvgOnWins: number;
  marginAvgOnLosses: number;
  bestTeammate: Teammate | null;
  worstTeammate: Teammate | null;
};

type Match3v3 = {
  id: string;
  date: string;
  teamAScore: number;
  teamBScore: number;
  results: { id: string; playerId: string; teamSide: Side; player: { id: string; name: string } }[];
};

type Player = { id: string; name: string; deletedAt?: string | null };
type TabId = 'classifica' | 'persone' | 'dati' | 'player';

const VALID_TABS: TabId[] = ['classifica', 'persone', 'dati', 'player'];

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const pct = (n: number) => `${Math.round(n * 100)}%`;
const signed = (n: number) => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1));

export default function Dashboard3v3() {
  const [teams, setTeams] = useState<TeamRanking[]>([]);
  const [persons, setPersons] = useState<PlayerRanking3v3[]>([]);
  const [matches, setMatches] = useState<Match3v3[]>([]);
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
        fetch(`/api/stats/3v3${seasonQS}`, { cache: 'no-store' }),
        fetch(`/api/matches/3v3${seasonQS}`, { cache: 'no-store' }),
        fetch(`/api/players${playersQS}`, { cache: 'no-store' }),
        fetch('/api/auth/me', { cache: 'no-store' }),
        fetch('/api/seasons/3v3', { cache: 'no-store' }),
      ]);

      if (statsRes.ok) {
        const j = await statsRes.json();
        setTeams(j.teams || []);
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
      <RegisterFab visible={isAuthenticated} href="/3v3/new-match" />

      <div className="dashboard-header">
        <h1 className="title dashboard-title">3vs3</h1>
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
            <h2 className="card-title">Classifica Squadre</h2>
            <p className="card-hint">Combinazione esatta di 3 giocatori. Tocca una riga per i dettagli.</p>
            {loading ? (
              <p>Caricamento...</p>
            ) : teams.length === 0 ? (
              <p>Nessuna partita {season !== 'all' ? `nella stagione ${season}` : 'registrata'}.</p>
            ) : (
              <Leaderboard
                rows={teams.map((t, idx) => ({
                  id: t.teamKey,
                  name: t.playerNames.join(' + '),
                  crown: idx === 0 && t.wins > 0,
                  primaryValue: pct(t.winRate),
                  primaryLabel: 'Win',
                  primaryTone: 'accent',
                  sub: (
                    <>
                      {t.wins}V-{t.losses}S <span className="lb-sub-sep">·</span> {t.played} partite
                    </>
                  ),
                  details: (
                    <>
                      <LbStat label="Punti fatti" value={t.pointsScoredTotal} />
                      <LbStat label="Punti subiti" value={t.pointsConcededTotal} />
                      <LbStat label="+/- media" value={signed(t.pointDiffAvg)} />
                    </>
                  ),
                }))}
              />
            )}
          </div>
        )}

        {activeTab === 'persone' && (
          <div className="card">
            <h2 className="card-title">Classifica Persone</h2>
            <p className="card-hint">Tocca una riga per medie e compagni migliori/peggiori.</p>
            {loading ? (
              <p>Caricamento...</p>
            ) : persons.length === 0 ? (
              <p>Nessuna partita {season !== 'all' ? `nella stagione ${season}` : 'registrata'}.</p>
            ) : (
              <Leaderboard
                rows={persons.map((p, idx) => ({
                  id: p.id,
                  name: p.name,
                  crown: idx === 0 && p.wins > 0,
                  primaryValue: pct(p.winRate),
                  primaryLabel: 'Win',
                  primaryTone: 'accent',
                  sub: (
                    <>
                      {p.wins}V-{p.losses}S <span className="lb-sub-sep">·</span> {p.played} partite
                    </>
                  ),
                  details: (
                    <>
                      <LbStat label="Pt squadra/media" value={p.pointsScoredAvg.toFixed(1)} />
                      <LbStat label="Margine" value={signed(p.marginAvg)} />
                      <LbStat label="Se vince" value={signed(p.marginAvgOnWins)} />
                      <LbStat label="Se perde" value={signed(p.marginAvgOnLosses)} />
                      {p.bestTeammate && (
                        <span className="lb-mate lb-mate-best">🤝 {p.bestTeammate.name} {pct(p.bestTeammate.winRateTogether)}</span>
                      )}
                      {p.worstTeammate && (
                        <span className="lb-mate lb-mate-worst">💔 {p.worstTeammate.name} {pct(p.worstTeammate.winRateTogether)}</span>
                      )}
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
                  const teamA = m.results.filter((r) => r.teamSide === 'A');
                  const teamB = m.results.filter((r) => r.teamSide === 'B');
                  const aWon = m.teamAScore > m.teamBScore;
                  return (
                    <div key={m.id} className="match-row">
                      <div className="match-row-head">
                        <span className="match-row-date">{formatDate(m.date)}</span>
                        <span className="match-row-count">{m.teamAScore} – {m.teamBScore}</span>
                        {isAuthenticated && (
                          <Link href={`/3v3/match/${m.id}/edit`} className="match-row-edit" title="Modifica partita">
                            ✏️
                          </Link>
                        )}
                      </div>
                      <div className="match-row-3v3-teams">
                        <span className={`team-3v3-line${aWon ? ' is-winner' : ''}`}>
                          <strong>{m.teamAScore}</strong> {teamA.map((r) => r.player.name).join(', ')}
                        </span>
                        <span className="team-3v3-vs">vs</span>
                        <span className={`team-3v3-line${!aWon ? ' is-winner' : ''}`}>
                          <strong>{m.teamBScore}</strong> {teamB.map((r) => r.player.name).join(', ')}
                        </span>
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
