import { Suspense } from 'react';
import DashboardMachiavelliNav from '@/components/DashboardMachiavelliNav';

/**
 * Layout della dashboard /machiavelli/*. Monta il nav, identico pattern
 * di /ko e /3v3. Suspense obbligatoria attorno ai componenti che usano
 * useSearchParams (Next 16 prerender requirement).
 */
export default function DashboardMachiavelliLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <Suspense fallback={null}>
        <DashboardMachiavelliNav />
      </Suspense>
      <Suspense fallback={null}>{children}</Suspense>
    </div>
  );
}
