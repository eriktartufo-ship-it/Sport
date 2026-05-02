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

  const top = stats.slice(0, 8);
  const medalsData = top.map((s) => ({
    name: s.name,
    Oro: s.gold,
    Argento: s.silver,
    Bronzo: s.bronze,
  }));

  const top5Ids = stats.slice(0, 5).map((s) => s.id);
  const top5Names = new Map(stats.slice(0, 5).map((s) => [s.id, s.name]));

  const matchesAsc = [...matches].sort((a, b) => +new Date(a.date) - +new Date(b.date));

  const cumulative: Record<string, number> = {};
  top5Ids.forEach((id) => { cumulative[id] = 0; });

  const progressionData = matchesAsc.map((m) => {
    m.results.forEach((r) => {
      if (cumulative[r.playerId] !== undefined) {
        cumulative[r.playerId] += SCORE_BY_MEDAL[r.medal] ?? 0;
      }
    });
    const point: Record<string, number | string> = { date: formatDate(m.date) };
    top5Ids.forEach((id) => {
      point[top5Names.get(id) || id] = cumulative[id];
    });
    return point;
  });

  const lineColors = ['#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f87171'];

  return (
    <div className="charts-stack">
      <div className="card chart-card">
        <h3 className="chart-title">🏅 Distribuzione medaglie (top 8)</h3>
        <ChartBox aspect={2.2} minHeight={240}>
          {({ width, height }) => (
            <BarChart width={width} height={height} data={medalsData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke={COLORS.axis} fontSize={12} />
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
          <h3 className="chart-title">📈 Punteggio cumulativo (top 5)</h3>
          <ChartBox aspect={2} minHeight={260}>
            {({ width, height }) => (
              <LineChart width={width} height={height} data={progressionData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke={COLORS.axis} fontSize={12} />
                <YAxis stroke={COLORS.axis} fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                {top5Ids.map((id, idx) => (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={top5Names.get(id) || id}
                    stroke={lineColors[idx % lineColors.length]}
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

      <MonthlyTrendChart matches={matchesAsc} top5Ids={top5Ids} top5Names={top5Names} lineColors={lineColors} />
    </div>
  );
}

type MonthlyPoint = { month: string } & Record<string, number | string | null>;

function MonthlyTrendChart({
  matches,
  top5Ids,
  top5Names,
  lineColors,
}: {
  matches: Match[];
  top5Ids: string[];
  top5Names: Map<string, string>;
  lineColors: string[];
}) {
  const monthBucket: Record<string, Record<string, { sum: number; count: number }>> = {};

  matches.forEach((m) => {
    const d = new Date(m.date);
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    m.results.forEach((r) => {
      if (!top5Ids.includes(r.playerId)) return;
      if (!monthBucket[ym]) monthBucket[ym] = {};
      if (!monthBucket[ym][r.playerId]) monthBucket[ym][r.playerId] = { sum: 0, count: 0 };
      monthBucket[ym][r.playerId].sum += SCORE_BY_MEDAL[r.medal] ?? 0;
      monthBucket[ym][r.playerId].count++;
    });
  });

  const months = Object.keys(monthBucket).sort();
  if (months.length < 2) {
    return null;
  }

  const data: MonthlyPoint[] = months.map((ym) => {
    const point: MonthlyPoint = { month: ym };
    top5Ids.forEach((id) => {
      const b = monthBucket[ym][id];
      const name = top5Names.get(id) || id;
      point[name] = b ? Math.round((b.sum / b.count) * 10) / 10 : null;
    });
    return point;
  });

  return (
    <div className="card chart-card">
      <h3 className="chart-title">🔥 Andamento mensile (top 5)</h3>
      <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '1rem' }}>
        Punti medi per partita per ogni mese. Un trend in salita = forma in crescita.
      </p>
      <ChartBox aspect={2.2} minHeight={240}>
        {({ width, height }) => (
          <LineChart width={width} height={height} data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
            <XAxis dataKey="month" stroke={COLORS.axis} fontSize={11} />
            <YAxis stroke={COLORS.axis} fontSize={11} allowDecimals />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            {top5Ids.map((id, idx) => (
              <Line
                key={id}
                type="monotone"
                dataKey={top5Names.get(id) || id}
                stroke={lineColors[idx % lineColors.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
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
