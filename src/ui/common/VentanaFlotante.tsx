// Ventana flotante dentro de la app (no del sistema): barra de título para moverla, asa para cambiar el tamaño y
// botón de cerrar. Recuerda dónde se dejó (localStorage, por `clave`). La usan la Biblioteca estándar y la
// configuración del hardware; la tabla de variables tiene la suya (VatFlotante), con acoplar y minimizar.
import { type ReactNode, useEffect, useState } from 'react';
import { Icon } from './Icon';
import { T } from '../../i18n';

export interface GeomVentana { x: number; y: number; w: number; h: number }

const leer = (clave: string): Partial<GeomVentana> | null => {
  try { return JSON.parse(localStorage.getItem(clave) ?? 'null') as Partial<GeomVentana> | null; } catch { return null; }
};
const guardar = (clave: string, g: GeomVentana) => {
  try { localStorage.setItem(clave, JSON.stringify(g)); } catch { /* sin almacenamiento */ }
};

/** Que la barra de título quede siempre dentro de la app, para poder volver a moverla */
function encajar(g: GeomVentana, minW: number, minH: number): GeomVentana {
  const w = Math.min(Math.max(minW, g.w), window.innerWidth);
  const h = Math.min(Math.max(minH, g.h), window.innerHeight);
  return { w, h, x: Math.max(120 - w, Math.min(window.innerWidth - 120, g.x)), y: Math.max(0, Math.min(window.innerHeight - 34, g.y)) };
}

export function VentanaFlotante({ titulo, icono, clave, inicial, minW = 420, minH = 260, z = 40, onCerrar, children, className = '', onKeyDown }: {
  titulo: ReactNode;
  icono: string;
  /** Clave de localStorage para recordar la posición y el tamaño */
  clave: string;
  /** Posición y tamaño la primera vez */
  inicial: () => GeomVentana;
  minW?: number;
  minH?: number;
  z?: number;
  onCerrar: () => void;
  children: ReactNode;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}) {
  const [g, setG] = useState<GeomVentana>(() => {
    const s = leer(clave);
    const i = inicial();
    const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
    return encajar({ x: ok(s?.x) ? s!.x : i.x, y: ok(s?.y) ? s!.y : i.y, w: ok(s?.w) ? s!.w : i.w, h: ok(s?.h) ? s!.h : i.h }, minW, minH);
  });
  // si la ventana de la app se hace más pequeña, la flotante no se queda fuera
  useEffect(() => {
    const r = () => setG((x) => encajar(x, minW, minH));
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, [minW, minH]);
  const arrastrar = (e: React.MouseEvent, modo: 'mover' | 'tamano') => {
    if (e.button !== 0) return;
    e.preventDefault();
    const g0 = g;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let ultima = g0;
    const move = (ev: MouseEvent) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      ultima = encajar(modo === 'mover' ? { ...g0, x: g0.x + dx, y: g0.y + dy } : { ...g0, w: g0.w + dx, h: g0.h + dy }, minW, minH);
      setG(ultima);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      guardar(clave, ultima);
    };
    document.body.style.cursor = modo === 'mover' ? 'move' : 'nwse-resize';
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  return (
    <div className={`vflot ${className}`} style={{ left: g.x, top: g.y, width: g.w, height: g.h, zIndex: z }} role="dialog"
      aria-label={typeof titulo === 'string' ? titulo : undefined} onKeyDown={onKeyDown}>
      <div className="vflot-head" onMouseDown={(e) => arrastrar(e, 'mover')}>
        <Icon name={icono} size={14} />
        <span className="tit">{titulo}</span>
        <button type="button" className="btn small ghost icon cerrar-ventana" title={T.comun.cerrar} aria-label={T.comun.cerrar} onMouseDown={(e) => e.stopPropagation()} onClick={onCerrar}>
          <Icon name="x" size={13} />
        </button>
      </div>
      <div className="vflot-body">{children}</div>
      <div className="vflot-tam" onMouseDown={(e) => arrastrar(e, 'tamano')} aria-hidden />
    </div>
  );
}
