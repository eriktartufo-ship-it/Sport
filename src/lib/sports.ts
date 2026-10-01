/**
 * Elenco degli sport — UNICA fonte per la home e per il menù laterale dell'header,
 * così ordine, nomi e icone non possono divergere fra le due.
 * Ordine scelto da Erik (2026-10-01): Padel sopra Machiavelli.
 */
export type SportEntry = {
  href: string;
  name: string;
  icon: string;
  desc: string;
};

export const SPORTS: SportEntry[] = [
  {
    href: '/ko',
    name: 'K.O.',
    icon: '🏀',
    desc: 'Il classico gioco a eliminazione del Basket. Vinci medaglie e scala le classifiche.',
  },
  {
    href: '/3v3',
    name: '3vs3',
    icon: '🤝',
    desc: 'Basket 3 contro 3, regolamento FIBA 3x3. Squadre, punti e classifiche per combinazione + per persona.',
  },
  {
    href: '/padel',
    name: 'Padel',
    icon: '🎾',
    desc: "2 vs 2 con le regole classiche (boccino d'oro, vantaggi sul 6-6). Segna i set e tieni le classifiche per coppia e per giocatore. Con la scheda regole sempre a portata.",
  },
  {
    href: '/machiavelli',
    name: 'Machiavelli',
    icon: '🃏',
    desc: 'Il gioco di carte: chi resta con le carte in mano perde. Tieni il conto di chi vince più spesso.',
  },
];

/** Lo sport della pagina corrente (anche dentro /padel/new-match ecc.), o null. */
export function sportOfPath(pathname: string): SportEntry | null {
  return SPORTS.find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`)) ?? null;
}
