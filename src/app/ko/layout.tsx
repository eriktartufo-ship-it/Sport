import { Suspense } from 'react';
import DashboardNav from '@/components/DashboardNav';

/**
 * Layout della dashboard /ko/*. Monta il nav che è visibile uniformemente
 * su tutte le sotto-pagine (incl. new-match, match/[id]/edit).
 * Niente "Torna alla home": il brand AuthHeader (globale) gia' linka a /.
 *
 * Suspense boundary obbligatoria: DashboardNav usa useSearchParams() che
 * in Next.js 16 forza CSR bailout senza Suspense, rompendo il prerender
 * statico di /ko/new-match e /ko/match/[id]/edit.
 */
export default function KOLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <Suspense fallback={null}>
        <DashboardNav />
      </Suspense>
      <Suspense fallback={null}>{children}</Suspense>
    </div>
  );
}
