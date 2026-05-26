"use client";

import { usePathname, useSearchParams } from 'next/navigation';
import SlideTabs, { type SlideTab } from './SlideTabs';

const TABS: SlideTab<string>[] = [
  { id: 'classifica', label: 'Classifica', short: 'Top', icon: '🏆', href: '/3v3?tab=classifica' },
  { id: 'persone', label: 'Persone', short: 'Persone', icon: '👤', href: '/3v3?tab=persone' },
  { id: 'dati', label: 'Dati', short: 'Match', icon: '📋', href: '/3v3?tab=dati' },
  { id: 'player', label: 'Player', short: 'Player', icon: '👥', href: '/3v3?tab=player' },
];

/**
 * Nav per /3v3 dashboard. Pattern mirror di DashboardNav (/ko).
 * 4 tab: classifica per combinazione team, classifica per persona,
 * cronologia partite, gestione player (riciclata da K.O.).
 */
export default function Dashboard3v3Nav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = pathname === '/3v3' ? (params.get('tab') || 'classifica') : '';

  return (
    <div className="dashboard-tabs-sticky">
      <SlideTabs
        tabs={TABS}
        active={active}
        onChange={() => {}}
      />
    </div>
  );
}
