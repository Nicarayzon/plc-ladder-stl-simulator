import { useEffect, useMemo, useRef, useState } from 'react';
import type { InputTipo, SimController } from '../../sim/SimController';
import { analogInputs, inputBits, outputBits, outputWords, sortBits } from '../../core/usage';
import { useSimTick } from './useSim';
import { ContextMenu } from '../common/ui';
import { makeReader, readRaw } from '../../sim/readers';
import { s16 } from '../../core/num';
import { CLOCK_PERIODS_MS } from '../../core/cpu';
import { useSettings } from '../../store/settings';
import { bitOf, byteOf, firmaIo, marcasDe, type Marcas } from './ioFirma';
import { displayOperand } from '../../core/translate';
import { T } from '../../i18n';
import { Rico } from '../common/Rico';

const TIPO_LABEL: Record<InputTipo, string> = T.io.tipoCorto;
const TIPO_NAME: Record<InputTipo, string> = T.io.tipoNombre;

function bytesOf(keys: string[]) {
  const m = new Map<number, string[]>();
  for (const k of keys) {
    const b = parseInt(/^[A-Z]+(\d+)\./.exec(k)![1], 10);
    m.set(b, [...(m.get(b) ?? []), k]);
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
}

export interface IoPanelProps {
  sim: SimController;
  symByAddr: Map<string, string>;
  onInputsChanged?: () => void;
  /** 'switches': E124.0–E124.7 y A124.0–A124.7 fijos con interruptores de palanca (simulador libre) */
  variant?: 'classic' | 'switches';
  hidden?: string[];
  extra?: string[];
  /** Byte de la marca de ciclo (para rotular sus bits en «Marcas») */
  clockByte?: number | null;
  /** Cambia las listas de quitadas/añadidas en una sola actualización */
  onIoState?: (p: { hidden?: string[]; extra?: string[] }) => void;
  /** Nemotecnia del programa: con la inglesa, las direcciones se ven como I y Q (por dentro siguen siendo E y A) */
  lang?: 'de' | 'en';
}

/** Cómo se enseña una dirección del panel (E124.0 → I124.0 con la nemotecnia inglesa) y las letras de entradas y salidas */
const rotulos = (lang: 'de' | 'en' = 'de') => ({
  mostrar: (k: string) => displayOperand(k, lang),
  e: lang === 'en' ? 'I' : 'E',
  a: lang === 'en' ? 'Q' : 'A',
});

export function IoPanel(props: IoPanelProps) {
  if (props.variant === 'switches') return <SwitchIo {...props} />;
  return <ClassicIo {...props} />;
}

/** Fila 1: E124.0–E124.7 (teclas 1–8). Fila 2: E125.0–E125.7 (solo con el ratón). */
const KEY_ROW = Array.from({ length: 8 }, (_, i) => `E124.${i}`);
const MOUSE_ROW = Array.from({ length: 8 }, (_, i) => `E125.${i}`);
const FIXED_IN = [...KEY_ROW, ...MOUSE_ROW];
/** Pilotos fijos: A124.0–A124.7 y A125.0–A125.7 (salidas integradas de la CPU) */
const FIXED_OUT = [124, 125].flatMap((b) => Array.from({ length: 8 }, (_, i) => `A${b}.${i}`));

/** Marcas que usa el programa (se recalcula solo cuando cambia el programa) */
const useMarcas = (sim: SimController) => useMemo(() => marcasDe(sim.usage), [sim.usage]);

function MarcasSec({ sim, symByAddr, clockByte = null, marcas }: { sim: SimController; symByAddr: Map<string, string>; clockByte?: number | null; marcas: Marcas }) {
  const cpu = sim.cpu;
  if (!marcas.bits.length && !marcas.words.length) return null;
  return (
    <div className="panel-sec">
      <h4>{T.io.marcas} <span className="faint" style={{ textTransform: 'none', letterSpacing: 0 }}>{T.io.marcasNota}</span></h4>
      {/* una fila por byte de marcas (M 0, M 10, M 20…) con sus 8 bits, como las filas de E y A;
          en la de la marca de ciclo solo salen los bits que usa el programa, cada uno en su columna */}
      {[...new Set(marcas.bits.map(byteOf))].sort((a, b) => a - b).map((b) => {
        const usados = new Set(marcas.bits.filter((k) => byteOf(k) === b).map(bitOf));
        const ciclo = clockByte === b;
        return (
          <div key={b}>
            <div className="sw-cap">M {b}{ciclo ? T.io.marcaCiclo : ''}</div>
            <div className="sw-row">
              {Array.from({ length: 8 }, (_, i) => {
                const k = `M${b}.${i}`;
                const v = (cpu.M[b] >> i) & 1;
                const usada = usados.has(i);
                if (ciclo && !usada) return null;
                const sym = symByAddr.get(k);
                const periodo = ciclo ? `${(CLOCK_PERIODS_MS[i] / 1000).toLocaleString(T.locale)} s` : null;
                const title = `M ${b}.${i}${sym ? ` «${sym}»` : ''}${periodo ? T.io.marcaCicloDe(periodo) : ''}${usada ? '' : T.io.noLaUsa}`;
                return (
                  <div key={k} className={`lamp ${v ? 'on' : ''} ${usada ? '' : 'sin-uso'}`} title={title} style={{ gridColumn: i + 1 }}>
                    <span className="lamp-led" />
                    <span className="sw-addr">{b}.{i}</span>
                    {(sym ?? periodo) && <span className="sw-sym">{sym ?? periodo}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {marcas.words.map(([k, w]) => {
        const b = cpu.M;
        const raw = w.size === 1 ? b[w.byte] : w.size === 2 ? (b[w.byte] << 8) | b[w.byte + 1] : ((b[w.byte] << 24) | (b[w.byte + 1] << 16) | (b[w.byte + 2] << 8) | b[w.byte + 3]) >>> 0;
        const v = w.size === 2 ? s16(raw) : w.size === 4 ? raw | 0 : raw;
        return <div key={k} className="row mono" style={{ fontSize: 12, padding: '2px 0' }}><span style={{ width: 70, fontWeight: 600 }}>{k}</span><span>{v}</span><span className="faint">· 16#{raw.toString(16).toUpperCase().padStart(w.size * 2, '0')}</span></div>;
      })}
    </div>
  );
}

const isEditingTarget = (t: EventTarget | null) => t instanceof HTMLElement && !!(t.closest('.cm-editor') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable || t.closest('.kop-editor') || t.closest('.modal'));

/** Teclas 1–8 → E124.0–E124.7 (Mayús = pulsador mientras se mantiene). Va en el banco de trabajo,
 *  no en el panel E/S, para que funcione con cualquier pestaña a la vista (tabla de variables, CPU…). */
export function useTeclasEntradas(sim: SimController, activo: boolean) {
  const teclas = useSettings((s) => s.teclasEntradas) && activo;
  useEffect(() => {
    if (!teclas) return;
    const held = new Map<number, string>();
    const num = (e: KeyboardEvent) => {
      const m = /^(?:Digit|Numpad)([1-8])$/.exec(e.code);
      return m ? +m[1] - 1 : -1;
    };
    const kd = (e: KeyboardEvent) => {
      // defaultPrevented: la tecla ya la ha usado otro (por ejemplo, empezar a escribir en una celda de la tabla de variables)
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isEditingTarget(e.target)) return;
      const n = num(e);
      if (n < 0) return;
      e.preventDefault();
      if (e.repeat) return;
      const k = `E124.${n}`;
      if (e.shiftKey) {
        sim.pressMomentary(k, 1);
        held.set(n, k);
        return;
      }
      const t = sim.inputTipo(k);
      sim.press(k);
      if (t === 'NA' || t === 'NC') held.set(n, k);
    };
    const ku = (e: KeyboardEvent) => {
      const n = num(e);
      const k = n >= 0 ? held.get(n) : undefined;
      if (!k) return;
      held.delete(n);
      sim.releaseMomentary(k);
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [sim, teclas]);
}

/** Panel del simulador libre: interruptores de palanca E124.0–E124.7, LEDs A124.0–A124.7. */
function SwitchIo({ sim, symByAddr, onInputsChanged, hidden = [], extra = [], onIoState, clockByte, lang }: IoPanelProps) {
  const R = rotulos(lang);
  const teclas = useSettings((s) => s.teclasEntradas);
  const [menu, setMenu] = useState<{ x: number; y: number; key: string; out?: boolean } | null>(null);
  const usage = sim.usage;
  const hid = useMemo(() => new Set(hidden), [hidden]);
  /** pulsaciones momentáneas en curso (Mayús o entradas tipo pulsador): clave → true */
  const held = useRef(new Map<string, string>());

  const ins = useMemo(() => {
    const set = new Set<string>(FIXED_IN);
    for (const k of usage ? inputBits(usage) : []) set.add(k);
    for (const [addr] of symByAddr) if (/^E\d+\.\d$/.test(addr)) set.add(addr);
    for (const k of sim.inputs.keys()) set.add(k);
    for (const k of extra) set.add(k);
    return sortBits([...set].filter((k) => !hid.has(k)));
  }, [usage, symByAddr, extra, hid, sim.inputs.size]);
  const outs = useMemo(() => {
    const set = new Set<string>(FIXED_OUT);
    for (const k of usage ? outputBits(usage) : []) set.add(k);
    for (const [addr] of symByAddr) if (/^A\d+\.\d$/.test(addr)) set.add(addr);
    return sortBits([...set].filter((k) => !hid.has(k)));
  }, [usage, symByAddr, hid]);
  const analog = useMemo(() => (usage ? analogInputs(usage) : []), [usage]);
  const words = useMemo(() => (usage ? outputWords(usage) : []), [usage]);
  const marcas = useMarcas(sim);
  useSimTick(sim, 20, () => firmaIo(sim, ins, outs, marcas, analog, words, clockByte ?? null));

  const down = (k: string, shift: boolean, src: string) => {
    if (shift) {
      sim.pressMomentary(k, 1);
      held.current.set(src, k);
      return;
    }
    const t = sim.inputTipo(k);
    sim.press(k);
    if (t === 'NA' || t === 'NC') held.current.set(src, k);
  };
  const up = (src: string) => {
    const k = held.current.get(src);
    if (!k) return;
    held.current.delete(src);
    sim.releaseMomentary(k);
  };

  const cpu = sim.cpu;
  const outBit = (k: string) => {
    const m = /^A(\d+)\.(\d)$/.exec(k)!;
    return (cpu.periphOut[+m[1]] >> +m[2]) & 1;
  };
  const hide = (k: string) => {
    if (sim.inputs.has(k)) sim.clearInputTipo(k);
    onIoState?.({ hidden: [...hidden.filter((x) => x !== k), k], extra: extra.filter((x) => x !== k) });
  };
  const quitadasIn = hidden.filter((k) => k.startsWith('E'));
  const quitadasOut = hidden.filter((k) => k.startsWith('A'));

  const sw = (k: string) => {
    const v = sim.getInputBit(k);
    const t = sim.inputTipo(k);
    const fixed = KEY_ROW.includes(k);
    const n = fixed ? bitOf(k) + 1 : 0;
    const sym = symByAddr.get(k);
    return (
      <button key={k} className={`sw ${v ? 'on' : ''}`} aria-pressed={!!v} style={{ gridColumn: bitOf(k) + 1 }}
        title={`${R.mostrar(k)}${sym ? ` «${sym}»` : ''}\n${t === 'NA' ? T.io.pulsadorNa : t === 'NC' ? T.io.pulsadorNc : T.io.interruptorTitulo}\n${fixed && teclas ? T.io.teclaN(n) : T.io.soloRaton}`}
        onMouseDown={(e) => { if (e.button === 0) down(k, e.shiftKey, `mouse${k}`); }}
        onMouseUp={() => up(`mouse${k}`)}
        onMouseLeave={() => up(`mouse${k}`)}
        onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); e.stopPropagation(); down(k, e.shiftKey, `kb${k}`); } }}
        onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') up(`kb${k}`); }}
        onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, key: k }); }}>
        <span className="sw-body"><span className="sw-knob" /></span>
        <span className="sw-addr">{k.replace(/^E/, '')}</span>
        <span className="sw-foot">
          {fixed && teclas && <span className="kbd">{n}</span>}
          {(t === 'NA' || t === 'NC') && <span className="kind">{t === 'NA' ? T.io.pul : 'NC'}</span>}
        </span>
        {sym && <span className="sw-sym">{sym}</span>}
      </button>
    );
  };
  const led = (k: string) => {
    const v = outBit(k);
    const sym = symByAddr.get(k);
    return (
      <div key={k} className={`lamp ${v ? 'on' : ''}`} title={`${R.mostrar(k)}${sym ? ` «${sym}»` : ''}\n${T.io.quitarClicDerecho}`} style={{ gridColumn: bitOf(k) + 1 }}
        onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, key: k, out: true }); }}>
        <span className="lamp-led" />
        <span className="sw-addr">{k.replace(/^A/, '')}</span>
        {sym && <span className="sw-sym">{sym}</span>}
      </div>
    );
  };

  return (
    <div>
      <div className="panel-sec">
        <h4>{T.io.entradas} <span className="mono" style={{ textTransform: 'none' }}>{R.e}</span><span className="spacer" /><button className="btn small ghost" style={{ textTransform: 'none', letterSpacing: 0 }} onClick={() => sim.resetInputs(true)} title={T.io.bajarTodos}>{T.io.todasA0}</button></h4>
        {bytesOf(ins).map(([b, keys]) => (
          <div key={b}>
            <div className="sw-cap">{R.e} {b}{b === 124 && teclas ? T.io.teclas18 : b === 125 ? T.io.conRaton : ''}</div>
            <div className="sw-row">{keys.map(sw)}</div>
          </div>
        ))}
        <div className="faint" style={{ fontSize: 11, margin: '6px 0' }}>
          <Rico t={T.io.ayudaLibre(teclas)} />
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <AddInput lang={lang} onAdd={(k) => onIoState?.({ extra: [...extra.filter((x) => x !== k), k], hidden: hidden.filter((x) => x !== k) })} />
          {quitadasIn.length > 0 && <button className="btn small ghost" onClick={() => onIoState?.({ hidden: hidden.filter((k) => !k.startsWith('E')) })} title={quitadasIn.join(', ')}>{T.io.mostrarEntradasQuitadas(quitadasIn.length)}</button>}
        </div>
      </div>
      <div className="panel-sec">
        <h4>{T.io.salidas} <span className="mono" style={{ textTransform: 'none' }}>{R.a}</span></h4>
        {bytesOf(outs).map(([b, keys]) => (
          <div key={b}>
            <div className="sw-cap">{R.a} {b}</div>
            <div className="sw-row">{keys.map(led)}</div>
          </div>
        ))}
        {!outs.length && <div className="faint" style={{ fontSize: 12 }}>{T.io.sinSalidas}</div>}
        {quitadasOut.length > 0 && <button className="btn small ghost" onClick={() => onIoState?.({ hidden: hidden.filter((k) => !k.startsWith('A')) })} title={quitadasOut.join(', ')}>{T.io.mostrarSalidasQuitadas(quitadasOut.length)}</button>}
      </div>
      <MarcasSec sim={sim} symByAddr={symByAddr} clockByte={clockByte} marcas={marcas} />
      {(analog.length > 0 || words.length > 0) && (
        <div className="panel-sec">
          <h4>{T.io.analogicas}</h4>
          {analog.map((a) => <AnalogIn key={a} sim={sim} addr={a} />)}
          {words.map((w) => <WordOut key={w} sim={sim} addr={w} />)}
        </div>
      )}
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)}
          items={menu.out ? [{ label: T.io.quitarDelPanel(R.mostrar(menu.key)), onClick: () => hide(menu.key) }] : [
            { label: `${(sim.inputs.get(menu.key) ?? 'INT') === 'INT' ? '✓ ' : ''}${T.io.menuInterruptor}`, onClick: () => { sim.clearInputTipo(menu.key); onInputsChanged?.(); } },
            { label: `${sim.inputs.get(menu.key) === 'NA' ? '✓ ' : ''}${T.io.menuNa}`, onClick: () => { sim.setInputTipo(menu.key, 'NA'); onInputsChanged?.(); } },
            { label: `${sim.inputs.get(menu.key) === 'NC' ? '✓ ' : ''}${T.io.menuNc}`, onClick: () => { sim.setInputTipo(menu.key, 'NC'); onInputsChanged?.(); } },
            { sep: true, label: '' },
            { label: T.io.quitarDelPanel(R.mostrar(menu.key)), onClick: () => hide(menu.key) },
          ]} />
      )}
    </div>
  );
}

