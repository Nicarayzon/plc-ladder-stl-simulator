// Señales E/S (analizador lógico) en una ventana aparte, para tenerlas en otro monitor.
// La ventana es del mismo origen que la principal: React pinta dentro con un portal y usa el
// mismo simulador, así que no hay que copiar datos entre ventanas.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SimController } from '../../sim/SimController';
import type { SignalView } from '../../sim/analyzer';
import { AnalyzerPanel } from './AnalyzerPanel';
import { CycleStatus } from './Toolbar';
import { useSimTick } from './useSim';
import { Icon } from '../common/Icon';
import { toast } from '../common/ui';
import { guardarGeom, leerGeom, prepararDocumento, useBombeo } from './ventanaAparte';
import { T } from '../../i18n';

const GEOM_KEY = 'automatizacion-senales-ventana';
const NOMBRE = 'senales';
const TITULO = T.senales.titulo;

export interface SenalesVentana {
  /** Ventana aparte abierta (null = las señales van abajo, en la ventana principal) */
  win: Window | null;
  abrir: () => void;
  cerrar: () => void;
}

/** Abre y cierra la ventana de señales. Vive en la pantalla del simulador: sobrevive al cambiar de proyecto. */
export function useSenalesVentana(): SenalesVentana {
  const [win, setWin] = useState<Window | null>(null);
  const limpiar = useRef<(() => void) | null>(null);

  const cerrar = useCallback(() => {
    setWin((w) => {
      if (w && !w.closed) {
        guardarGeom(GEOM_KEY, w);
        w.close();
      }
      return null;
    });
  }, []);

  const abrir = useCallback(() => {
    const g = leerGeom(GEOM_KEY);
    const feats = g ? `left=${g.x},top=${g.y},width=${g.w},height=${g.h}` : 'width=1100,height=460';
    const w = window.open('', NOMBRE, feats);
    if (!w) {
      toast(T.senales.noSeAbre);
      return;
    }
    if (!w.document.getElementById('senales-root')) {
      limpiar.current?.();
      limpiar.current = prepararDocumento(w, TITULO, 'senales-root');
    }
    w.focus();
    setWin(w);
  }, []);

  // la ventana se cierra con su botón rojo: las señales vuelven a la principal
  useEffect(() => {
    if (!win) return;
    const onHide = () => guardarGeom(GEOM_KEY, win);
    win.addEventListener('pagehide', onHide);
    const iv = window.setInterval(() => {
      if (win.closed) {
        limpiar.current?.();
        limpiar.current = null;
        setWin(null);
      } else guardarGeom(GEOM_KEY, win);
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
    const bye = () => { const w = winRef.current; if (w && !w.closed) { guardarGeom(GEOM_KEY, w); w.close(); } };
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
      {run && !sim.playing && <span className="warn-text" style={{ fontSize: 12 }}>{T.senales.enPausa}</span>}
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
    win.document.title = nombre ? T.senales.tituloDe(nombre) : TITULO;
  }, [win, nombre]);

  useBombeo(sim, win);

  if (!root) return null;
  return createPortal(
    <div className="senales-win">
      <div className="senales-head">
        <Icon name="wave" size={15} />
        <b>{T.senales.senales}</b>
        {nombre && <span className="faint">· {nombre}</span>}
        <span className="sep" />
        <EstadoCpu sim={sim} />
        <CycleStatus sim={sim} />
        <span className="spacer" />
        <button className="btn small" onClick={onTraer} title={T.senales.volverTitulo}>
          <Icon name="down" size={13} />{T.senales.volver}
        </button>
      </div>
      <div className="senales-body">
        <AnalyzerPanel sim={sim} onSignalsChange={onSignalsChange} />
      </div>
    </div>,
    root,
  );
}
