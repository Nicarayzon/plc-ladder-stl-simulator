// Tabla de variables con la distribución de la ventana clásica de la tabla de variables (menús, dos barras de
// herramientas, área gris con la subventana de la tabla y barra de estado) y el estilo de la app. Va dentro de la
// propia app: en una ventana flotante que se queda encima de todo y se mueve por la app, o abajo, como una
// pestaña más junto a «Señales E/S».
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type { SimController } from '../../sim/SimController';
import { readRaw, type Reader } from '../../sim/readers';
import { FORMATOS, type Formato } from '../../core/format';
import { version as APP_VERSION } from '../../../package.json';
import { Icon } from '../common/Icon';
import { ContextMenu, Modal, downloadText, pickFile, toast, type MenuItem } from '../common/ui';
import { useSimTick } from './useSim';
import { normAddr } from './symbols';
import { formatoPorDefecto, formatoValido, lectorDe, normalizarOperando, textoValor, valorForzado } from './vatFormatos';
import { operandosDe } from './vat';
import type { VatFila } from './types';

const MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const MOD = MAC ? '⌘' : 'Ctrl+';

/** Dónde se ve una tabla: en su ventana flotante dentro de la app o abajo, junto a las señales */
export type ModoVat = 'flotante' | 'abajo';

type Col = 'op' | 'sim' | 'fmt' | 'val' | 'forz';
const COLS: Col[] = ['op', 'sim', 'fmt', 'val', 'forz'];
/** Anchos de la tabla original: nº, indicador, operando, símbolo, formato, valor de estado, valor de forzado */
const ANCHOS = [28, 26, 96, 80, 190, 125, 130];

interface Sub { x: number; y: number; w: number; h: number; modo: 'normal' | 'min' | 'max' }
const SUB_INICIAL: Sub = { x: 10, y: 10, w: 670, h: 290, modo: 'normal' };

/** Disparo de la observación: en qué punto del ciclo se leen los valores y si una vez o siempre */
interface Disparo { punto: 'inicio' | 'fin' | 'stop'; cond: 'una' | 'perm' }

/** Posición y tamaño de la ventana flotante, en píxeles de la ventana de la app */
export interface GeomFlotante { x: number; y: number; w: number; h: number; min: boolean }

/** Lo que dura mientras la tabla está abierta, aunque pase de la ventana flotante a abajo o al revés (el componente se vuelve a montar) */
export interface SesionVat {
  online: boolean;
  observando: boolean;
  forzando: boolean;
  disparo: Disparo;
  barras: boolean;
  barraEstado: boolean;
  /** Subventana de la tabla dentro del área gris (null = cerrada) */
  sub: Sub | null;
  ultimaSub: Sub;
  flot: GeomFlotante;
  hist: { antes: VatFila[][]; despues: VatFila[][] };
  /** Últimos valores leídos, por operando */
  valores: Map<string, number>;
  /** Operandos que fuerza esta tabla (se quitan al soltar el botón o al cerrarla) */
  forzadas: Set<string>;
}

const GEOM_KEY = 'automatizacion-vat-flotante';

/** Ventana flotante nueva: donde se dejó la última (desplazada si ya hay otras abiertas) o abajo a la derecha, sobre el panel E/S */
function geomInicial(abiertas: number): GeomFlotante {
  let g: Partial<GeomFlotante> | null = null;
  try { g = JSON.parse(localStorage.getItem(GEOM_KEY) ?? 'null') as Partial<GeomFlotante> | null; } catch { /* sin almacenamiento */ }
  const w = g && Number.isFinite(g.w) ? g.w! : 720;
  const h = g && Number.isFinite(g.h) ? g.h! : 460;
  const x = g && Number.isFinite(g.x) ? g.x! : window.innerWidth - w - 24;
  const y = g && Number.isFinite(g.y) ? g.y! : window.innerHeight - h - 60;
  return encajar({ x: x + 28 * abiertas, y: y + 28 * abiertas, w, h, min: false });
}

/** Que la barra de título quede siempre dentro de la ventana de la app, para poder volver a moverla */
function encajar(g: GeomFlotante): GeomFlotante {
  const w = Math.min(Math.max(520, g.w), window.innerWidth);
  const h = Math.min(Math.max(300, g.h), window.innerHeight);
  return { ...g, w, h, x: Math.max(120 - w, Math.min(window.innerWidth - 120, g.x)), y: Math.max(0, Math.min(window.innerHeight - 34, g.y)) };
}

export function nuevaSesion(abiertas: number): SesionVat {
  return {
    online: true, observando: false, forzando: false, disparo: { punto: 'fin', cond: 'perm' }, barras: true, barraEstado: true,
    sub: null, ultimaSub: SUB_INICIAL, flot: geomInicial(abiertas), hist: { antes: [], despues: [] }, valores: new Map(), forzadas: new Set(),
  };
}

/** Al pasar de abajo a la ventana flotante observando, la subventana tiene que estar abierta */
export function prepararFlotante(ses: SesionVat) {
  ses.flot = { ...encajar(ses.flot), min: false };
  if (ses.observando && !ses.sub) ses.sub = { ...ses.ultimaSub, modo: 'normal' };
}

