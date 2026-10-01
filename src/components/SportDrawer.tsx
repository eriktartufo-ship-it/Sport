"use client";

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { SPORTS } from '@/lib/sports';

/**
 * Menù laterale con gli sport (al posto del vecchio link «🏠 Home» dell'header):
 * passa da uno sport all'altro al volo. Resta sempre montato per poter animare
 * l'entrata/uscita; da chiuso è `inert` (fuori dal tab e dai lettori di schermo).
 *
 * ⚠️ Va renderizzato FUORI da `<header>`: l'header ha `backdrop-filter`, che fa da
 * contenitore agli elementi `position: fixed` — dentro, il pannello si posizionerebbe
 * rispetto all'header invece che allo schermo.
 */
export default function SportDrawer({
  open,
  pathname,
  onClose,
}: {
  open: boolean;
  pathname: string;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);

  // Esc chiude, la pagina sotto non scorre, il focus entra nel pannello
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const items = [{ href: '/', name: 'Home', icon: '🏠' }, ...SPORTS];
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <div className={`sport-drawer${open ? ' is-open' : ''}`} inert={!open}>
      <div className="sport-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <nav
        id="sport-drawer"
        ref={panelRef}
        className="sport-drawer-panel"
        aria-label="Sport"
        role="dialog"
        aria-modal="true"
      >
        <div className="sport-drawer-head">
          <span className="sport-drawer-title">Sport</span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Chiudi menù">
            ✕
          </button>
        </div>
        <ul className="sport-drawer-list">
          {items.map((it) => {
            const active = isActive(it.href);
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className={`sport-drawer-item${active ? ' is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={onClose}
                >
                  <span className="sport-drawer-icon" aria-hidden="true">{it.icon}</span>
                  <span className="sport-drawer-name">{it.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
