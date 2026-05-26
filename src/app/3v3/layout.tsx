import { Suspense } from 'react';
import Dashboard3v3Nav from '@/components/Dashboard3v3Nav';

/**
 * Layout della dashboard /3v3/*. Monta il nav, identico pattern di /ko.
 * Suspense obbligatoria attorno ai componenti che usano useSearchParams
 * (Next 16 prerender requirement).
 */
export default function Dashboard3v3Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <Suspense fallback={null}>
        <Dashboard3v3Nav />
      </Suspense>
      <Suspense fallback={null}>{children}</Suspense>
    </div>
  );
}
