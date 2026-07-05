"use client";

import { usePathname, useSearchParams } from 'next/navigation';
import SlideTabs, { type SlideTab } from './SlideTabs';

const TABS: SlideTab<string>[] = [
  { id: 'classifica', label: 'Coppie', short: 'Coppie', icon: '🏆', href: '/padel?tab=classifica' },
  { id: 'persone', label: 'Persone', short: 'Persone', icon: '👤', href: '/padel?tab=persone' },
  { id: 'dati', label: 'Dati', short: 'Match', icon: '📋', href: '/padel?tab=dati' },
  { id: 'regole', label: 'Regole', short: 'Regole', icon: '📖', href: '/padel?tab=regole' },
  { id: 'player', label: 'Player', short: 'Player', icon: '👥', href: '/padel?tab=player' },
];

/**
 * Nav per /padel dashboard. Pattern mirror di Dashboard3v3Nav, 5 tab:
 * classifica per coppia, per persona, cronologia, scheda regole, gestione player.
 */
export default function DashboardPadelNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = pathname === '/padel' ? (params.get('tab') || 'classifica') : '';

  return (
    <div className="dashboard-tabs-sticky">
      <SlideTabs tabs={TABS} active={active} onChange={() => {}} />
    </div>
  );
}
