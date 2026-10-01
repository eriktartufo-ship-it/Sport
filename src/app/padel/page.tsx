"use client";

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import MatchDayList from '@/components/MatchDayList';
import SeasonSelector from '@/components/SeasonSelector';
import RegisterFab from '@/components/RegisterFab';
import PlayerManagementCard from '@/components/PlayerManagementCard';
import PadelRulesCard from '@/components/PadelRulesCard';
import Leaderboard, { LbStat } from '@/components/Leaderboard';
import { rankAttack, rankDefense } from '@/lib/scoring-padel';

type Side = 'A' | 'B';

type PadelTeamRanking = {
  teamKey: string;
  playerIds: string[];
  playerNames: string[];
  played: number;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  setsWon: number;
  setsLost: number;
  setDiff: number;
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
  draws: number;
  setsWon: number;
  setsLost: number;
  setDiff: number;
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
  /** Ordine dentro la giornata — vedi `src/lib/match-order.ts`. */
  createdAt: string | null;
  setsJson: string;
  results: { id: string; playerId: string; teamSide: Side; player: { id: string; name: string } }[];
};

type Player = { id: string; name: string; deletedAt?: string | null };
type TabId = 'classifica' | 'persone' | 'dati' | 'regole' | 'player';

const VALID_TABS: TabId[] = ['classifica', 'persone', 'dati', 'regole', 'player'];

const pct = (n: number) => `${Math.round(n * 100)}%`;
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const diffTone = (n: number) => (n > 0 ? 'good' : n < 0 ? 'bad' : undefined);
const diffClass = (n: number) => `lb-sub-diff${n > 0 ? ' is-good' : n < 0 ? ' is-bad' : ''}`;
const record = (r: { wins: number; draws: number; losses: number }) =>
  `${r.wins}V-${r.draws > 0 ? `${r.draws}P-` : ''}${r.losses}S`;
const matchesLabel = (n: number) => (n === 1 ? '1 partita' : `${n} partite`);

/** Quante righe mostrano le classifiche attaccanti/difensori. */
const TOP_AD = 5;

type SetRow = { id: string; name: string; setsWon: number; setsLost: number; played: number };

