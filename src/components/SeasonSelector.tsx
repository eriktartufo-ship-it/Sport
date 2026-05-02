"use client";

type Props = {
  seasons: number[];
  value: number | 'all';
  onChange: (v: number | 'all') => void;
};

export default function SeasonSelector({ seasons, value, onChange }: Props) {
  return (
    <div className="season-selector">
      <label className="season-selector-label">Stagione</label>
      <select
        className="input season-selector-select"
        value={value === 'all' ? 'all' : String(value)}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === 'all' ? 'all' : parseInt(v, 10));
        }}
      >
        <option value="all">Tutte</option>
        {seasons.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}