function ClassicIo({ sim, symByAddr, onInputsChanged, clockByte, lang }: IoPanelProps) {
  const R = rotulos(lang);
  const teclas = useSettings((s) => s.teclasEntradas);
  const modo = useSettings((s) => s.entradaClic);
  const setSettings = useSettings((s) => s.set);
  const [menu, setMenu] = useState<{ x: number; y: number; key: string } | null>(null);
  const [extraIn, setExtraIn] = useState<string[]>([]);
  const usage = sim.usage;

  const ins = useMemo(() => {
    const set = new Set<string>(usage ? inputBits(usage) : []);
    for (const [addr] of symByAddr) if (/^E\d+\.\d$/.test(addr)) set.add(addr);
    for (const k of sim.inputs.keys()) set.add(k);
    for (const k of extraIn) set.add(k);
    // sin entradas en el programa: E/S integrada de la CPU (EB124, EB125)
    if (set.size === 0) for (const b of [124, 125]) for (let i = 0; i < 8; i++) set.add(`E${b}.${i}`);
    return sortBits([...set]);
  }, [usage, symByAddr, extraIn, sim.inputs.size]);
  /** Byte de entradas que manejan las teclas 1–8: el primero que usa el programa (124 si no usa ninguno). */
  const keyByte = useMemo(() => parseInt(/^E(\d+)\./.exec(ins[0] ?? 'E124.0')![1], 10), [ins]);

  const outs = useMemo(() => {
    const set = new Set<string>(usage ? outputBits(usage) : []);
    for (const [addr] of symByAddr) if (/^A\d+\.\d$/.test(addr)) set.add(addr);
    if (set.size === 0) for (const b of [124, 125]) for (let i = 0; i < 8; i++) set.add(`A${b}.${i}`);
    return sortBits([...set]);
  }, [usage, symByAddr]);

  const analog = useMemo(() => (usage ? analogInputs(usage) : []), [usage]);
  const words = useMemo(() => (usage ? outputWords(usage) : []), [usage]);
  const marcas = useMarcas(sim);
  useSimTick(sim, 20, () => firmaIo(sim, ins, outs, marcas, analog, words, clockByte ?? null));

  // teclas 1–8 → bits 0–7 del primer byte de entradas
  useEffect(() => {
    if (!teclas) return;
    const isEditing = (t: EventTarget | null) => t instanceof HTMLElement && (t.closest('.cm-editor') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable || t.closest('.kop-editor'));
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isEditing(e.target)) return;
      const n = '12345678'.indexOf(e.key);
      if (n >= 0) { sim.press(`E${keyByte}.${n}`); e.preventDefault(); }
    };
    const up = (e: KeyboardEvent) => {
      if (isEditing(e.target)) return;
      const n = '12345678'.indexOf(e.key);
      if (n >= 0) sim.release(`E${keyByte}.${n}`);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [sim, teclas, keyByte]);

  const cpu = sim.cpu;
  const outBit = (k: string) => {
    const m = /^A(\d+)\.(\d)$/.exec(k)!;
    return (cpu.periphOut[+m[1]] >> +m[2]) & 1;
  };

  return (
    <div>
      <div className="panel-sec">
        <h4>{T.io.entradas}</h4>
        <div className="row" style={{ gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <span className="faint" style={{ fontSize: 11.5 }}>{T.io.clicEnEntrada}</span>
          <div className="btn-group" role="group" aria-label={T.io.comportamiento}>
            <button className={`btn small ${modo === 'NA' ? 'active' : ''}`} title={T.io.pulsadorTitulo}
              onClick={() => { setSettings({ entradaClic: 'NA' }); sim.resetInputs(); }}>{T.io.pulsador}</button>
            <button className={`btn small ${modo === 'INT' ? 'active' : ''}`} title={T.io.interruptorClicTitulo}
              onClick={() => { setSettings({ entradaClic: 'INT' }); sim.resetInputs(); }}>{T.io.interruptor}</button>
          </div>
          <button className="btn small ghost" onClick={() => sim.resetInputs(true)} title={T.io.reposoTitulo}>{T.io.todasA0}</button>
        </div>
        <div className="faint" style={{ fontSize: 11, marginBottom: 6 }}>
          {modo === 'NA' ? T.io.mantenPulsado : T.io.cadaClic}
          {T.io.clicDerechoTipo(teclas ? T.io.teclasRango(keyByte) : '')}
        </div>
        {bytesOf(ins).map(([b, keys]) => (
          <div key={b} className="io-grid" style={{ marginBottom: 6 }}>
            {keys.map((k) => {
              const v = sim.getInputBit(k);
              const tipo = sim.inputTipo(k);
              const m = k.startsWith(`E${keyByte}.`) ? /\.(\d)$/.exec(k) : null;
              return (
                <button key={k} className={`io-in ${v ? 'on' : ''}`} aria-pressed={!!v}
                  title={`${R.mostrar(k)}${symByAddr.get(k) ? ` «${symByAddr.get(k)}»` : ''} — ${TIPO_NAME[tipo]}`}
                  onMouseDown={(e) => { if (e.button === 0) sim.press(k); }}
                  onMouseUp={(e) => { if (e.button === 0) sim.release(k); }}
                  onMouseLeave={() => { if (tipo === 'NA' || tipo === 'NC') sim.release(k); }}
                  onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) sim.press(k); } }}
                  onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') sim.release(k); }}
                  onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, key: k }); }}>
                  <span className="addr"><span className={`led ${v ? 'on' : ''}`} />{R.mostrar(k)}</span>
                  <span className="row2">
                    <span className="sym">{symByAddr.get(k) ?? '\u00a0'}</span>
                    <span className="chips">
                      {teclas && m && <span className="kbd">{+m[1] + 1}</span>}
                      <span className="kind" style={sim.inputs.has(k) ? { color: 'var(--accent)' } : undefined}>{TIPO_LABEL[tipo]}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
        <AddInput lang={lang} onAdd={(k) => setExtraIn((x) => [...x, k])} />
      </div>
      <div className="panel-sec">
        <h4>{T.io.salidas}</h4>
        {bytesOf(outs).map(([b, keys]) => (
          <div key={b} className="io-grid" style={{ marginBottom: 6 }}>
            {keys.map((k) => {
              const v = outBit(k);
              return (
                <div key={k} className={`io-out ${v ? 'on' : ''}`} title={symByAddr.get(k)}>
                  <span className="addr"><span className={`led ${v ? 'on' : ''}`} />{R.mostrar(k)}</span>
                  <span className="sym">{symByAddr.get(k) ?? ' '}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <MarcasSec sim={sim} symByAddr={symByAddr} clockByte={clockByte} marcas={marcas} />
      {(analog.length > 0 || words.length > 0) && (
        <div className="panel-sec">
          <h4>{T.io.analogicas}</h4>
          {analog.map((a) => <AnalogIn key={a} sim={sim} addr={a} />)}
          {words.map((w) => <WordOut key={w} sim={sim} addr={w} />)}
        </div>
      )}
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)}
          items={[
            { label: `${!sim.inputs.has(menu.key) ? '✓ ' : ''}${T.io.comoLasDemas}`, onClick: () => { sim.clearInputTipo(menu.key); onInputsChanged?.(); } },
            { sep: true, label: '' },
            ...(['NA', 'NC', 'INT', 'SENSOR'] as InputTipo[]).map((t) => ({ label: `${sim.inputs.get(menu.key) === t ? '✓ ' : ''}${TIPO_NAME[t]}`, onClick: () => { sim.setInputTipo(menu.key, t); onInputsChanged?.(); } })),
          ]} />
      )}
    </div>
  );
}

function AddInput({ onAdd, lang }: { onAdd: (k: string) => void; lang?: 'de' | 'en' }) {
  const [v, setV] = useState('');
  return (
    <form className="row" style={{ marginTop: 4 }} onSubmit={(e) => {
      e.preventDefault();
      // E 1.0 o, con la nemotecnia inglesa, I 1.0
      const m = /^[EI]\s*(\d+)\.([0-7])$/i.exec(v.trim());
      if (m) { onAdd(`E${+m[1]}.${m[2]}`); setV(''); }
    }}>
      <input className="input mono" style={{ width: 90, height: 24 }} placeholder={lang === 'en' ? 'I 1.0' : 'E 1.0'} value={v} onChange={(e) => setV(e.target.value)} aria-label={T.io.anadirEntrada} />
      <button className="btn small" type="submit">{T.io.anadirEntrada}</button>
    </form>
  );
}

function AnalogIn({ sim, addr }: { sim: SimController; addr: string }) {
  const r = useMemo(() => makeReader(addr), [addr]);
  const v = s16(readRaw(sim.cpu, r) || 0);
  return (
    <div className="analog">
      <span className="mono">{addr}</span>
      <input type="range" min={0} max={32767} step={1} value={v} onChange={(e) => sim.setWord(addr, +e.target.value)} aria-label={addr} />
      <input className="input mono" style={{ height: 24, width: 64 }} value={v} onChange={(e) => { const n = parseInt(e.target.value, 10); if (Number.isFinite(n)) sim.setWord(addr, n & 0xFFFF); }} aria-label={T.io.valor(addr)} />
    </div>
  );
}

function WordOut({ sim, addr }: { sim: SimController; addr: string }) {
  const r = useMemo(() => makeReader(addr), [addr]);
  const raw = readRaw(sim.cpu, r);
  const isBcd = !Number.isNaN(raw) && [12, 8, 4, 0].every((s) => ((raw >> s) & 0xF) <= 9);
  return (
    <div className="analog">
      <span className="mono">{addr}</span>
      <span className="mono">{Number.isNaN(raw) ? '—' : `${s16(raw)} · W#16#${raw.toString(16).toUpperCase().padStart(4, '0')}`}</span>
      {isBcd ? <span className="seven" title={T.io.display}>{raw.toString(16).padStart(4, '0')}</span> : <span />}
    </div>
  );
}
