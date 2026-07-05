"use client";

import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

/**
 * Toggle giorno/notte in stile RGV. La sorgente di verità è
 * `document.documentElement.dataset.theme` (impostata pre-paint dallo script
 * inline nel layout). Il click flippa il tema, aggiorna il DOM e persiste in
 * localStorage. Emoji ☀️ (vai a chiaro) / 🌙 (vai a scuro), come RGV.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const cur = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    setTheme(cur);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('sport_theme', next);
    } catch {
      /* storage non disponibile: il tema resta per la sessione */
    }
    setTheme(next);
  };

  // Evita flash del glyph sbagliato prima dell'idratazione.
  if (theme === null) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      className="app-header-link theme-toggle"
      title={theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
      aria-label={theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
