"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import ChartBox from './ChartBox';
import { LINE_COLORS } from './StatsCharts';
import { computePadelGameTimeline, type MatchPadelLite } from '@/lib/scoring-padel';

const formatDay = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;
const signed = (v: unknown) => (typeof v === 'number' && v > 0 ? `+${v}` : String(v));

// Tooltip coi token del tema (il K.O. lo ha scuro fisso). Fondo OPACO: con 10 giocatori
// il riquadro copre la legenda, e uno sfondo trasparente la lascia leggere attraverso.
const tooltipStyle = {
  backgroundColor: 'var(--page-bg)',
  boxShadow: 'var(--glass-shadow)',
  border: '1px solid var(--glass-border)',
  borderRadius: 8,
  fontSize: 13,
  color: 'var(--text)',
};
const tooltipLabelStyle = { color: 'var(--text)', fontWeight: 700 };

/**
 * Grafici della classifica persone del padel, in GAME (stessa unità della classifica):
 *  - differenza game cumulata a fine giornata → la linea che sale è chi sta migliorando;
 *  - differenza game media per partita in ogni giornata → la forma del giorno.
 * Stessa struttura dei grafici K.O. (`StatsCharts`), ma assi/griglia/tooltip seguono il tema
 * (classe `chart-themed`): in chiaro quelli del K.O. sono bianco su bianco.
 */
export default function PadelTrendCharts({ matches, order }: { matches: MatchPadelLite[]; order: string[] }) {
  const t = computePadelGameTimeline(matches, order);
  if (t.days.length === 0) return null;

  if (t.days.length < 2) {
    return (
      <div className="card chart-card">
        <h3 className="chart-title">📈 Andamento</h3>
        <p className="chart-desc">Serve almeno una seconda giornata per vedere chi sta migliorando.</p>
      </div>
    );
  }

  const toPoints = (series: typeof t.cumulative) =>
    t.days.map((k, i) => {
      const point: Record<string, string | number | null> = { day: formatDay(k) };
      for (const s of series) point[s.id] = s.values[i];
      return point;
    });

  const lines = (series: typeof t.cumulative) =>
    series.map((s, idx) => (
      <Line
        key={s.id}
        type="monotone"
        dataKey={s.id}
        name={s.name}
        stroke={LINE_COLORS[idx % LINE_COLORS.length]}
        strokeWidth={2}
        dot={{ r: 3 }}
        connectNulls={false}
        isAnimationActive={false}
      />
    ));

  const chart = (series: typeof t.cumulative, decimals: boolean) => (
    <ChartBox aspect={1.9} minHeight={280}>
      {({ width, height }) => (
        <LineChart width={width} height={height} data={toPoints(series)} margin={{ top: 10, right: 10, left: -10, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" fontSize={12} />
          <YAxis fontSize={12} allowDecimals={decimals} tickFormatter={signed} />
          <ReferenceLine y={0} strokeDasharray="4 4" />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            formatter={(v) => signed(v)}
            itemSorter={(item) => -(typeof item.value === 'number' ? item.value : -Infinity)}
          />
          {/* itemSorter null = legenda nell'ordine della classifica, non alfabetica */}
          <Legend wrapperStyle={{ fontSize: 12 }} itemSorter={null} />
          {lines(series)}
        </LineChart>
      )}
    </ChartBox>
  );

  return (
    <div className="charts-stack">
      <div className="card chart-card chart-themed">
        <h3 className="chart-title">📈 Chi sta migliorando</h3>
        <p className="chart-desc">
          Differenza game accumulata giornata dopo giornata. Una linea che sale = sta migliorando,
          una che scende = sta peggiorando. Sopra lo zero ha vinto più game di quanti ne ha persi.
        </p>
        {chart(t.cumulative, false)}
      </div>
      <div className="card chart-card chart-themed">
        <h3 className="chart-title">🔥 Forma per giornata</h3>
        <p className="chart-desc">
          Differenza game media per partita in ogni giornata: com&apos;è andata quel giorno, senza
          lo storico. Nessun punto = quel giorno non ha giocato.
        </p>
        {chart(t.perDay, true)}
      </div>
    </div>
  );
}
