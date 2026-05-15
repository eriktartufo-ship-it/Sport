import DashboardNav from '@/components/DashboardNav';

/**
 * Layout della dashboard /ko/*. Monta il nav che è visibile uniformemente
 * su tutte le sotto-pagine (incl. new-match, match/[id]/edit).
 * Niente "Torna alla home": il brand AuthHeader (globale) gia' linka a /.
 */
export default function KOLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <DashboardNav />
      {children}
    </div>
  );
}
