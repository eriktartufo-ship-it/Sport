"use client";

import { usePathname, useSearchParams } from 'next/navigation';
import SlideTabs, { type SlideTab } from './SlideTabs';

const TABS: SlideTab<string>[] = [
  { id: 'classifica', label: 'Classifica', short: 'Top', icon: '🏆', href: '/machiavelli?tab=classifica' },
  { id: 'dati', label: 'Dati', short: 'Match', icon: '📋', href: '/machiavelli?tab=dati' },
  { id: 'player', label: 'Player', short: 'Player', icon: '👥', href: '/machiavelli?tab=player' },
];

/**
 * Nav per /machiavelli dashboard. Pattern mirror di Dashboard3v3Nav.
 * 3 tab: classifica per persona, cronologia partite, gestione player
 * (condivisa con K.O. e 3v3 — stessa tabella Player).
 */
export default function DashboardMachiavelliNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = pathname === '/machiavelli' ? (params.get('tab') || 'classifica') : '';

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