/** Marco de la ventana flotante: barra de título «Var - VAT_n» para moverla, botones y asa para cambiar el tamaño */
export function VatFlotante({ nombre, ses, z, onFrente, onAcoplar, onCerrar, children }: {
  nombre: string;
  ses: SesionVat;
  z: number;
  onFrente: () => void;
  onAcoplar: () => void;
  onCerrar: () => void;
  children: ReactNode;
}) {
  const [, repintar] = useReducer((x: number) => x + 1, 0);
  const g = ses.flot;
  const poner = (n: GeomFlotante, guardar = false) => {
    ses.flot = n;
    repintar();
    if (guardar) try { localStorage.setItem(GEOM_KEY, JSON.stringify({ x: n.x, y: n.y, w: n.w, h: n.h })); } catch { /* sin almacenamiento */ }
  };
  // si la ventana de la app se hace más pequeña, la flotante no se queda fuera
  useEffect(() => {
    const r = () => poner(encajar(ses.flot));
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, [ses]); // eslint-disable-line react-hooks/exhaustive-deps
  const arrastrar = (e: React.MouseEvent, modo: 'mover' | 'tamano') => {
    if (e.button !== 0) return;
    e.preventDefault();
    const g0 = ses.flot;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let ultima = g0;
    const move = (ev: MouseEvent) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      ultima = encajar(modo === 'mover' ? { ...g0, x: g0.x + dx, y: g0.y + dy } : { ...g0, w: g0.w + dx, h: g0.h + dy });
      poner(ultima);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      poner(ultima, true);
    };
    document.body.style.cursor = modo === 'mover' ? 'move' : 'nwse-resize';
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  const boton = (titulo: string, icono: string, on: () => void) => (
    <button type="button" className="btn small ghost icon" title={titulo} aria-label={titulo} onMouseDown={(e) => e.stopPropagation()} onClick={on}>
      <Icon name={icono} size={13} />
    </button>
  );
  return (
    <div className={`vatf${g.min ? ' min' : ''}`} style={{ left: g.x, top: g.y, width: g.w, height: g.min ? undefined : g.h, zIndex: z }}
      role="dialog" aria-label={`Var - ${nombre}`} onMouseDownCapture={onFrente}>
      <div className="vatf-head" onMouseDown={(e) => arrastrar(e, 'mover')} onDoubleClick={() => poner({ ...ses.flot, min: !ses.flot.min })}>
        <Icon name="table" size={14} />
        <span className="tit">Var - {nombre}</span>
        {boton('Acoplar abajo, junto a las señales', 'down', onAcoplar)}
        {boton(g.min ? 'Mostrar la tabla' : 'Minimizar', g.min ? 'up' : 'minus', () => poner({ ...ses.flot, min: !ses.flot.min }))}
        {boton('Cerrar la tabla de variables', 'x', onCerrar)}
      </div>
      {!g.min && <div className="vatf-body">{children}</div>}
      {!g.min && <div className="vatf-tam" onMouseDown={(e) => arrastrar(e, 'tamano')} aria-hidden />}
    </div>
  );
}

const MODO_KEY = 'automatizacion-vat-modo';
const leerModo = (): ModoVat => { try { return localStorage.getItem(MODO_KEY) === 'abajo' ? 'abajo' : 'flotante'; } catch { return 'flotante'; } };
const guardarModo = (m: ModoVat) => { try { localStorage.setItem(MODO_KEY, m); } catch { /* sin almacenamiento */ } };

/**
 * Tablas abiertas del proyecto: en qué modo está cada una, el orden de las flotantes (la última, delante) y su sesión.
 * Una tabla nueva se abre en el último modo que se eligió. `nombres`: las VAT que existen (si una se borra o se
 * renombra, se cierra); `mostrarAbajo`: enseñar su pestaña en el panel de abajo.
 */
export function useTablasVat(sim: SimController, nombres: string[], mostrarAbajo: (nombre: string) => void) {
  const [abiertas, setAbiertas] = useState<{ nombre: string; modo: ModoVat }[]>([]);
  const [orden, setOrden] = useState<string[]>([]);
  const sesiones = useRef(new Map<string, SesionVat>());
  const ref = useRef(abiertas);
  ref.current = abiertas;

  const sesion = (nombre: string): SesionVat => {
    let s = sesiones.current.get(nombre);
    if (!s) {
      s = nuevaSesion(ref.current.filter((a) => a.modo === 'flotante').length);
      sesiones.current.set(nombre, s);
    }
    return s;
  };
  const frente = (nombre: string) => setOrden((o) => (o[o.length - 1] === nombre ? o : [...o.filter((x) => x !== nombre), nombre]));
  const abrir = (nombre: string) => {
    const ya = ref.current.find((a) => a.nombre === nombre);
    const modo = ya?.modo ?? leerModo();
    const s = sesion(nombre);
    if (!ya) setAbiertas((ab) => [...ab, { nombre, modo }]);
    if (modo === 'abajo') mostrarAbajo(nombre);
    else {
      prepararFlotante(s);
      setOrden((o) => [...o.filter((x) => x !== nombre), nombre]); // delante y otra vez a la vista si estaba minimizada
    }
  };
  const cerrar = (nombre: string) => {
    const s = sesiones.current.get(nombre);
    if (s) {
      for (const k of s.forzadas) sim.unforce(k);
      sesiones.current.delete(nombre);
    }
    setAbiertas((ab) => ab.filter((a) => a.nombre !== nombre));
    setOrden((o) => o.filter((x) => x !== nombre));
  };
  const cambiarModo = (nombre: string, modo: ModoVat) => {
    guardarModo(modo);
    const s = sesion(nombre);
    setAbiertas((ab) => ab.map((a) => (a.nombre === nombre ? { ...a, modo } : a)));
    if (modo === 'abajo') mostrarAbajo(nombre);
    else {
      prepararFlotante(s);
      setOrden((o) => [...o.filter((x) => x !== nombre), nombre]);
    }
  };

  // VAT borrada o renombrada: se cierra
  const clave = nombres.join('\n');
  useEffect(() => {
    for (const a of ref.current) if (!nombres.includes(a.nombre)) cerrar(a.nombre);
  }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps
  // al salir del proyecto o del simulador, lo que forzaban las tablas deja de estar forzado
  useEffect(() => () => {
    for (const s of sesiones.current.values()) for (const k of s.forzadas) sim.unforce(k);
  }, [sim]);

  return { abiertas, orden, sesion, abrir, cerrar, cambiarModo, frente };
}

/** Portapapeles de filas, común a todas las tablas abiertas */
let portapapeles: VatFila | null = null;

const filaVacia = (): VatFila => ({ text: '', fmt: 'HEX' });
const vacia = (f: VatFila) => !f.text.trim() && !f.forzado?.trim();
/** Siempre queda una sola fila vacía al final (la que se dibuja aparte): se quitan las vacías del final */
function recortar(filas: VatFila[]): VatFila[] {
  let n = filas.length;
  while (n > 0 && vacia(filas[n - 1])) n--;
  return n === filas.length ? filas : filas.slice(0, n);
}
const clave = (r: Reader) => `${r.kind}|${r.op.text}`;

interface VatProps {
  sim: SimController;
  ses: SesionVat;
  modo: ModoVat;
  nombre: string;
  proyecto: string;
  filas: VatFila[];
  onFilas: (f: VatFila[]) => void;
  symbols: Map<string, string>;
  symByAddr: Map<string, string>;
  /** Cerrar la tabla (Tabla ▸ Salir y el botón de cerrar abajo) */
  onCerrar: () => void;
  /** Pasar a la ventana flotante (desde abajo) */
  onFlotante?: () => void;
}

/** La tabla: completa en la ventana flotante (menús, barras, área gris con la subventana y barra de estado) o compacta abajo (una barra y la tabla) */
export function VatVista({ sim, ses, modo, nombre, proyecto, filas, onFilas, symbols, symByAddr, onCerrar, onFlotante }: VatProps) {
  const aviso = useCallback((m: string) => toast(m), []);
  const [, repintar] = useReducer((x: number) => x + 1, 0);
  /** El estado que dura con la tabla abierta vive en la sesión: se cambia y se vuelve a pintar */
  const poner = (p: Partial<SesionVat>) => { Object.assign(ses, p); repintar(); };
  const { online, observando, forzando, barras, barraEstado, sub, disparo } = ses;
  const setOnline = (v: boolean) => poner({ online: v });
  const setObservando = (v: boolean) => poner({ observando: v });
  const setForzando = (v: boolean) => poner({ forzando: v });
  const setBarras = (v: boolean) => poner({ barras: v });
  const setBarraEstado = (v: boolean) => poner({ barraEstado: v });
  const setDisparo = (v: Disparo) => poner({ disparo: v });
  const setSub = (v: Sub | null | ((sb: Sub | null) => Sub | null)) => poner({ sub: typeof v === 'function' ? v(ses.sub) : v });
  /** Abajo la tabla siempre se ve; en la ventana flotante, solo con la subventana abierta */
  const tablaVisible = modo === 'abajo' || !!sub;
  const raiz = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<{ f: number; c: Col } | null>(null);
  const [edit, setEdit] = useState<{ f: number; c: Col; texto: string } | null>(null);
  /** La edición en curso; se pone a null antes de cerrar el campo, para que su blur no la confirme otra vez */
  const editVivo = useRef(edit);
  editVivo.current = edit;
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[]; encima?: number } | null>(null);
  const [menuBarra, setMenuBarra] = useState<{ i: number; x: number; y: number } | null>(null);
  const [dialogo, setDialogo] = useState<'disparo' | 'estado' | 'ayuda' | 'acerca' | null>(null);
  const [ayudaCtx, setAyudaCtx] = useState(false);
  const [estadoTexto, setEstadoTexto] = useState<string | null>(null);
  useEffect(() => {
    if (!estadoTexto) return;
    const t = window.setTimeout(() => setEstadoTexto(null), 6000);
    return () => window.clearTimeout(t);
  }, [estadoTexto]);
  const mdi = useRef<HTMLDivElement>(null);
  const rejilla = useRef<HTMLDivElement>(null);

  const lectores = useMemo(() => filas.map((f) => lectorDe(f.text, symbols)), [filas, symbols]);
  /** Sugerencias al escribir un operando: los del programa que aún no están en la tabla */
  const listaId = useId();
  const sugerencias = useMemo(() => {
    const hay = new Set(filas.map((f) => normAddr(f.text)));
    return sim.usage ? operandosDe(sim.usage).filter((t) => !hay.has(normAddr(t))) : [];
  }, [sim.usage, filas]);
  const lectorEn = (f: number): Reader | null => { const r = lectores[f]; return r && !(r instanceof Error) ? r : null; };

  /** Lee un operando según el punto de disparo: al inicio del ciclo, las entradas son las de la periferia (la PAE que se va a leer) */
  const leer = (r: Reader): number => {
    if (disparo.punto === 'inicio' && r.op.area === 'E' && (r.kind === 'bit' || r.kind === 'mem')) {
      const f = sim.forces.get(r.op.text);
      return f ? f.raw : readRaw(sim.cpu, { ...r, op: { ...r.op, area: 'PE' } });
    }
    return readRaw(sim.cpu, r);
  };
  const tomarValores = () => {
    for (const r of lectores) if (r && !(r instanceof Error)) ses.valores.set(clave(r), leer(r));
  };

  // ── observar: cada 500 ms, solo si cambia algo de lo que se enseña ──
  const enVivo = online && observando && tablaVisible && disparo.punto !== 'stop';
  useSimTick(sim, 2, () => {
    const base = [sim.rev, sim.cpu.state, sim.forces.size];
    return enVivo ? [...base, ...lectores.map((r) => (r && !(r instanceof Error) ? leer(r) : 0))] : base;
  });
  if (enVivo) tomarValores();
  // disparo en la transición de RUN a STOP
  const antes = useRef(sim.cpu.state);
  useEffect(() => {
    const ahora = sim.cpu.state;
    if (online && observando && disparo.punto === 'stop' && antes.current === 'RUN' && ahora !== 'RUN') {
      tomarValores();
      repintar();
      if (disparo.cond === 'una') setObservando(false);
    }
    antes.current = ahora;
  });

  // ── forzar: mientras el botón está pulsado, los valores de forzado se fuerzan en cada ciclo ──
  const quitarForzado = () => {
    for (const k of ses.forzadas) sim.unforce(k);
    ses.forzadas.clear();
  };
  /** Escribe los valores de forzado válidos: una vez o de forma permanente (bits y palabras; T y Z se escriben una vez). Devuelve cuántos. */
  const escribirForzado = (permanente: boolean): number => {
    let n = 0;
    filas.forEach((f, i) => {
      const r = lectorEn(i);
      if (!r || !f.forzado?.trim()) return;
      let raw: number;
      try { raw = valorForzado(f.forzado, r, f.fmt); } catch { return; }
      try {
        if (permanente && (r.kind === 'bit' || r.kind === 'mem')) {
          sim.force(f.text, raw, f.forzado.trim());
          ses.forzadas.add(r.op.text);
        } else sim.modify(f.text, raw, true);
        n++;
      } catch (e) {
        aviso((e as Error).message);
      }
    });
    return n;
  };
  // con el forzado activo, un valor nuevo se aplica enseguida
  useEffect(() => {
    if (!forzando) return;
    quitarForzado();
    escribirForzado(true);
  }, [filas, forzando]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── acciones ──
  const abrirSub = () => setSub((sb) => sb ?? { ...ses.ultimaSub, modo: 'normal' });
  const cerrarSub = () => {
    if (sub) ses.ultimaSub = sub;
    setSub(null);
    setObservando(false);
    if (forzando) { quitarForzado(); setForzando(false); }
    setSel(null);
    setEdit(null);
  };
  const lentes = () => {
    if (!online) { aviso('No hay enlace con la CPU'); return; }
    if (tablaVisible && observando) { setObservando(false); return; }
    if (modo === 'flotante') abrirSub();
    if (disparo.cond === 'una' && disparo.punto !== 'stop') {
      tomarValores();
      repintar();
      setEstadoTexto('Valores leídos una vez (disparo: una vez)');
      return;
    }
    setObservando(true);
  };
  const actualizar = () => {
    if (!online || !tablaVisible) return;
    tomarValores();
    repintar();
  };
  const forzar = () => {
    if (!online || !tablaVisible) return;
    if (forzando) { quitarForzado(); setForzando(false); return; }
    if (!escribirForzado(true)) { aviso('No hay valores de forzado válidos'); return; }
    setForzando(true);
  };
  const activarForzado = () => {
    if (!online || !tablaVisible) return;
    const n = escribirForzado(false);
    if (!n) aviso('No hay valores de forzado válidos');
    else setEstadoTexto(`${n} ${n === 1 ? 'valor escrito' : 'valores escritos'} una vez`);
  };
  const enlazar = (si: boolean) => {
    setOnline(si);
    if (!si) {
      setObservando(false);
      if (forzando) { quitarForzado(); setForzando(false); }
    }
  };

  // ── edición de la tabla ──
  const cambiar = (nuevas: VatFila[]) => {
    ses.hist.antes.push(filas);
    if (ses.hist.antes.length > 100) ses.hist.antes.shift();
    ses.hist.despues = [];
    onFilas(recortar(nuevas));
  };
  const deshacer = () => {
    const p = ses.hist.antes.pop();
    if (!p) return;
    ses.hist.despues.push(filas);
    onFilas(p);
  };
  const rehacer = () => {
    const p = ses.hist.despues.pop();
    if (!p) return;
    ses.hist.antes.push(filas);
    onFilas(p);
  };
  const conFila = (f: number, cambio: (fila: VatFila) => VatFila) => {
    const nuevas = [...filas];
    nuevas[f] = cambio(filas[f] ?? filaVacia());
    cambiar(nuevas);
  };
  const confirmar = (f: number, c: Col, texto: string) => {
    const t = texto.trim();
    const fila = filas[f] ?? filaVacia();
    if (c === 'op') {
      if (t === fila.text) return;
      if (!t) { if (f < filas.length) conFila(f, (x) => ({ ...x, text: '' })); return; }
      try {
        const { texto: norm, reader } = normalizarOperando(t, symbols);
        conFila(f, (x) => ({ ...x, text: norm, fmt: norm === x.text && formatoValido(reader, x.fmt) ? x.fmt : formatoPorDefecto(reader) }));
      } catch {
        conFila(f, (x) => ({ ...x, text: t })); // se queda tal cual, en rojo
      }
    } else if (c === 'sim') {
      const nombreSim = t.replace(/^"+|"+$/g, '');
      if (!nombreSim) return;
      const dir = symbols.get(nombreSim);
      if (dir === undefined) { aviso(`Símbolo no definido: «${nombreSim}»`); return; }
      try {
        const { texto: norm, reader } = normalizarOperando(dir, symbols);
        conFila(f, (x) => ({ ...x, text: norm, fmt: formatoPorDefecto(reader) }));
      } catch (e) {
        aviso((e as Error).message);
      }
    } else if (c === 'forz') {
      if (t === (fila.forzado ?? '')) return;
      conFila(f, (x) => ({ ...x, forzado: t || undefined }));
    }
  };
  const ponerFormato = (f: number, fmt: Formato) => conFila(f, (x) => ({ ...x, fmt }));
  const copiar = (f: number) => { const x = filas[f]; if (x && !vacia(x)) portapapeles = { ...x }; };
  const cortar = (f: number) => { if (f >= filas.length) return; copiar(f); cambiar(filas.filter((_, i) => i !== f)); };
  const pegar = (f: number) => { if (portapapeles) { const p = portapapeles; conFila(f, () => ({ ...p })); } };
  const borrar = (f: number) => { if (f < filas.length) conFila(f, () => filaVacia()); };
  const insertarFila = (f: number) => { const n = [...filas]; n.splice(Math.min(f, filas.length), 0, filaVacia()); cambiar(n); };

  const empezarEdicion = (f: number, c: Col, texto?: string) => {
    if (c !== 'op' && c !== 'sim' && c !== 'forz') return;
    const fila = filas[f];
    const actual = c === 'op' ? fila?.text ?? '' : c === 'forz' ? fila?.forzado ?? '' : '';
    setSel({ f, c });
    setEdit({ f, c, texto: texto ?? actual });
  };
  const opcionesFormato = (f: number): MenuItem[] => {
    const r = lectorEn(f);
    if (!r) return [];
    return FORMATOS.map((fmt) => ({ label: fmt, checked: filas[f].fmt === fmt, disabled: !formatoValido(r, fmt), onClick: () => ponerFormato(f, fmt) }));
  };
  const abrirFormatos = (f: number, el: HTMLElement) => {
    if (!lectorEn(f)) { aviso('Escribe antes un operando válido'); return; }
    const r = el.getBoundingClientRect();
    setMenu({ x: r.left, y: r.bottom + 2, encima: r.top, items: opcionesFormato(f) });
  };

  // ── teclado ──
  const foco = () => rejilla.current?.focus();
  const mover = (df: number, dc: number) => {
    if (!sel) { setSel({ f: 0, c: 'op' }); return; }
    const f = Math.max(0, Math.min(filas.length, sel.f + df));
    const c = COLS[Math.max(0, Math.min(COLS.length - 1, COLS.indexOf(sel.c) + dc))];
    setSel({ f, c });
  };
  const teclaRejilla = (e: React.KeyboardEvent) => {
    if (edit || !sel) return;
    const k = e.key;
    const hecho = () => e.preventDefault();
    if (k === 'ArrowDown') { mover(1, 0); hecho(); } else if (k === 'ArrowUp') { mover(-1, 0); hecho(); } else if (k === 'ArrowRight' || (k === 'Tab' && !e.shiftKey)) { mover(0, 1); hecho(); } else if (k === 'ArrowLeft' || (k === 'Tab' && e.shiftKey)) { mover(0, -1); hecho(); } else if (k === 'Enter' || k === 'F2') {
      hecho();
      if (sel.c === 'fmt') {
        const td = rejilla.current?.querySelector<HTMLElement>(`[data-f="${sel.f}"][data-c="fmt"]`);
        if (td) abrirFormatos(sel.f, td);
      } else empezarEdicion(sel.f, sel.c);
    } else if (k === 'Escape') { setSel(null); hecho(); } else if (k === 'Delete' || k === 'Backspace') {
      hecho();
      if (sel.c === 'op') confirmar(sel.f, 'op', '');
      else if (sel.c === 'forz') conFila(sel.f, (x) => ({ ...x, forzado: undefined }));
    } else if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // empezar a escribir edita en el sitio; las teclas 1–8 en Operando o Símbolo siguen accionando las entradas
      if ((sel.c === 'op' || sel.c === 'sim') && /^[1-8]$/.test(k)) return;
      if (sel.c === 'op' || sel.c === 'sim' || sel.c === 'forz') { hecho(); empezarEdicion(sel.f, sel.c, k); }
    }
  };
  const teclaEdicion = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!edit) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      editVivo.current = null;
      setEdit(null);
      foco();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      editVivo.current = null;
      confirmar(edit.f, edit.c, edit.texto);
      setEdit(null);
      if (e.key === 'Enter') setSel({ f: edit.f + 1, c: edit.c });
      else setSel({ f: edit.f, c: COLS[Math.min(COLS.length - 1, COLS.indexOf(edit.c) + (e.shiftKey ? -1 : 1))] });
      foco();
    }
  };

  // atajos con el foco en esta tabla: Ctrl+F7 observar, Ctrl+F9 forzar, Ctrl+Y rehacer; deshacer/rehacer del menú Edición
  // de la app y cortar/copiar/pegar actúan sobre las filas si no se está escribiendo en una celda
  const acciones = useRef({ lentes, forzar, deshacer, rehacer, copiar, cortar, pegar, sel });
  acciones.current = { lentes, forzar, deshacer, rehacer, copiar, cortar, pegar, sel };
  const escribiendo = () => { const a = document.activeElement; return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); };
  const teclaRaiz = (e: React.KeyboardEvent) => {
    const a = acciones.current;
    if (e.ctrlKey && e.key === 'F7') { e.preventDefault(); a.lentes(); } else if (e.ctrlKey && e.key === 'F9') { e.preventDefault(); a.forzar(); } else if (!MAC && e.ctrlKey && e.key.toLowerCase() === 'y' && !escribiendo()) { e.preventDefault(); a.rehacer(); }
  };
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const dentro = () => el.contains(document.activeElement);
    const des = () => acciones.current.deshacer();
    const re = () => acciones.current.rehacer();
    const portapapelesEv = (tipo: 'copy' | 'cut' | 'paste') => (e: ClipboardEvent) => {
      const a = acciones.current;
      if (!dentro() || escribiendo() || !a.sel) return;
      e.preventDefault();
      if (tipo === 'copy') a.copiar(a.sel.f);
      else if (tipo === 'cut') a.cortar(a.sel.f);
      else a.pegar(a.sel.f);
    };
    const onCopy = portapapelesEv('copy');
    const onCut = portapapelesEv('cut');
    const onPaste = portapapelesEv('paste');
    el.addEventListener('vat-deshacer', des);
    el.addEventListener('vat-rehacer', re);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);
    return () => {
      el.removeEventListener('vat-deshacer', des);
      el.removeEventListener('vat-rehacer', re);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('paste', onPaste);
    };
  }, []);

  // ayuda contextual: el siguiente clic en la tabla enseña la descripción del elemento en lugar de hacer nada; fuera, la cancela
  useEffect(() => {
    if (!ayudaCtx) return;
    const clic = (e: MouseEvent) => {
      const dentro = raiz.current?.contains(e.target as Node);
      if (dentro) {
        e.preventDefault();
        e.stopPropagation();
        const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[title], [aria-label]');
        setEstadoTexto(el?.title || el?.getAttribute('aria-label') || 'Sin ayuda para este elemento');
      }
      setAyudaCtx(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAyudaCtx(false); };
    const t = window.setTimeout(() => window.addEventListener('click', clic, true), 0);
    window.addEventListener('keydown', esc);
    return () => { window.clearTimeout(t); window.removeEventListener('click', clic, true); window.removeEventListener('keydown', esc); };
  }, [ayudaCtx]);

  // ── subventana: mover, cambiar de tamaño, minimizar y maximizar dentro del área gris ──
  const arrastrar = (e: React.MouseEvent, modo: 'mover' | 'tamano') => {
    if (!sub || sub.modo !== 'normal' || e.button !== 0) return;
    e.preventDefault();
    const s0 = sub;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const area = mdi.current!.getBoundingClientRect();
    const move = (ev: MouseEvent) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (modo === 'mover') setSub({ ...s0, x: Math.max(60 - s0.w, Math.min(area.width - 60, s0.x + dx)), y: Math.max(0, Math.min(area.height - 30, s0.y + dy)) });
      else setSub({ ...s0, w: Math.max(320, s0.w + dx), h: Math.max(140, s0.h + dy) });
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  const modoSub = (m: Sub['modo']) => setSub((sb) => (sb ? { ...sb, modo: sb.modo === m ? 'normal' : m } : sb));
  const cascada = () => { setSub({ ...SUB_INICIAL }); };
  const mosaico = () => {
    const a = mdi.current;
    if (a) setSub({ x: 0, y: 0, w: a.clientWidth, h: a.clientHeight, modo: 'normal' });
  };

  // ── ficheros ──
  const guardar = () => downloadText(`${nombre}.json`, JSON.stringify({ formato: 'automatizacion-vat-v1', nombre, filas }, null, 2), 'application/json');
  const abrirFichero = async () => {
    const txt = await pickFile('.json,application/json');
    if (!txt) return;
    try {
      const d = JSON.parse(txt) as { filas?: unknown } | unknown[];
      const lista = (Array.isArray(d) ? d : (d as { filas?: unknown }).filas) as unknown;
      if (!Array.isArray(lista)) throw new Error('El fichero no tiene filas');
      const nuevas: VatFila[] = lista.map((x) => {
        const o = x as Partial<VatFila>;
        return { text: String(o.text ?? ''), fmt: FORMATOS.includes(o.fmt as Formato) ? (o.fmt as Formato) : 'HEX', ...(o.forzado ? { forzado: String(o.forzado) } : {}) };
      });
      cambiar(nuevas);
      abrirSub();
    } catch (e) {
      aviso(`No se ha podido abrir: ${(e as Error).message}`);
    }
  };

  /** Imprime solo esta tabla: el resto de la app se oculta mientras dura la impresión */
  const imprimir = () => {
    const el = raiz.current;
    if (!el) return;
    el.classList.add('vat-imprimir');
    document.body.classList.add('imprimiendo-vat');
    const fin = () => { el.classList.remove('vat-imprimir'); document.body.classList.remove('imprimiendo-vat'); window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    window.print();
  };

  const nueva = () => {
    if (!window.confirm(`¿Vaciar la tabla ${nombre}?`)) return;
    cambiar([]);
    abrirSub();
  };

  // ── menús ──
  const selF = sel?.f;
  const conSel = sel !== null;
  const subAbierta = !!sub;
  const menus: { t: string; items: () => MenuItem[] }[] = [
    { t: 'Tabla', items: () => [
      { label: 'Nueva', onClick: nueva },
      { label: 'Abrir…', onClick: () => void abrirFichero() },
      { label: 'Cerrar', disabled: !subAbierta, onClick: cerrarSub },
      { sep: true, label: '' },
      { label: 'Guardar', onClick: guardar },
      { label: 'Guardar como…', onClick: guardar },
      { sep: true, label: '' },
      { label: 'Imprimir…', onClick: imprimir },
      { sep: true, label: '' },
      { label: 'Salir', onClick: onCerrar },
    ] },
    { t: 'Edición', items: () => [
      { label: 'Deshacer', hint: `${MOD}Z`, disabled: !ses.hist.antes.length, onClick: deshacer },
      { label: 'Rehacer', hint: MAC ? '⇧⌘Z' : 'Ctrl+Y', disabled: !ses.hist.despues.length, onClick: rehacer },
      { sep: true, label: '' },
      { label: 'Cortar', hint: `${MOD}X`, disabled: !conSel, onClick: () => selF !== undefined && cortar(selF) },
      { label: 'Copiar', hint: `${MOD}C`, disabled: !conSel, onClick: () => selF !== undefined && copiar(selF) },
      { label: 'Pegar', hint: `${MOD}V`, disabled: !conSel || !portapapeles, onClick: () => selF !== undefined && pegar(selF) },
      { label: 'Borrar', hint: 'Supr', disabled: !conSel, onClick: () => selF !== undefined && borrar(selF) },
      { sep: true, label: '' },
      { label: 'Seleccionar todo', disabled: true },
    ] },
    { t: 'Insertar', items: () => [{ label: 'Fila', disabled: !tablaVisible, onClick: () => insertarFila(selF ?? filas.length) }] },
    { t: 'Sistema de destino', items: () => [
      { label: 'Establecer enlace con', items: [{ label: 'CPU configurada', checked: online, onClick: () => enlazar(true) }] },
      { label: 'Deshacer enlace', disabled: !online, onClick: () => enlazar(false) },
      { sep: true, label: '' },
      { label: 'Estado operativo…', onClick: () => setDialogo('estado') },
    ] },
    { t: 'Variable', items: () => [
      { label: 'Observar', hint: 'Ctrl+F7', checked: observando, disabled: !online, onClick: lentes },
      { label: 'Forzar', hint: 'Ctrl+F9', checked: forzando, disabled: !online || !subAbierta, onClick: forzar },
      { sep: true, label: '' },
      { label: 'Actualizar valores de estado', disabled: !online || !subAbierta, onClick: actualizar },
      { label: 'Activar valores de forzado', disabled: !online || !subAbierta, onClick: activarForzado },
      { sep: true, label: '' },
      { label: 'Disparo…', onClick: () => setDialogo('disparo') },
    ] },
    { t: 'Ver', items: () => [
      { label: 'Barra de herramientas', checked: barras, onClick: () => setBarras(!barras) },
      { label: 'Barra de estado', checked: barraEstado, onClick: () => setBarraEstado(!barraEstado) },
      { sep: true, label: '' },
      { label: 'Formato de visualización', disabled: selF === undefined || !lectorEn(selF), items: selF !== undefined ? opcionesFormato(selF) : [] },
    ] },
    { t: 'Herramientas', items: () => [{ label: 'Ajustes…', disabled: true }] },
    { t: 'Ventana', items: () => [
      { label: 'Cascada', disabled: !subAbierta, onClick: cascada },
      { label: 'Mosaico', disabled: !subAbierta, onClick: mosaico },
      { sep: true, label: '' },
      { label: `1 ${nombre}`, checked: subAbierta, onClick: () => { abrirSub(); setSub((s) => (s && s.modo === 'min' ? { ...s, modo: 'normal' } : s)); } },
    ] },
    { t: 'Ayuda', items: () => [
      { label: 'Temas de ayuda', onClick: () => setDialogo('ayuda') },
      { label: 'Acerca de…', onClick: () => setDialogo('acerca') },
    ] },
  ];
  const cerrarMenuBarra = useCallback(() => setMenuBarra(null), []);
  const cerrarMenu = useCallback(() => setMenu(null), []);
  const abrirMenuBarra = (i: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setMenuBarra({ i, x: r.left, y: r.bottom + 2 });
  };
  const menuFila = (f: number, x: number, y: number) => {
    setSel({ f, c: sel?.c ?? 'op' });
    setMenu({ x, y, items: [
      { label: 'Cortar', hint: `${MOD}X`, disabled: f >= filas.length, onClick: () => cortar(f) },
      { label: 'Copiar', hint: `${MOD}C`, disabled: f >= filas.length, onClick: () => copiar(f) },
      { label: 'Pegar', hint: `${MOD}V`, disabled: !portapapeles, onClick: () => pegar(f) },
      { label: 'Borrar', hint: 'Supr', disabled: f >= filas.length, onClick: () => borrar(f) },
      { label: 'Insertar fila', onClick: () => insertarFila(f) },
      { sep: true, label: '' },
      { label: 'Formato de visualización', disabled: !lectorEn(f), items: opcionesFormato(f) },
    ] });
  };

  // ── barras de herramientas ──
  const B = BotonBarra;
  const sinEnlaceOSub = !online || !tablaVisible;
  const titulo = `${nombre} -- @${proyecto}${online ? '  ONLINE' : ''}`;
  const run = sim.cpu.state === 'RUN';

  const botones1 = (
    <>
          <B icono="enchufe" titulo="Conexión (sin función en esta versión)" />
          <span className="sep" />
          <B icono="nuevo" titulo="Nueva (vacía la tabla)" onClick={nueva} />
          <B icono="abrir" titulo="Abrir" onClick={() => void abrirFichero()} />
          <B icono="save" titulo="Guardar (descarga la tabla en .json; con el proyecto ya se guarda sola)" onClick={guardar} />
          <span className="sep" />
          <B icono="imprimir" titulo="Imprimir" onClick={imprimir} />
          <span className="sep" />
          <B icono="cortar" titulo="Cortar" onClick={conSel ? () => cortar(selF!) : undefined} />
          <B icono="copy" titulo="Copiar" onClick={conSel ? () => copiar(selF!) : undefined} />
          <B icono="pegar" titulo="Pegar" onClick={conSel && portapapeles ? () => pegar(selF!) : undefined} />
          <B icono="deshacer" titulo="Deshacer" onClick={ses.hist.antes.length ? deshacer : undefined} />
          <B icono="rehacer" titulo="Rehacer" onClick={ses.hist.despues.length ? rehacer : undefined} />
          <span className="sep" />
          <B icono="x" titulo="Borrar (vacía la fila seleccionada)" onClick={conSel ? () => borrar(selF!) : undefined} />
          <span className="sep" />
          <B icono="enlace" titulo="Establecer enlace con la CPU configurada" activo={online} onClick={() => enlazar(true)} />
          <B icono="desenlace" titulo="Deshacer enlace" onClick={online ? () => enlazar(false) : undefined} />
          <span className="sep" />
          <B icono="ayudaCtx" titulo="Ayuda contextual: el siguiente clic explica un elemento" activo={ayudaCtx} onClick={() => setAyudaCtx(!ayudaCtx)} />
    </>
  );
  const botones2 = (
    <>
          <B icono="disparo" titulo="Disparo…" onClick={() => setDialogo('disparo')} />
          <B icono="gafas" titulo="Observar variable" activo={observando} apagado={!online} onClick={lentes} />
          <B icono="rayo" titulo="Forzar variable (mientras está pulsado, los valores de forzado se aplican en cada ciclo)" activo={forzando} onClick={sinEnlaceOSub ? undefined : forzar} />
          <span className="sep" />
          <B icono="gafas1" titulo="Actualizar valores de estado (una lectura)" onClick={sinEnlaceOSub ? undefined : actualizar} />
          <B icono="rayo1" titulo="Activar valores de forzado (una escritura)" onClick={sinEnlaceOSub ? undefined : activarForzado} />
          <span className="sep" />
          <B icono="forzado" titulo="Forzado permanente (no disponible en esta versión)" />
    </>
  );

  // filas que se dibujan: las de la tabla y una vacía al final
  const n = filas.length + 1;
  const celda = (f: number, c: Col) => {
    const esSel = sel?.f === f && sel.c === c;
    const editando = edit?.f === f && edit.c === c;
    return {
      'data-f': f,
      'data-c': c,
      className: `${c}${esSel ? ' sel' : ''}${editando ? ' editando' : ''}`,
      onMouseDown: (e: React.MouseEvent) => {
        if (e.button !== 0 || editando) return;
        if (esSel && c === 'fmt') { abrirFormatos(f, e.currentTarget as HTMLElement); return; }
        setSel({ f, c });
      },
      onDoubleClick: () => empezarEdicion(f, c),
    };
  };
  const cerrarEdicionFuera = (e: React.MouseEvent) => { if (e.target === e.currentTarget) { setSel(null); setEdit(null); } };

  /** La cuadrícula: dentro de la subventana (flotante) o directamente en el panel de abajo */
  const tabla = (clase: string) => (
    <div className={clase} ref={rejilla} tabIndex={0} onKeyDown={teclaRejilla} onMouseDown={cerrarEdicionFuera}>
      <table className="vatw-grid">
        <colgroup>{ANCHOS.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
        <thead>
          <tr>
            <th />
            <th title="Forzado activo en la fila"><Icon name="flag" size={12} /></th>
            <th>Operando</th><th>Símbolo</th><th>Formato de visualización</th><th>Valor de estado</th><th>Valor de forzado</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: n }, (_, f) => {
            const fila = filas[f];
            const r = fila ? lectores[f] : null;
            const err = r instanceof Error ? r : null;
            const ok = r && !(r instanceof Error) ? r : null;
            const raw = ok && online ? ses.valores.get(clave(ok)) : undefined;
            const sym = ok ? symByAddr.get(normAddr(fila.text)) : undefined;
            const forzada = ok && sim.forces.has(ok.op.text);
            let forzErr = false;
            if (ok && fila?.forzado?.trim()) { try { valorForzado(fila.forzado, ok, fila.fmt); } catch { forzErr = true; } }
            const editor = (c: Col) => edit?.f === f && edit.c === c && (
              <input autoFocus value={edit.texto} aria-label="Editar celda" spellCheck={false} list={c === 'op' && sugerencias.length ? listaId : undefined}
                onChange={(e) => setEdit({ ...edit, texto: e.target.value })} onKeyDown={teclaEdicion}
                onBlur={() => { const v = editVivo.current; if (v) { editVivo.current = null; confirmar(v.f, v.c, v.texto); setEdit(null); } }} />
            );
            return (
              <tr key={f} onContextMenu={(e) => { e.preventDefault(); menuFila(f, e.clientX, e.clientY); }}>
                <td className="n">{f + 1}</td>
                <td className="ind">{forzada && <span className="vatw-f" title="Forzado">F</span>}</td>
                <td {...celda(f, 'op')} title={err?.message}>
                  <span className={err ? 'err-text' : undefined}>{fila?.text}</span>{editor('op')}
                </td>
                <td {...celda(f, 'sim')}>{sym}{editor('sim')}</td>
                <td {...celda(f, 'fmt')}>{fila?.text.trim() ? fila.fmt : ''}{sel?.f === f && sel.c === 'fmt' && ok && <Icon name="down" size={11} className="vatw-fmt-ab" />}</td>
                <td {...celda(f, 'val')}>{ok && raw !== undefined ? textoValor(raw, ok, fila.fmt) : ''}</td>
                <td {...celda(f, 'forz')} title={forzErr ? 'No encaja con el formato de la fila: no se envía' : undefined}>
                  <span className={forzErr ? 'err-text' : undefined}>{fila?.forzado}</span>{editor('forz')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sugerencias.length > 0 && <datalist id={listaId}>{sugerencias.map((t) => <option key={t} value={t} />)}</datalist>}
    </div>
  );

  useLayoutEffect(() => {
    // al cerrar la edición, el foco vuelve a la tabla para seguir con el teclado
    if (!edit && sel && document.activeElement === document.body) foco();
  });

  const dialogos = (
    <>
    {dialogo === 'disparo' && <DialogoDisparo valor={disparo} onCambiar={setDisparo} onCerrar={() => setDialogo(null)} />}
    {dialogo === 'estado' && <DialogoEstado sim={sim} onCerrar={() => setDialogo(null)} />}
    {dialogo === 'ayuda' && (
      <Modal title="Tabla de variables" onClose={() => setDialogo(null)} width={520}>
        <Ayuda />
      </Modal>
    )}
    {dialogo === 'acerca' && (
      <Modal title="Acerca de" onClose={() => setDialogo(null)} width={380}>
        <p style={{ margin: 0 }}>Tabla de variables de <b>Automatizacion</b> v{APP_VERSION}.</p>
        <p className="faint" style={{ marginBottom: 0 }}>© 2026 Arzath — Práctica de autómatas en KOP y AWL.</p>
      </Modal>
    )}
    </>
  );
  const cpu = <span className={`panel cpu ${online ? (run ? 'run' : 'stop') : ''}`} style={{ width: 70 }}>{online ? (run ? 'RUN' : 'STOP') : ''}</span>;

  // abajo: una sola barra con los dos grupos de botones y la tabla debajo
  if (modo === 'abajo') {
    return (
      <div ref={raiz} className={`vatw abajo${ayudaCtx ? ' ayuda' : ''}`} onKeyDown={teclaRaiz}>
        <div className="vatw-tools" role="toolbar" aria-label="Tabla de variables">
          {botones1}
          <span className="sep" />
          {botones2}
          <span className="vatw-status-txt grow faint">{estadoTexto ?? (online ? '' : 'Sin enlace con la CPU')}</span>
          <span className="vatw-status">{cpu}</span>
          <span className="sep" />
          <button type="button" className="btn small ghost icon" title="Abrir como ventana (flotante, encima de la app)" aria-label="Abrir como ventana" onClick={onFlotante}><Icon name="popout" size={14} /></button>
          <button type="button" className="btn small ghost icon" title="Cerrar la tabla de variables" aria-label="Cerrar la tabla de variables" onClick={onCerrar}><Icon name="x" size={14} /></button>
        </div>
        {tabla('vatw-abajo-body')}
        {menu && <ContextMenu x={menu.x} y={menu.y} encima={menu.encima} items={menu.items} onClose={cerrarMenu} />}
        {dialogos}
      </div>
    );
  }

  return (
    <div ref={raiz} className={`vatw${ayudaCtx ? ' ayuda' : ''}`} onKeyDown={teclaRaiz}>
      <div className="vatw-menubar" role="menubar">
        {menus.map((m, i) => (
          <button key={m.t} type="button" role="menuitem" className={menuBarra?.i === i ? 'open' : undefined}
            onMouseDown={(e) => { if (menuBarra?.i === i) e.stopPropagation(); }}
            onClick={(e) => (menuBarra?.i === i ? setMenuBarra(null) : abrirMenuBarra(i, e.currentTarget))}
            onMouseEnter={(e) => { if (menuBarra && menuBarra.i !== i) abrirMenuBarra(i, e.currentTarget); }}>
            {m.t}
          </button>
        ))}
      </div>
      {menuBarra && <ContextMenu key={menuBarra.i} x={menuBarra.x} y={menuBarra.y} items={menus[menuBarra.i].items()} onClose={cerrarMenuBarra} />}

      {barras && (
        <>
          <div className="vatw-tools" role="toolbar" aria-label="Tabla y edición">{botones1}</div>
          <div className="vatw-tools" role="toolbar" aria-label="Observar y forzar">{botones2}</div>
        </>
      )}

      <div className="vatw-mdi" ref={mdi} onMouseDown={cerrarEdicionFuera}>
        {!sub && (
          <div className="vatw-mdi-vacia">
            <Icon name="gafas" size={26} stroke={1.4} />
            {online ? <>Pulsa las lentes (<b>Observar variable</b>, Ctrl+F7) para abrir {nombre}</> : <>Sin enlace con la CPU: pulsa <b>Establecer enlace</b> para observar</>}
          </div>
        )}
        {sub && (
          <div className={`vatw-sub ${sub.modo}`} style={sub.modo === 'normal' ? { left: sub.x, top: sub.y, width: sub.w, height: sub.h } : undefined} role="dialog" aria-label={nombre}>
            <div className="vatw-sub-head" onMouseDown={(e) => arrastrar(e, 'mover')} onDoubleClick={() => modoSub('max')}>
              <Icon name="table" size={14} />
              <span className="tit">{titulo}</span>
              <button type="button" className="btn small ghost icon" title="Minimizar" aria-label="Minimizar" onMouseDown={(e) => e.stopPropagation()} onClick={() => modoSub('min')}><Icon name="minus" size={13} /></button>
              <button type="button" className="btn small ghost icon" title={sub.modo === 'max' ? 'Restaurar' : 'Maximizar'} aria-label={sub.modo === 'max' ? 'Restaurar' : 'Maximizar'} onMouseDown={(e) => e.stopPropagation()} onClick={() => modoSub('max')}>
                <Icon name={sub.modo === 'max' ? 'copy' : 'stop'} size={12} stroke={1.6} />
              </button>
              <button type="button" className="btn small ghost icon" title="Cerrar" aria-label="Cerrar la tabla" onMouseDown={(e) => e.stopPropagation()} onClick={cerrarSub}><Icon name="x" size={13} /></button>
            </div>
            {sub.modo !== 'min' && tabla('vatw-sub-body')}
            {sub.modo === 'normal' && <div className="vatw-sub-tam" onMouseDown={(e) => arrastrar(e, 'tamano')} aria-hidden />}
          </div>
        )}
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} encima={menu.encima} items={menu.items} onClose={cerrarMenu} />}

      {barraEstado && (
        <div className="vatw-status">
          <span className="grow vatw-status-txt" title={estadoTexto ?? proyecto}>{estadoTexto ?? proyecto}</span>
          <span className="panel" style={{ width: 90 }} />
          <span className="panel" style={{ width: 44 }} title={online ? 'Con enlace con la CPU' : 'Sin enlace'}><Icon name={online ? 'enlace' : 'desenlace'} size={13} /></span>
          {cpu}
        </div>
      )}

      {dialogos}
    </div>
  );
}


/** Botón de las barras de herramientas. Sin `onClick` está desactivado; con `apagado` se ve desactivado pero responde (las lentes sin enlace avisan). */
function BotonBarra({ icono, titulo, onClick, activo, apagado }: { icono: string; titulo: string; onClick?: () => void; activo?: boolean; apagado?: boolean }) {
  return (
    <button type="button" className={`btn small ghost icon ${activo ? 'active' : ''}`} title={titulo} aria-label={titulo} aria-pressed={activo === undefined ? undefined : activo}
      aria-disabled={apagado || !onClick ? true : undefined} onClick={() => onClick?.()}>
      <Icon name={icono} size={16} stroke={1.6} />
    </button>
  );
}

function DialogoDisparo({ valor, onCambiar, onCerrar }: { valor: Disparo; onCambiar: (d: Disparo) => void; onCerrar: () => void }) {
  const [d, setD] = useState(valor);
  const opcion = (grupo: string, sel: boolean, txt: ReactNode, on: () => void) => (
    <label className="check" key={String(txt)}><input type="radio" name={grupo} checked={sel} onChange={on} />{txt}</label>
  );
  return (
    <Modal title="Disparo" onClose={onCerrar} width={420}
      footer={<><button className="btn" onClick={onCerrar}>Cancelar</button><button className="btn primary" onClick={() => { onCambiar(d); onCerrar(); }}>Aceptar</button></>}>
      <div className="col" style={{ gap: 14 }}>
        <div className="col" style={{ gap: 6 }}>
          <b>Punto de disparo de la observación</b>
          {opcion('punto', d.punto === 'inicio', 'Inicio del ciclo', () => setD({ ...d, punto: 'inicio' }))}
          {opcion('punto', d.punto === 'fin', 'Fin del ciclo', () => setD({ ...d, punto: 'fin' }))}
          {opcion('punto', d.punto === 'stop', 'Transición de RUN a STOP', () => setD({ ...d, punto: 'stop' }))}
        </div>
        <div className="col" style={{ gap: 6 }}>
          <b>Condición de disparo</b>
          {opcion('cond', d.cond === 'una', 'Una vez', () => setD({ ...d, cond: 'una' }))}
          {opcion('cond', d.cond === 'perm', 'Permanente', () => setD({ ...d, cond: 'perm' }))}
        </div>
      </div>
    </Modal>
  );
}

function DialogoEstado({ sim, onCerrar }: { sim: SimController; onCerrar: () => void }) {
  useSimTick(sim, 5, () => [sim.rev, sim.cpu.state]);
  const run = sim.cpu.state === 'RUN';
  return (
    <Modal title="Estado operativo" onClose={onCerrar} width={360}
      footer={<button className="btn" onClick={onCerrar}>Cerrar</button>}>
      <div className="row" style={{ gap: 12 }}>
        <span>Estado actual de la CPU:</span>
        <b className={run ? 'ok-text' : 'warn-text'}>{sim.cpu.state}</b>
        <span className="spacer" />
        <button className="btn small" disabled={run} onClick={() => sim.setRun(true)}>Arrancar</button>
        <button className="btn small" disabled={!run} onClick={() => sim.setRun(false)}>Parar</button>
      </div>
    </Modal>
  );
}

function Ayuda() {
  return (
    <div className="col" style={{ gap: 8, fontSize: 13 }}>
      <p style={{ margin: 0 }}>Pulsa las <b>lentes</b> (Observar variable, Ctrl+F7) para abrir la tabla y leer los valores de la CPU cada medio segundo. Otro clic pausa la lectura.</p>
      <p style={{ margin: 0 }}>Escribe el operando en la columna <b>Operando</b> (<code>md 30</code> pasa a <code>MD  30</code>). La última fila siempre está vacía: al rellenarla sale otra. Un operando que no existe sale en rojo y no se lee.</p>
      <p style={{ margin: 0 }}>Haz clic en la celda <b>Formato de visualización</b> ya seleccionada (o pulsa Intro) para elegir el formato. Solo están activos los que encajan con el tamaño del operando.</p>
      <p style={{ margin: 0 }}>En <b>Valor de forzado</b> escribe el valor en el formato de la fila (<code>W#16#00FF</code>, <code>12.5</code>, <code>true</code>…). <b>Activar valores de forzado</b> lo escribe una vez; <b>Forzar variable</b> (Ctrl+F9) lo mantiene en cada ciclo mientras está pulsado.</p>
      <p className="faint" style={{ margin: 0 }}>Las teclas 1–8 siguen accionando las entradas E 124.0–E 124.7 si no estás escribiendo en una celda.</p>
    </div>
  );
}
