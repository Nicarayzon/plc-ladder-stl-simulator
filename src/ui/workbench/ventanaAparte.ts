// Ventana aparte de Señales E/S: mismo origen que la principal, React pinta dentro con un
// portal y usa el mismo simulador. Aquí van los estilos, el tema, las teclas 1–8, la geometría y el bombeo.
import { useEffect } from 'react';
import { LOOP_HZ, type SimController } from '../../sim/SimController';

export interface Geom { x: number; y: number; w: number; h: number }

export function leerGeom(clave: string): Geom | null {
  try {
    const g = JSON.parse(localStorage.getItem(clave) ?? 'null') as Geom | null;
    return g && [g.x, g.y, g.w, g.h].every(Number.isFinite) ? g : null;
  } catch {
    return null;
  }
}

export function guardarGeom(clave: string, w: Window) {
  try {
    if (w.closed) return;
    localStorage.setItem(clave, JSON.stringify({ x: w.screenX, y: w.screenY, w: w.outerWidth, h: w.outerHeight }));
  } catch { /* sin almacenamiento */ }
}

/** Estilos, tema y teclado de la ventana principal en la nueva, con un `<div id={rootId}>` para el portal. Devuelve la limpieza. */
export function prepararDocumento(w: Window, titulo: string, rootId: string): () => void {
  const doc = w.document;
  doc.title = titulo;
  doc.documentElement.lang = 'es';
  for (const n of document.head.querySelectorAll('style, link[rel="stylesheet"]')) {
    if (n instanceof HTMLLinkElement) {
      const l = doc.createElement('link');
      l.rel = 'stylesheet';
      l.href = n.href; // dirección completa: la ventana nueva es about:blank
      doc.head.appendChild(l);
    } else {
      const st = doc.createElement('style');
      st.textContent = n.textContent;
      doc.head.appendChild(st);
    }
  }
  const root = doc.createElement('div');
  root.id = rootId;
  doc.body.appendChild(root);
  // tema claro/oscuro: el mismo atributo que la principal, también si cambia después
  const copiarTema = () => {
    const t = document.documentElement.getAttribute('data-theme');
    if (t) doc.documentElement.setAttribute('data-theme', t);
    else doc.documentElement.removeAttribute('data-theme');
  };
  copiarTema();
  const mo = new MutationObserver(copiarTema);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  // teclas 1–8 (y Mayús) con esta ventana delante: las atiende la principal, salvo que las use la propia ventana
  const reenviar = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;
    const t = e.target as HTMLElement | null;
    if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    window.dispatchEvent(new KeyboardEvent(e.type, { key: e.key, code: e.code, shiftKey: e.shiftKey, repeat: e.repeat }));
  };
  w.addEventListener('keydown', reenviar);
  w.addEventListener('keyup', reenviar);
  return () => mo.disconnect();
}

/** Si la ventana principal está minimizada u oculta su bucle se para: entonces es esta ventana
 *  (con sus propios temporizadores) la que hace avanzar la simulación. */
export function useBombeo(sim: SimController, win: Window) {
  useEffect(() => {
    let t: number | undefined;
    const f = () => {
      sim.pump();
      t = win.setTimeout(f, sim.playing ? 1000 / LOOP_HZ : 200);
    };
    t = win.setTimeout(f, 200);
    return () => {
      if (!win.closed && t !== undefined) win.clearTimeout(t);
    };
  }, [sim, win]);
}
