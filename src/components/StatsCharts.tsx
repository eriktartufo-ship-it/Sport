"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import ChartBox from './ChartBox';
import type { Match } from './MatchHistory';

type PlayerStat = {
  id: string;
  name: string;
  matchesPlayed: number;
  gold: number;
  silver: number;
  bronze: number;
  score: number;
  podiumPercentage: number;
};

const COLORS = {
  gold: '#fbbf24',
  silver: '#94a3b8',
  bronze: '#b45309',
  primary: '#3b82f6',
  grid: 'rgba(255,255,255,0.08)',
  axis: 'rgba(255,255,255,0.6)',
};

const SCORE_BY_MEDAL: Record<string, number> = {
  GOLD: 10,
  SILVER: 5,
  BRONZE: 2,
  NONE: 0,
};

// Paletta estesa: colori distinti per gestire molti player
const LINE_COLORS = [
  '#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f87171',
  '#22d3ee', '#fb923c', '#e879f9', '#84cc16', '#06b6d4',
  '#f43f5e', '#facc15', '#8b5cf6', '#ec4899', '#14b8a6',
];

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
};

const tooltipStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 8,
  fontSize: 13,
};

export default function StatsCharts({
  stats,
  matches,
}: {
  stats: PlayerStat[];
  matches: Match[];
}) {
  if (stats.length === 0) {
    return null;
  }

  // BarChart: top 8 (limite per leggibilità a 8 barre stacked)
  const topMedals = stats.slice(0, 8);
  const medalsData = topMedals.map((s) => ({
    name: s.name,
    Oro: s.gold,
    Argento: s.silver,
    Bronzo: s.bronze,
  }));

  // Trend chart: TUTTI i player presenti nelle stats
  const allIds = stats.map((s) => s.id);
  const allNames = new Map(stats.map((s) => [s.id, s.name]));

  const matchesAsc = [...matches].sort((a, b) => +new Date(a.date) - +new Date(b.date));

  const cumulative: Record<string, number> = {};
  allIds.forEach((id) => { cumulative[id] = 0; });

  // Aggregazione per giornata: ogni punto sul grafico = 1 data (non 1
  // match). 4 partite in un sabato → 1 solo punto sull'asse X col
  // cumulato fino a fine giornata. Senza questo, dopo 100+ match estivi
  // il grafico diventava illeggibile (asse X troppo denso).
  const byDay = new Map<string, typeof matchesAsc>();
  matchesAsc.forEach((m) => {
    const dayKey = new Date(m.date).toISOString().slice(0, 10);
    const arr = byDay.get(dayKey) ?? [];
    arr.push(m);
    byDay.set(dayKey, arr);
  });
  const sortedDays = Array.from(byDay.keys()).sort();

  const progressionData = sortedDays.map((dayKey) => {
    byDay.get(dayKey)!.forEach((m) => {
      m.results.forEach((r) => {
        if (cumulative[r.playerId] !== undefined) {
          cumulative[r.playerId] += SCORE_BY_MEDAL[r.medal] ?? 0;
        }
      });
    });
    const point: Record<string, number | string> = { date: formatDate(dayKey) };
    allIds.forEach((id) => {
      point[allNames.get(id) || id] = cumulative[id];
    });
    return point;
  });

  return (
    <div className="charts-stack">
      <div className="card chart-card">
        <h3 className="chart-title">🏅 Distribuzione medaglie (top 8)</h3>
        <ChartBox aspect={1.9} minHeight={280}>
          {({ width, height }) => (
            <BarChart
              width={width}
              height={height}
              data={medalsData}
              margin={{ top: 10, right: 10, left: -10, bottom: 30 }}
            >
              <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                stroke={COLORS.axis}
                fontSize={11}
                interval={0}
                angle={-30}
                textAnchor="end"
                tickMargin={8}
                height={50}
              />
              <YAxis stroke={COLORS.axis} fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="Oro" stackId="m" fill={COLORS.gold} />
              <Bar dataKey="Argento" stackId="m" fill={COLORS.silver} />
              <Bar dataKey="Bronzo" stackId="m" fill={COLORS.bronze} />
            </BarChart>
          )}
        </ChartBox>
      </div>

      {progressionData.length > 0 && (
        <div className="card chart-card">
          <h3 className="chart-title">📈 Punteggio cumulativo</h3>
          <p className="chart-desc">
            Tutti gli atleti, in ordine cronologico delle partite.
          </p>
          <ChartBox aspect={1.9} minHeight={280}>
            {({ width, height }) => (
              <LineChart
                width={width}
                height={height}
                data={progressionData}
                margin={{ top: 10, right: 10, left: -10, bottom: 30 }}
              >
                <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke={COLORS.axis} fontSize={12} />
                <YAxis stroke={COLORS.axis} fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {allIds.map((id, idx) => (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={allNames.get(id) || id}
                    stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            )}
          </ChartBox>
        </div>
      )}

      <WeeklyTrendChart matches={matchesAsc} allIds={allIds} allNames={allNames} />
    </div>
  );
}

type WeeklyPoint = { week: string } & Record<string, number | string | null>;

/**
 * Restituisce la chiave "YYYY-Www" della settimana ISO 8601 (lun→dom).
 * w01 = la settimana che contiene il primo giovedì dell'anno.
 * L'ordinamento alfabetico delle chiavi è anche cronologico.
 */
function getIsoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7; // lun=1, dom=7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum); // giovedì della stessa settimana
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function WeeklyTrendChart({
  matches,
  allIds,
  allNames,
}: {
  matches: Match[];
  allIds: string[];
  allNames: Map<string, string>;
}) {
  const weekBucket: Record<string, Record<string, { sum: number; count: number }>> = {};

  matches.forEach((m) => {
    const wk = getIsoWeekKey(new Date(m.date));
    m.results.forEach((r) => {
      if (!allIds.includes(r.playerId)) return;
      if (!weekBucket[wk]) weekBucket[wk] = {};
      if (!weekBucket[wk][r.playerId]) weekBucket[wk][r.playerId] = { sum: 0, count: 0 };
      weekBucket[wk][r.playerId].sum += SCORE_BY_MEDAL[r.medal] ?? 0;
      weekBucket[wk][r.playerId].count++;
    });
  });

  const weeks = Object.keys(weekBucket).sort();
  if (weeks.length < 2) {
    return null;
  }

  const data: WeeklyPoint[] = weeks.map((wk) => {
    const point: WeeklyPoint = { week: wk };
    allIds.forEach((id) => {
      const b = weekBucket[wk][id];
      const name = allNames.get(id) || id;
      point[name] = b ? Math.round((b.sum / b.count) * 10) / 10 : null;
    });
    return point;
  });

  return (
    <div className="card chart-card">
      <h3 className="chart-title">🔥 Andamento settimanale</h3>
      <p className="chart-desc">
        Punti medi per partita di ogni atleta, settimana per settimana (ISO lun→dom). Un trend in salita = forma in crescita.
      </p>
      <ChartBox aspect={1.9} minHeight={280}>
        {({ width, height }) => (
          <LineChart
            width={width}
            height={height}
            data={data}
            margin={{ top: 10, right: 10, left: -10, bottom: 30 }}
          >
            <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
            <XAxis dataKey="week" stroke={COLORS.axis} fontSize={11} />
            <YAxis stroke={COLORS.axis} fontSize={11} allowDecimals />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {allIds.map((id, idx) => (
              <Line
                key={id}
                type="monotone"
                dataKey={allNames.get(id) || id}
                stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        )}
      </ChartBox>
    </div>
  );
}
