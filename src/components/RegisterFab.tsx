"use client";

import Link from 'next/link';

/**
 * Floating Action Button "Registra partita" in alto-destra sopra il nav,
 * pattern WhatsApp/Material. Visibile solo se admin (prop `visible`).
 *
 * Posizionato con `position: fixed`. Il `bottom` è calcolato per stare
 * sopra il nav fisso: env(safe-area) + altezza nav + margine.
 * Usa anche --nav-bottom-offset per seguire il visualViewport su iOS
 * (vedi MobileNavOffset.tsx).
 */
export default function RegisterFab({
  visible,
  href = '/ko/new-match',
}: {
  visible: boolean;
  href?: string;
}) {
  if (!visible) return null;
  return (
    <Link
      href={href}
      className="register-fab"
      aria-label="Registra nuova partita"
      title="Registra nuova partita"
    >
      <span aria-hidden="true">➕</span>
    </Link>
  );
}
