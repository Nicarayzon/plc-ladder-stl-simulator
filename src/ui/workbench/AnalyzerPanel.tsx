// Analizador lógico (cronograma en vivo)
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SimController } from '../../sim/SimController';
import { AnalyzerBuffer, type Signal, type SignalView } from '../../sim/analyzer';
import { useSimTick } from './useSim';
import { Icon } from '../common/Icon';
import { downloadText, toast } from '../common/ui';
import { fmtReal } from '../../core/format';
import { inputBits, outputBits } from '../../core/usage';

const ROW = 34;
const AXIS = 22;

function fmtVal(v: number, view: SignalView): string {
  if (Number.isNaN(v)) return '—';
  if (view === 'bit') return String(v);
  if (view === 'hex') return (v >>> 0).toString(16).toUpperCase();
  if (view === 'real') return fmtReal(v);
  return String(v);
}

function fmtT(ms: number): string {
  if (Math.abs(ms) >= 60000) return `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(1).padStart(4, '0')}`;
  return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 2)} s`;
}

function niceStep(span: number, px: number): number {
  const target = span / Math.max(1, px / 90);
  const pow = 10 ** Math.floor(Math.log10(target));
  for (const m of [1, 2, 5, 10]) if (m * pow >= target) return m * pow;
  return 10 * pow;
}

const COLOR_VARS = ['--mono', '--border', '--text-faint', '--warn', '--text', '--accent', '--err', '--text-dim'] as const;
type Colores = Record<(typeof COLOR_VARS)[number], string>;
const coloresCache = new WeakMap<Document, { oscuro: MediaQueryList; tema: string; c: Colores | null }>();

/**
 * Colores del tema para el lienzo. Leerlos con getComputedStyle obliga al navegador a recalcular
 * los estilos de la página, así que se leen una vez por tema (y por ventana) y se guardan.
 */
function coloresDe(doc: Document): Colores {
  const win = doc.defaultView!;
  let e = coloresCache.get(doc);
  if (!e) {
    e = { oscuro: win.matchMedia('(prefers-color-scheme: dark)'), tema: '', c: null };
    coloresCache.set(doc, e);
  }
  const tema = `${doc.documentElement.getAttribute('data-theme') ?? ''}|${e.oscuro.matches}`;
  if (e.c && e.tema === tema) return e.c;
  const css = win.getComputedStyle(doc.documentElement);
  const c = Object.fromEntries(COLOR_VARS.map((n) => [n, css.getPropertyValue(n).trim()])) as Colores;
  // en una ventana recién abierta la hoja de estilos puede no haber cargado: se vuelve a leer luego
  if (!c['--border']) return c;
  e.c = c;
  e.tema = tema;
  return c;
}

/** Entradas y salidas que usa el programa (hasta `max` de cada), para el cronograma */
export function senalesES(sim: SimController, max = 8): string[] {
  const u = sim.usage;
  if (!u) return [];
  return [...inputBits(u).slice(0, max), ...outputBits(u).slice(0, max)].map((k) => k.replace(/^([EA])/, '$1 '));
}

/** Si el cronograma está vacío, añade las entradas y salidas del programa. ¿Ha añadido alguna? */
export function anadirSenalesES(sim: SimController): boolean {
  const buf = sim.analyzer;
  if (buf.signals.length) return false;
  for (const k of senalesES(sim)) {
    try { buf.add(k, sim.compiled.symbols); } catch { /* señal no válida */ }
  }
  return buf.signals.length > 0;
}

export interface AnalyzerProps {
  sim: SimController;
  buffer?: AnalyzerBuffer;
  /** Solo lectura (contraejemplos, cronogramas): sin añadir/quitar señales */
  readOnly?: boolean;
  onSignalsChange?: (s: { text: string; view: SignalView }[]) => void;
  grid?: number;
}

export function AnalyzerPanel({ sim, buffer, readOnly, onSignalsChange, grid }: AnalyzerProps) {
  const buf = buffer ?? sim.analyzer;
  // la columna de valores enseña la última muestra; el lienzo se dibuja aparte (abajo)
  useSimTick(sim, 10, () => {
    const f: unknown[] = [sim.rev, buf.signals.length];
    if (buf.count) { const i = buf.idx(buf.count - 1); for (const s of buf.signals) f.push(s.data[i]); }
    return f;
  });
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  const [span, setSpan] = useState(10000);
  const [t1, setT1] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [curA, setCurA] = useState<number | null>(null);
  const [curB, setCurB] = useState<number | null>(null);
  const [nuevo, setNuevo] = useState('');
  const [rev, setRev] = useState(0);
  const drag = useRef<{ x: number; t1: number } | null>(null);

  const end = follow ? Math.max(buf.lastTime(), span) : t1;
  const start = end - span;

  const notify = () => {
    setRev((x) => x + 1);
    onSignalsChange?.(buf.signals.map((s) => ({ text: s.text, view: s.view })));
  };

  // tamaño del lienzo: lo avisa un ResizeObserver (preguntarlo en cada dibujo fuerza a recalcular el diseño)
  const size = useRef({ W: 0, H: 0 });
  // lo que se dibujó la última vez: si nada ha cambiado, no se vuelve a dibujar
  const drawn = useRef<unknown[]>([]);
  const draw = useRef<() => void>(() => {});

  draw.current = () => {
    const c = canvas.current;
    const w = wrap.current;
    if (!c || !w) return;
    const doc = c.ownerDocument;
    if (!doc.defaultView) return; // la ventana de señales se acaba de cerrar
    const dpr = doc.defaultView.devicePixelRatio || 1;
    const { W, H } = size.current;
    if (!W || !H) return;
    const end = follow ? Math.max(buf.lastTime(), span) : t1;
    const start = end - span;
    const firma = [W, H, dpr, start, span, buf.count, buf.head, buf.signals.length, buf.markers.length, curA, curB, hover, grid, rev, coloresDe(doc)];
    if (firma.length === drawn.current.length && firma.every((v, i) => Object.is(v, drawn.current[i]))) return;
    drawn.current = firma;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colores = coloresDe(doc);
    const col = (n: keyof Colores) => colores[n];
    g.clearRect(0, 0, W, H);
    const x = (t: number) => ((t - start) / span) * W;
    // rejilla temporal
    g.font = '10.5px ' + col('--mono');
    g.textBaseline = 'middle';
    const step = grid ?? niceStep(span, W);
    g.strokeStyle = col('--border');
    g.fillStyle = col('--text-faint');
    g.lineWidth = 1;
    for (let t = Math.ceil(start / step) * step; t <= end; t += step) {
      const px = Math.round(x(t)) + 0.5;
      g.beginPath();
      g.moveTo(px, 0);
      g.lineTo(px, H - AXIS);
      g.stroke();
      g.fillText(fmtT(t), px + 3, H - AXIS / 2);
    }
    g.beginPath();
    g.moveTo(0, H - AXIS + 0.5);
    g.lineTo(W, H - AXIS + 0.5);
    g.stroke();
    // marcadores
    for (const m of buf.markers) {
      if (m.t < start || m.t > end) continue;
      const px = Math.round(x(m.t)) + 0.5;
      g.strokeStyle = col('--warn');
      g.setLineDash([4, 3]);
      g.beginPath();
      g.moveTo(px, 0);
      g.lineTo(px, H - AXIS);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = col('--warn');
      g.fillText(m.label, px + 3, 8);
    }
    // señales
    const n = buf.count;
    const i0 = Math.max(0, buf.findIndex(start));
    buf.signals.forEach((s, row) => {
      const top = row * ROW + 5;
      const bot = top + ROW - 10;
      g.strokeStyle = s.color;
      g.fillStyle = s.color;
      g.lineWidth = 1.6;
      if (s.view === 'bit') {
        g.beginPath();
        let prev = NaN;
        let started = false;
        for (let k = i0; k < n; k++) {
          const i = buf.idx(k);
          const t = buf.t[i];
          const v = s.data[i];
          const px = x(t);
          if (Number.isNaN(v)) { started = false; prev = NaN; continue; }
          const py = v ? top : bot;
          if (!started) { g.moveTo(Math.max(0, px), py); started = true; } else if (v !== prev) { g.lineTo(px, prev ? top : bot); g.lineTo(px, py); }
          prev = v;
          if (t > end) break;
        }
        if (started) {
          const lastI = buf.idx(Math.max(0, n - 1));
          const lastT = Math.min(end, buf.t[lastI]);
          g.lineTo(x(lastT), prev ? top : bot);
        }
        g.stroke();
        // relleno suave de los tramos a 1
        g.globalAlpha = 0.12;
        let segStart: number | null = null;
        for (let k = i0; k < n; k++) {
          const i = buf.idx(k);
          const v = s.data[i];
          const px = x(buf.t[i]);
          if (v === 1 && segStart === null) segStart = px;
          if (v !== 1 && segStart !== null) { g.fillRect(segStart, top, px - segStart, bot - top); segStart = null; }
          if (buf.t[i] > end) break;
        }
        if (segStart !== null) g.fillRect(segStart, top, x(Math.min(end, buf.lastTime())) - segStart, bot - top);
        g.globalAlpha = 1;
      } else if (s.view === 'analog' || s.view === 'real') {
        let lo = Infinity;
        let hi = -Infinity;
        for (let k = i0; k < n; k++) {
          const i = buf.idx(k);
          const v = s.data[i];
          if (!Number.isNaN(v) && Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
        }
        if (lo === Infinity) return;
        if (hi === lo) { hi += 1; lo -= 1; }
        const y = (v: number) => bot - ((v - lo) / (hi - lo)) * (bot - top);
        g.beginPath();
        let started = false;
        let pv = 0;
        for (let k = i0; k < n; k++) {
          const i = buf.idx(k);
          const v = s.data[i];
          if (Number.isNaN(v)) { started = false; continue; }
          const px = x(buf.t[i]);
          if (!started) { g.moveTo(px, y(v)); started = true; } else { g.lineTo(px, y(pv)); g.lineTo(px, y(v)); }
          pv = v;
          if (buf.t[i] > end) break;
        }
        g.stroke();
        g.fillStyle = col('--text-faint');
        g.fillText(fmtVal(hi, s.view), 4, top + 4);
        g.fillText(fmtVal(lo, s.view), 4, bot - 4);
      } else {
        // bus: tramos con el valor
        let segStart: number | null = null;
        let segV = NaN;
        const flush = (px: number) => {
          if (segStart === null || Number.isNaN(segV)) return;
          const a = Math.max(0, segStart);
          const bpx = Math.min(W, px);
          if (bpx - a < 1) return;
          g.beginPath();
          g.moveTo(a + 3, top);
          g.lineTo(bpx - 3, top);
          g.lineTo(bpx, (top + bot) / 2);
          g.lineTo(bpx - 3, bot);
          g.lineTo(a + 3, bot);
          g.lineTo(a, (top + bot) / 2);
          g.closePath();
          g.stroke();
          const txt = fmtVal(segV, s.view);
          if (g.measureText(txt).width < bpx - a - 10) {
            g.fillStyle = col('--text');
            g.fillText(txt, a + 6, (top + bot) / 2);
          }
        };
        for (let k = i0; k < n; k++) {
          const i = buf.idx(k);
          const v = s.data[i];
          const px = x(buf.t[i]);
          if (v !== segV && !(Number.isNaN(v) && Number.isNaN(segV))) {
            flush(px);
            segStart = px;
            segV = v;
          }
          if (buf.t[i] > end) break;
        }
        flush(x(Math.min(end, buf.lastTime())));
      }
      g.strokeStyle = col('--border');
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, (row + 1) * ROW + 0.5);
      g.lineTo(W, (row + 1) * ROW + 0.5);
      g.stroke();
    });
    // cursores
    const cursor = (t: number | null, color: string, label: string | null) => {
      if (t === null || t < start || t > end) return;
      const px = Math.round(x(t)) + 0.5;
      g.strokeStyle = color;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(px, 0);
      g.lineTo(px, H - AXIS);
      g.stroke();
      if (label === null) return;
      g.fillStyle = color;
      g.fillText(`${label} ${fmtT(t)}`, px + 3, H - AXIS - 8);
    };
    cursor(curA, col('--accent'), 'A');
    cursor(curB, col('--err'), 'B');
    // la línea del ratón, sin su tiempo si cae encima de un cursor (se montarían las etiquetas)
    const cerca = (t: number | null) => t !== null && hover !== null && Math.abs(x(t) - x(hover)) < 70;
    if (hover !== null) cursor(hover, col('--text-dim'), cerca(curA) || cerca(curB) ? null : '');
  };

  // al pintar el panel (zoom, cursores, señales…)
  useLayoutEffect(() => draw.current());

  // tamaño del lienzo (también en otra ventana, con su propio ResizeObserver)
  useEffect(() => {
    const w = wrap.current;
    if (!w) return;
    const RO = (w.ownerDocument.defaultView as (Window & typeof globalThis) | null)?.ResizeObserver ?? ResizeObserver;
    const ro = new RO((entries) => {
      const r = entries[entries.length - 1].contentRect;
      size.current = { W: r.width, H: r.height };
      draw.current();
    });
    ro.observe(w);
    return () => ro.disconnect();
  }, []);

  // muestras nuevas: solo el lienzo, hasta 30 veces por segundo, sin pasar por React
  useEffect(() => {
    let last = 0;
    let timer: number | undefined;
    const un = sim.subscribe(() => {
      const now = performance.now();
      if (now - last >= 33) { last = now; draw.current(); }
      else if (timer === undefined) timer = window.setTimeout(() => { timer = undefined; last = performance.now(); draw.current(); }, 33 - (now - last));
    });
    return () => { un(); if (timer !== undefined) clearTimeout(timer); };
  }, [sim]);

  const tAt = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect();
    return start + ((clientX - r.left) / r.width) * span;
  };

  const valueAt = (s: Signal, t: number | null) => {
    if (t === null) {
      if (!buf.count) return NaN;
      return s.data[buf.idx(buf.count - 1)];
    }
    const k = buf.findIndex(t);
    return k < 0 ? NaN : s.data[buf.idx(k)];
  };

  const addSignal = () => {
    const t = nuevo.trim();
    if (!t) return;
    try {
      buf.add(t, sim.compiled.symbols);
      setNuevo('');
      notify();
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const exportPng = () => {
    canvas.current?.toBlob((b) => {
      if (!b) return;
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cronograma.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  };

  return (
    <div className="col" style={{ height: '100%', gap: 0 }}>
      <div className="row" style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 6 }}>
        {!readOnly && (
          <form className="row" style={{ gap: 4 }} onSubmit={(e) => { e.preventDefault(); addSignal(); }}>
            <input className="input mono" style={{ height: 24, width: 150 }} placeholder="E 124.0, A 124.0, MW 10, T 1…" value={nuevo} onChange={(e) => setNuevo(e.target.value)} aria-label="Señal nueva" />
            <button className="btn small" type="submit"><Icon name="plus" size={13} />Señal</button>
          </form>
        )}
        <button className={`btn small ${follow ? 'active' : ''}`} onClick={() => { setFollow(!follow); setT1(end); }} title="Seguir el final en tiempo real">Seguir</button>
        <button className="btn small icon" onClick={() => setSpan((s) => Math.max(50, s / 2))} title="Acercar"><Icon name="zoomin" size={14} /></button>
        <button className="btn small icon" onClick={() => setSpan((s) => Math.min(24 * 3600e3, s * 2))} title="Alejar"><Icon name="zoomout" size={14} /></button>
        <button className="btn small" onClick={() => { const a = buf.firstTime(); const b = buf.lastTime(); setSpan(Math.max(100, b - a)); setT1(b); setFollow(false); }} title="Ver todo lo registrado">Todo</button>
        <span className="faint" style={{ fontSize: 11.5 }}>ventana {fmtT(span)}</span>
        <span className="sep" />
        <span className="mono" style={{ fontSize: 11.5 }}>
          <span style={{ color: 'var(--accent)' }}>A</span> {curA === null ? '—' : fmtT(curA)} · <span style={{ color: 'var(--err)' }}>B</span> {curB === null ? '—' : fmtT(curB)}
          {curA !== null && curB !== null && <b> · Δt = {Math.abs(curB - curA).toFixed(0)} ms</b>}
        </span>
        {(curA !== null || curB !== null) && <button className="btn small ghost" onClick={() => { setCurA(null); setCurB(null); }}>Quitar cursores</button>}
        <span className="spacer" />
        {!readOnly && (
          <select className="input" style={{ height: 24, padding: '0 4px', fontSize: 12 }} value={sim.trigger ? `${sim.trigger.signalId}:${sim.trigger.edge}` : ''} aria-label="Disparo"
            onChange={(e) => { const v = e.target.value; sim.trigger = v ? { signalId: +v.split(':')[0], edge: v.split(':')[1] as 'sube' } : null; notify(); }}>
            <option value="">Sin disparo</option>
            {buf.signals.flatMap((s) => (['sube', 'baja', 'cambia'] as const).map((e) => <option key={`${s.id}:${e}`} value={`${s.id}:${e}`}>Pausar si {s.label} {e === 'sube' ? '↑' : e === 'baja' ? '↓' : 'cambia'}</option>))}
          </select>
        )}
        <button className="btn small" onClick={() => downloadText('cronograma.csv', buf.toCSV(), 'text/csv')} title="Exportar a CSV">CSV</button>
        <button className="btn small" onClick={exportPng} title="Exportar imagen">PNG</button>
        {!readOnly && <button className="btn small ghost" onClick={() => { buf.clear(); notify(); }} title="Borrar lo registrado">Borrar</button>}
      </div>
      <div className="an" style={{ flex: 1, minHeight: 0 }}>
        <div className="an-side">
          {buf.signals.map((s) => (
            <div key={s.id} className="an-sig" style={{ height: ROW }}>
              <span className="sw" style={{ background: s.color }} />
              <span className="nm" title={s.text}>{s.label}</span>
              <span className="vl">{fmtVal(valueAt(s, hover), s.view)}</span>
              {!readOnly && s.reader.size > 0 && (
                <select className="input" style={{ height: 20, padding: '0 2px', fontSize: 10.5, width: 52 }} value={s.view} aria-label="Vista"
                  onChange={(e) => { s.view = e.target.value as SignalView; notify(); }}>
                  <option value="dec">DEC</option><option value="hex">HEX</option><option value="analog">curva</option><option value="real">REAL</option>
                </select>
              )}
              {!readOnly && <button className="btn small ghost icon" onClick={() => { buf.remove(s.id); notify(); }} aria-label={`Quitar ${s.label}`}><Icon name="x" size={12} /></button>}
            </div>
          ))}
          {!buf.signals.length && (
            <div className="muted" style={{ padding: 10, fontSize: 12 }}>
              Añade señales para ver su cronograma. Clic = cursor A, Mayús + clic = cursor B.
              {!readOnly && !buffer && senalesES(sim).length > 0 && (
                <button className="btn small" style={{ marginTop: 8 }} onClick={() => { if (anadirSenalesES(sim)) notify(); }}>
                  <Icon name="plus" size={13} />Entradas y salidas del programa
                </button>
              )}
            </div>
          )}
        </div>
        <div className="an-canvas-wrap" ref={wrap}
          onMouseMove={(e) => {
            if (drag.current) {
              const r = wrap.current!.getBoundingClientRect();
              const dt = ((e.clientX - drag.current.x) / r.width) * span;
              setFollow(false);
              setT1(drag.current.t1 - dt);
              return;
            }
            setHover(tAt(e.clientX));
          }}
          onMouseLeave={() => { setHover(null); drag.current = null; }}
          onMouseDown={(e) => { drag.current = { x: e.clientX, t1: end }; }}
          onMouseUp={(e) => {
            const moved = drag.current && Math.abs(e.clientX - drag.current.x) > 3;
            drag.current = null;
            if (moved) return;
            const t = tAt(e.clientX);
            if (e.shiftKey) setCurB(t);
            else setCurA(t);
          }}
          onWheel={(e) => {
            const t = tAt(e.clientX);
            const f = e.deltaY > 0 ? 1.25 : 0.8;
            const ns = Math.min(24 * 3600e3, Math.max(50, span * f));
            const ratio = (t - start) / span;
            setSpan(ns);
            setFollow(false);
            setT1(t - ratio * ns + ns);
          }}>
          <canvas ref={canvas} aria-label="Cronograma de las señales" />
        </div>
      </div>
    </div>
  );
}
