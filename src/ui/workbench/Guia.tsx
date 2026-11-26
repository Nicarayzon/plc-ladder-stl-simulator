// Guías paso a paso en pantalla (0.29.1: marca de ciclo y tabla de variables): un contorno que late alrededor del
// sitio donde hay que pulsar y una burbuja al lado con el paso («Paso 3 de 7») y lo que hay que hacer. No tapa nada: el
// contorno deja pasar los clics y la burbuja se pone a un lado del elemento señalado. Cada guía calcula su paso (con su
// lista de objetivos `data-guia`, por orden de preferencia) y este componente lo pinta.
// Solo mide mientras la guía está abierta (cada 150 ms: las ventanas se pueden mover, y los menús y modales abrirse).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../common/Icon';
import { Rico } from '../common/Rico';
import { T } from '../../i18n';

const ANCHO = 290;
const HUECO = 14;
const MARGEN = 8;
/** Cada cuánto se vuelve a medir (y a leer lo que hay en pantalla, `useEnPantalla`) */
export const MEDIR_MS = 150;

export type Lado = 'derecha' | 'debajo' | 'izquierda' | 'encima';
interface Caja { left: number; top: number; width: number; height: number }

/** Dónde va la burbuja (de tamaño `w`×`h`) para no tapar la caja `r`: el primer lado en el que cabe */
export function colocar(r: Caja, w: number, h: number, vw: number, vh: number, orden: Lado[]): { lado: Lado; x: number; y: number } {
  const limY = (y: number) => Math.max(MARGEN, Math.min(vh - h - MARGEN, y));
  const limX = (x: number) => Math.max(MARGEN, Math.min(vw - w - MARGEN, x));
  for (const lado of orden) {
    if (lado === 'derecha' && r.left + r.width + HUECO + w <= vw - MARGEN) return { lado, x: r.left + r.width + HUECO, y: limY(r.top + r.height / 2 - 34) };
    if (lado === 'izquierda' && r.left - HUECO - w >= MARGEN) return { lado, x: r.left - HUECO - w, y: limY(r.top + r.height / 2 - 34) };
    if (lado === 'debajo' && r.top + r.height + HUECO + h <= vh - MARGEN) return { lado, x: limX(r.left), y: r.top + r.height + HUECO };
    if (lado === 'encima' && r.top - HUECO - h >= MARGEN) return { lado, x: limX(r.left), y: r.top - HUECO - h };
  }
  return { lado: 'debajo', x: limX(r.left), y: limY(r.top + r.height + HUECO) };
}

/** En el explorador (a la izquierda) y en los menús, mejor a la derecha; dentro de las ventanas, mejor debajo, para no tapar sus controles */
export const ORDEN = {
  explorador: ['derecha', 'debajo', 'encima', 'izquierda'],
  ventana: ['debajo', 'derecha', 'izquierda', 'encima'],
  pie: ['izquierda', 'encima', 'derecha', 'debajo'],
  arriba: ['encima', 'izquierda', 'derecha', 'debajo'],
} satisfies Record<string, Lado[]>;
export type Zona = keyof typeof ORDEN;

/** Un paso: su número (1…total; total + 1 = hecho) y lo que se señala, por orden de preferencia */
export interface PasoVisto {
  n: number;
  objetivos: { id: string; texto: string }[];
}

const igual = (a: Caja | null, b: Caja | null) => !!a && !!b && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;

