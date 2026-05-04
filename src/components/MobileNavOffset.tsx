"use client";

import { useEffect } from 'react';

/**
 * Su iOS Safari/Chrome, `position: fixed; bottom: ...` è ancorato al
 * "layout viewport" non al "visual viewport". Quando la barra browser
 * collassa scrollando, il visual viewport cresce ma il nav non si sposta.
 * Risultato: il nav resta "in mezzo" tra il fondo della pagina e quello
 * effettivamente visibile.
 *
 * Fix: ascolto resize/scroll del Visual Viewport e setto una CSS var
 * `--nav-bottom-offset` con la differenza, che viene sommata a `bottom`
 * del wrapper del nav.
 *
 * Componente "headless" (no render), monta una volta in layout.
 */
export default function MobileNavOffset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const offset = window.innerHeight - vv.height - vv.offsetTop;
      document.documentElement.style.setProperty(
        '--nav-bottom-offset',
        `${Math.max(0, offset)}px`
      );
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return null;
}
