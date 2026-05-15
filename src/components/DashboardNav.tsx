"use client";

import { usePathname, useSearchParams } from 'next/navigation';
import SlideTabs, { type SlideTab } from './SlideTabs';

const DASHBOARD_TABS: SlideTab<string>[] = [
  { id: 'classifica', label: 'Classifica', short: 'Top', icon: '🏆', href: '/ko?tab=classifica' },
  { id: 'grafici', label: 'Grafici', short: 'Stats', icon: '📈', href: '/ko?tab=grafici' },
  { id: 'dati', label: 'Dati', short: 'Match', icon: '📋', href: '/ko?tab=dati' },
  { id: 'h2h', label: 'Confronto', short: 'H2H', icon: '⚔️', href: '/ko?tab=h2h' },
  { id: 'player', label: 'Player', short: 'Player', icon: '👥', href: '/ko?tab=player' },
];

/**
 * Nav della dashboard /ko montato nel ko/layout.tsx — visibile su TUTTE
 * le pagine sotto /ko/* (dashboard, new-match, match/[id]/edit).
 *
 * Tab tutti href-based (Link). L'active state deriva da pathname e
 * ?tab=. Su pagine diverse da /ko (es. /ko/new-match), nessun tab è
 * active → il pill highlight è invisibile (opacity 0). Cliccando un
 * tab si torna a /ko con quel tab pre-selezionato.
 */
export default function DashboardNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = pathname === '/ko' ? (params.get('tab') || 'classifica') : '';

  return (
    <div className="dashboard-tabs-sticky">
      <SlideTabs
        tabs={DASHBOARD_TABS}
        active={active}
        // Mai chiamato perché tutti i tab hanno href, ma TS lo richiede.
        onChange={() => {}}
      />
    </div>
  );
}