/** Le due classifiche sotto quella principale: attaccanti (più set vinti) e difensori (meno set persi). */
function AttackDefense({ rows }: { rows: SetRow[] }) {
  return (
    <div className="padel-ad-grid">
      <div className="card">
        <h2 className="card-title">⚔️ Migliori attaccanti</h2>
        <p className="card-hint">Chi ha vinto più set.</p>
        <Leaderboard
          rows={rankAttack(rows).slice(0, TOP_AD).map((r) => ({
            id: r.id,
            name: r.name,
            primaryValue: String(r.setsWon),
            primaryLabel: 'Set vinti',
            primaryTone: 'good',
            sub: <>in {matchesLabel(r.played)}</>,
          }))}
        />
      </div>
      <div className="card">
        <h2 className="card-title">🛡️ Migliori difensori</h2>
        <p className="card-hint">Chi ha perso meno set.</p>
        <Leaderboard
          rows={rankDefense(rows).slice(0, TOP_AD).map((r) => ({
            id: r.id,
            name: r.name,
            primaryValue: String(r.setsLost),
            primaryLabel: 'Set persi',
            primaryTone: 'accent',
            sub: <>in {matchesLabel(r.played)}</>,
          }))}
        />
      </div>
    </div>
  );
}

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
          <>
            <div className="card">
              <h2 className="card-title">Classifica Coppie</h2>
              <p className="card-hint">
                Vittoria 3 punti, pareggio 1, sconfitta 0. A pari punti conta la differenza set.
                Tocca una riga per i game.
              </p>
              {loading ? (
                <p>Caricamento...</p>
              ) : teams.length === 0 ? (
                <p>Nessuna partita {season !== 'all' ? `nella stagione ${season}` : 'registrata'}.</p>
              ) : (
                <Leaderboard
                  rows={teams.map((t, idx) => ({
                    id: t.teamKey,
                    name: t.playerNames.join(' + '),
                    crown: idx === 0 && t.points > 0,
                    primaryValue: String(t.points),
                    primaryLabel: 'Punti',
                    primaryTone: 'accent',
                    sub: (
                      <>
                        <span>{record(t)}</span>
                        <span className="lb-sub-sep">·</span>
                        <span>
                          set {t.setsWon}-{t.setsLost} <span className={diffClass(t.setDiff)}>({signed(t.setDiff)})</span>
                        </span>
                      </>
                    ),
                    details: (
                      <>
                        <LbStat label="Partite" value={t.played} />
                        <LbStat label="Game" value={`${t.gamesWon}-${t.gamesLost}`} />
                        <LbStat label="+/- game" value={signed(t.gameDiff)} />
                      </>
                    ),
                  }))}
                />
              )}
            </div>
            {!loading && teams.length > 0 && (
              <AttackDefense
                rows={teams.map((t) => ({
                  id: t.teamKey,
                  name: t.playerNames.join(' + '),
                  setsWon: t.setsWon,
                  setsLost: t.setsLost,
                  played: t.played,
                }))}
              />
            )}
          </>
        )}

        {activeTab === 'persone' && (
          <>
            <div className="card">
              <h2 className="card-title">Classifica Persone</h2>
              <p className="card-hint">
                Set vinti meno set persi, con qualunque compagno. Tocca una riga per game e compagni.
              </p>
              {loading ? (
                <p>Caricamento...</p>
              ) : persons.length === 0 ? (
                <p>Nessuna partita {season !== 'all' ? `nella stagione ${season}` : 'registrata'}.</p>
              ) : (
                <Leaderboard
                  rows={persons.map((p, idx) => ({
                    id: p.id,
                    name: p.name,
                    crown: idx === 0 && p.setDiff > 0,
                    badges: p.currentStreak > 1 ? <span className="streak-badge">🔥{p.currentStreak}</span> : undefined,
                    primaryValue: signed(p.setDiff),
                    primaryLabel: 'Diff set',
                    primaryTone: diffTone(p.setDiff),
                    sub: (
                      <>
                        <span>{p.setsWon} vinti · {p.setsLost} persi</span>
                        <span className="lb-sub-sep">·</span>
                        <span>{matchesLabel(p.played)}</span>
                      </>
                    ),
                    details: (
                      <>
                        <LbStat label="Risultati" value={record(p)} />
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
            {!loading && persons.length > 0 && (
              <AttackDefense
                rows={persons.map((p) => ({
                  id: p.id,
                  name: p.name,
                  setsWon: p.setsWon,
                  setsLost: p.setsLost,
                  played: p.played,
                }))}
              />
            )}
          </>
        )}

        {activeTab === 'dati' && (
          <div className="card">
            <h2 className="card-title">Cronologia Partite</h2>
            {loading ? (
              <p>Caricamento...</p>
            ) : matches.length === 0 ? (
              <p className="muted">Nessuna partita registrata.</p>
            ) : (
              <MatchDayList
                matches={matches}
                isAdmin={isAuthenticated}
                sport="padel"
                onReordered={() => load(season, showDeletedPlayers)}
                render={(m) => {
                  const teamA = m.results.filter((r) => r.teamSide === 'A');
                  const teamB = m.results.filter((r) => r.teamSide === 'B');
                  const sets = parseSets(m.setsJson);
                  let setsA = 0;
                  let setsB = 0;
                  for (const [a, b] of sets) { if (a > b) setsA++; else if (b > a) setsB++; }
                  // a parità di set è pareggio: nessuna delle due in oro
                  const aWon = setsA > setsB;
                  const bWon = setsB > setsA;
                  return {
                    meta: `${setsA}-${setsB} set${aWon || bWon ? '' : ' · pareggio'}`,
                    editHref: `/padel/match/${m.id}/edit`,
                    body: (
                      <div className="padel-match-body">
                        <div className="padel-teams">
                          <span className={`padel-team${aWon ? ' is-winner' : ''}`}>{teamA.map((r) => r.player.name).join(' + ')}</span>
                          <span className="padel-vs">vs</span>
                          <span className={`padel-team${bWon ? ' is-winner' : ''}`}>{teamB.map((r) => r.player.name).join(' + ')}</span>
                        </div>
                        <div className="padel-sets">
                          {sets.map(([a, b], i) => (
                            <span key={i} className={`padel-set${a > b ? ' a-win' : ' b-win'}`}>{a}-{b}</span>
                          ))}
                        </div>
                      </div>
                    ),
                  };
                }}
              />
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