/** Lee algo de la pantalla cada `MEDIR_MS` (lo que no avisa a React: un menú abierto, una tabla…) y re-renderiza si cambia */
export function useEnPantalla<X>(leer: () => X, clave: (x: X) => string): X {
  const [x, setX] = useState(leer);
  useEffect(() => {
    let antes = clave(x);
    const t = window.setInterval(() => {
      const nuevo = leer();
      const k = clave(nuevo);
      if (k !== antes) { antes = k; setX(nuevo); }
    }, MEDIR_MS);
    return () => window.clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return x;
}

export function Guia({ titulo, icono, total, paso, zonas, onCerrar }: {
  titulo: string;
  icono: string;
  total: number;
  paso: PasoVisto;
  /** Zona de cada objetivo (dónde se prefiere la burbuja); sin ella, «ventana» */
  zonas: Record<string, Zona>;
  onCerrar: () => void;
}) {
  const hecho = paso.n > total;
  const [sitio, setSitio] = useState<{ i: number; r: Caja } | null>(null);
  const [alto, setAlto] = useState(150);
  const burbuja = useRef<HTMLDivElement>(null);
  const clave = `${paso.n}:${paso.objetivos.map((o) => o.id).join(',')}`;

  useEffect(() => {
    let visto = '';
    const medir = () => {
      for (let i = 0; i < paso.objetivos.length; i++) {
        const el = document.querySelector<HTMLElement>(`[data-guia="${paso.objetivos[i].id}"]`);
        if (!el) continue;
        const b = el.getBoundingClientRect();
        if (!b.width && !b.height) continue;
        // la primera vez que aparece, que se vea (el explorador puede tener la lista desplazada)
        if (visto !== paso.objetivos[i].id) { visto = paso.objetivos[i].id; el.scrollIntoView?.({ block: 'nearest' }); }
        const r = { left: b.left, top: b.top, width: b.width, height: b.height };
        setSitio((s) => (s && s.i === i && igual(s.r, r) ? s : { i, r }));
        return;
      }
      setSitio(null);
    };
    medir();
    const t = window.setInterval(medir, MEDIR_MS);
    window.addEventListener('resize', medir);
    return () => { window.clearInterval(t); window.removeEventListener('resize', medir); };
  }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const h = burbuja.current?.offsetHeight;
    if (h && h !== alto) setAlto(h);
  });

  const obj = sitio ? paso.objetivos[sitio.i] : paso.objetivos[0];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // sin nada que señalar (un instante, mientras se abre una ventana), la burbuja espera abajo a la derecha
  const pos = sitio ? colocar(sitio.r, ANCHO, alto, vw, vh, ORDEN[zonas[obj.id] ?? 'ventana']) : { lado: 'nada' as const, x: vw - ANCHO - 24, y: vh - alto - 60 };

  return createPortal(
    <>
      {sitio && !hecho && (
        <div className="guia-aro" aria-hidden="true" style={{ left: sitio.r.left - 5, top: sitio.r.top - 5, width: sitio.r.width + 10, height: sitio.r.height + 10 }}>
          <span className="guia-aro-num">{paso.n}</span>
        </div>
      )}
      <div ref={burbuja} className={`guia-burbuja lado-${pos.lado}${hecho ? ' hecho' : ''}`} role="dialog" aria-label={titulo} style={{ left: pos.x, top: pos.y, width: ANCHO }}>
        <div className="guia-cab">
          <Icon name={hecho ? 'check' : icono} size={14} />
          <b className="grow">{titulo}</b>
          <button className="btn small ghost icon" onClick={onCerrar} aria-label={hecho ? T.guia.cerrar : T.guia.saltar} title={hecho ? T.guia.cerrar : T.guia.saltar}><Icon name="x" size={13} /></button>
        </div>
        <div className="guia-paso">{hecho ? T.guia.hecho : T.guia.pasoDe(paso.n, total)}</div>
        <p className="guia-texto"><Rico t={obj.texto} /></p>
        <div className="guia-pie">
          <span className="guia-puntos" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => <i key={i} className={i + 1 < paso.n ? 'hecho' : i + 1 === paso.n ? 'ahora' : ''} />)}
          </span>
          <span className="spacer" />
          <button className={`btn small ${hecho ? 'primary' : 'ghost'}`} onClick={onCerrar}>{hecho ? T.guia.cerrar : T.guia.saltar}</button>
        </div>
      </div>
    </>,
    document.body,
  );
}
