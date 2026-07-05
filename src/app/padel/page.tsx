"use client";

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import SeasonSelector from '@/components/SeasonSelector';
import RegisterFab from '@/components/RegisterFab';
import PlayerManagementCard from '@/components/PlayerManagementCard';
import PadelRulesCard from '@/components/PadelRulesCard';
import Leaderboard, { LbStat } from '@/components/Leaderboard';

type Side = 'A' | 'B';

type PadelTeamRanking = {
  teamKey: string;
  playerIds: string[];
  playerNames: string[];
  played: number;
  wins: number;
  losses: number;
  winRate: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
};

type Teammate = { playerId: string; name: string; matchesTogether: number; winsTogether: number; winRateTogether: number };

type PadelPlayerRanking = {
  id: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  winRate: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
  currentStreak: number;
  bestStreak: number;
  bestTeammate: Teammate | null;
  worstTeammate: Teammate | null;
};

type MatchPadel = {
  id: string;
  date: string;
  setsJson: string;
  results: { id: string; playerId: string; teamSide: Side; player: { id: string; name: string } }[];
};

type Player = { id: string; name: string; deletedAt?: string | null };
type TabId = 'classifica' | 'persone' | 'dati' | 'regole' | 'player';

const VALID_TABS: TabId[] = ['classifica', 'persone', 'dati', 'regole', 'player'];

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const pct = (n: number) => `${Math.round(n * 100)}%`;
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

const parseSets = (json: string): [number, number][] => {
  try {
    const raw = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw.filter((s) => Array.isArray(s) && s.length === 2).map((s) => [Number(s[0]), Number(s[1])]);
  } catch {
    return [];
  }
};

export default function DashboardPadel() {
  const [teams, setTeams] = useState<PadelTeamRanking[]>([]);
  const [persons, setPersons] = useState<PadelPlayerRanking[]>([]);
  const [matches, setMatches] = useState<MatchPadel[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasons, setSeasons] = useState<number[]>([]);
  const [season, setSeason] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showDeletedPlayers, setShowDeletedPlayers] = useState(false);

  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: TabId = VALID_TABS.includes(tabParam as TabId) ? (tabParam as TabId) : 'classifica';

  const load = useCallback(async (currentSeason: number | 'all', includeDeleted = false) => {
    setLoading(true);
    const seasonQS = currentSeason === 'all' ? '' : `?season=${currentSeason}`;
    const playersQS = includeDeleted ? '?includeDeleted=1' : '';
    try {
      const [statsRes, matchesRes, playersRes, authRes, seasonsRes] = await Promise.all([
        fetch(`/api/stats/padel${seasonQS}`, { cache: 'no-store' }),
        fetch(`/api/matches/padel${seasonQS}`, { cache: 'no-store' }),
        fetch(`/api/players${playersQS}`, { cache: 'no-store' }),
        fetch('/api/auth/me', { cache: 'no-store' }),
        fetch('/api/seasons/padel', { cache: 'no-store' }),
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
      <RegisterFab visible={isAuthenticated} href="/padel/new-match" />

      <div className="dashboard-header">
        <h1 className="title dashboard-title">Padel</h1>
        {activeTab !== 'player' && activeTab !== 'regole' && (
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
            <h2 className="card-title">Classifica Coppie</h2>
            <p className="card-hint">Combinazione esatta di 2 giocatori. Tocca una riga per set e game.</p>
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
                      <LbStat label="Set" value={`${t.setsWon}-${t.setsLost}`} />
                      <LbStat label="Game" value={`${t.gamesWon}-${t.gamesLost}`} />
                      <LbStat label="+/- game" value={signed(t.gameDiff)} />
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
            <p className="card-hint">Tocca una riga per set, game e compagni migliori/peggiori.</p>
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
                  badges: p.currentStreak > 1 ? <span className="streak-badge">🔥{p.currentStreak}</span> : undefined,
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
                      <LbStat label="Set" value={`${p.setsWon}-${p.setsLost}`} />
                      <LbStat label="Game" value={`${p.gamesWon}-${p.gamesLost}`} />
                      <LbStat label="Serie migliore" value={p.bestStreak} />
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
                  const sets = parseSets(m.setsJson);
                  let setsA = 0;
                  let setsB = 0;
                  for (const [a, b] of sets) { if (a > b) setsA++; else setsB++; }
                  const aWon = setsA > setsB;
                  return (
                    <div key={m.id} className="match-row">
                      <div className="match-row-head">
                        <span className="match-row-date">{formatDate(m.date)}</span>
                        <span className="match-row-count">{setsA}-{setsB} set</span>
                        {isAuthenticated && (
                          <Link href={`/padel/match/${m.id}/edit`} className="match-row-edit" title="Modifica partita">✏️</Link>
                        )}
                      </div>
                      <div className="padel-match-body">
                        <div className="padel-teams">
                          <span className={`padel-team${aWon ? ' is-winner' : ''}`}>{teamA.map((r) => r.player.name).join(' + ')}</span>
                          <span className="padel-vs">vs</span>
                          <span className={`padel-team${!aWon ? ' is-winner' : ''}`}>{teamB.map((r) => r.player.name).join(' + ')}</span>
                        </div>
                        <div className="padel-sets">
                          {sets.map(([a, b], i) => (
                            <span key={i} className={`padel-set${a > b ? ' a-win' : ' b-win'}`}>{a}-{b}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'regole' && <PadelRulesCard />}

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
