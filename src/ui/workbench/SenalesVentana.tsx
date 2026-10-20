// Señales E/S (analizador lógico) en una ventana aparte, para tenerlas en otro monitor.
// La ventana es del mismo origen que la principal: React pinta dentro con un portal y usa el
// mismo simulador, así que no hay que copiar datos entre ventanas.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LOOP_HZ, type SimController } from '../../sim/SimController';
import type { SignalView } from '../../sim/analyzer';
import { AnalyzerPanel } from './AnalyzerPanel';
import { CycleStatus } from './Toolbar';
import { useSimTick } from './useSim';
import { Icon } from '../common/Icon';
import { toast } from '../common/ui';

const GEOM_KEY = 'automatizacion-senales-ventana';
const NOMBRE = 'senales';

export interface SenalesVentana {
  /** Ventana aparte abierta (null = las señales van abajo, en la ventana principal) */
  win: Window | null;
  abrir: () => void;
  cerrar: () => void;
}

interface Geom { x: number; y: number; w: number; h: number }

function leerGeom(): Geom | null {
  try {
    const g = JSON.parse(localStorage.getItem(GEOM_KEY) ?? 'null') as Geom | null;
    return g && [g.x, g.y, g.w, g.h].every(Number.isFinite) ? g : null;
  } catch {
    return null;
  }
}

function guardarGeom(w: Window) {
  try {
    if (w.closed) return;
    localStorage.setItem(GEOM_KEY, JSON.stringify({ x: w.screenX, y: w.screenY, w: w.outerWidth, h: w.outerHeight }));
  } catch { /* sin almacenamiento */ }
}

/** Estilos, tema y teclado de la ventana principal en la nueva. */
function prepararDocumento(w: Window): () => void {
  const doc = w.document;
  doc.title = 'Señales E/S — Automatizacion';
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
  root.id = 'senales-root';
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
  // teclas 1–8 (y Mayús) con la ventana de señales delante: las atiende la principal
  const reenviar = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    window.dispatchEvent(new KeyboardEvent(e.type, { key: e.key, code: e.code, shiftKey: e.shiftKey, repeat: e.repeat }));
  };
  w.addEventListener('keydown', reenviar);
  w.addEventListener('keyup', reenviar);
  return () => mo.disconnect();
}

/** Abre y cierra la ventana de señales. Vive en la pantalla del simulador: sobrevive al cambiar de proyecto. */
export function useSenalesVentana(): SenalesVentana {
  const [win, setWin] = useState<Window | null>(null);
  const limpiar = useRef<(() => void) | null>(null);

  const cerrar = useCallback(() => {
    setWin((w) => {
      if (w && !w.closed) {
        guardarGeom(w);
        w.close();
      }
      return null;
    });
  }, []);

  const abrir = useCallback(() => {
    const g = leerGeom();
    const feats = g ? `left=${g.x},top=${g.y},width=${g.w},height=${g.h}` : 'width=1100,height=460';
    const w = window.open('', NOMBRE, feats);
    if (!w) {
      toast('No se ha podido abrir la ventana de señales');
      return;
    }
    if (!w.document.getElementById('senales-root')) {
      limpiar.current?.();
      limpiar.current = prepararDocumento(w);
    }
    w.focus();
    setWin(w);
  }, []);

  // la ventana se cierra con su botón rojo: las señales vuelven a la principal
  useEffect(() => {
    if (!win) return;
    const onHide = () => guardarGeom(win);
    win.addEventListener('pagehide', onHide);
    const iv = window.setInterval(() => {
      if (win.closed) {
        limpiar.current?.();
        limpiar.current = null;
        setWin(null);
      } else guardarGeom(win);
    }, 500);
    return () => {
      clearInterval(iv);
      if (!win.closed) win.removeEventListener('pagehide', onHide);
    };
  }, [win]);

  // al salir del simulador o cerrar la app, la ventana de señales se cierra también
  const winRef = useRef(win);
  winRef.current = win;
  useEffect(() => {
    const bye = () => { const w = winRef.current; if (w && !w.closed) { guardarGeom(w); w.close(); } };
    window.addEventListener('beforeunload', bye);
    return () => {
      window.removeEventListener('beforeunload', bye);
      bye();
      limpiar.current?.();
      limpiar.current = null;
    };
  }, []);

  return { win, abrir, cerrar };
}

function EstadoCpu({ sim }: { sim: SimController }) {
  useSimTick(sim, 8, () => [sim.rev, sim.cpu.state, sim.playing]);
  const run = sim.cpu.state === 'RUN';
  return (
    <>
      <span className="led-label"><span className={`led ${run ? 'on' : ''}`} />RUN</span>
      <span className="led-label"><span className={`led yellow ${!run ? 'on' : ''}`} />STOP</span>
      {run && !sim.playing && <span className="warn-text" style={{ fontSize: 12 }}>en pausa</span>}
    </>
  );
}

/** Contenido de la ventana aparte: cabecera con el estado de la CPU y el analizador a pantalla completa. */
export function SenalesFuera({ sim, win, nombre, onSignalsChange, onTraer }: {
  sim: SimController;
  win: Window;
  nombre?: string;
  onSignalsChange?: (s: { text: string; view: SignalView }[]) => void;
  onTraer: () => void;
}) {
  const root = win.document.getElementById('senales-root');

  useEffect(() => {
    win.document.title = nombre ? `Señales E/S — ${nombre}` : 'Señales E/S — Automatizacion';
  }, [win, nombre]);

  // si la ventana principal está minimizada u oculta su bucle se para: entonces es esta ventana
  // (con sus propios temporizadores) la que hace avanzar la simulación
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

  if (!root) return null;
  return createPortal(
    <div className="senales-win">
      <div className="senales-head">
        <Icon name="wave" size={15} />
        <b>Señales E/S</b>
        {nombre && <span className="faint">· {nombre}</span>}
        <span className="sep" />
        <EstadoCpu sim={sim} />
        <CycleStatus sim={sim} />
        <span className="spacer" />
        <button className="btn small" onClick={onTraer} title="Cerrar esta ventana y ver las señales abajo, en la ventana principal">
          <Icon name="down" size={13} />Volver a la ventana principal
        </button>
      </div>
      <div className="senales-body">
        <AnalyzerPanel sim={sim} onSignalsChange={onSignalsChange} />
      </div>
    </div>,
    root,
  );
}
