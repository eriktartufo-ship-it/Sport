import { Suspense } from 'react';
import DashboardPadelNav from '@/components/DashboardPadelNav';

/**
 * Layout della dashboard /padel/*. Monta il nav (pattern mirror /ko, /3v3).
 * Suspense obbligatoria per i componenti che usano useSearchParams (Next 16).
 */
export default function DashboardPadelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <Suspense fallback={null}>
        <DashboardPadelNav />
      </Suspense>
      <Suspense fallback={null}>{children}</Suspense>
    </div>
  );
}
