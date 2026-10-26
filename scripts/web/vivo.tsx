// Ejemplos interactivos de la web (docs/vivo.js): el mismo motor, el mismo flujo de corriente y el mismo
// dibujo KOP que la app. Cada ejemplo se ejecuta solo mientras se ve en pantalla.
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { kopModel } from '../../src/content/kop/models';
import { parseUserValue, type Formato } from '../../src/core/format';
import { bitsF32, hex, s16, s32, S5_BASES_MS } from '../../src/core/num';
import { parseOperand } from '../../src/core/operands';
import { programFromAwl, type Programa } from '../../src/core/program';
import { displayOperand } from '../../src/core/translate';
import { computeFlow, type Flow } from '../../src/kop/flow';
import { layoutSegment } from '../../src/kop/layout';
import type { SegmentoKOP } from '../../src/kop/model';
import { KopSvg } from '../../src/kop/render/KopSvg';
import { SimController, originKeyElem, originKeySeg } from '../../src/sim/SimController';
import { makeReader, readRaw, type Reader } from '../../src/sim/readers';
import type { DatosVivo, OperandoVivo, TextosVivo, TipoValor } from './vivo-datos';

const nada = () => {};

function programa(d: DatosVivo, segs: SegmentoKOP[] | null): Programa {
  let p: Programa;
  if (segs) p = { nemotecnia: 'de', simbolos: [], bloques: [{ nombre: 'OB1', segmentos: segs.map((kop) => ({ lang: 'KOP' as const, kop })) }] };
  else {
    // el código sale del documento en español: nemotecnia alemana (d.nemotecnia solo decide cómo se enseña)
    p = programFromAwl(d.awl ?? '', d.id);
  }
  if (d.marcaCiclo !== undefined) {
    p.hw = { estaciones: [{ id: 'hw1', tipo: 'CPU', nombre: 'CPU(1)', marcaCiclo: { activa: true, byte: d.marcaCiclo } }] };
  }
  return p;
}

const tamano = (t: TipoValor) => (t === 'BOOL' ? 0 : t === 'BYTE' ? 1 : t === 'INT' || t === 'WORD' ? 2 : 4) as 0 | 1 | 2 | 4;
const formato = (t: TipoValor): Formato => (t === 'REAL' ? 'REAL' : t === 'WORD' ? 'HEX' : t === 'BOOL' ? 'BOOL' : 'DEC');

function texto(raw: number, t: TipoValor): string {
  if (Number.isNaN(raw)) return '—';
  switch (t) {
    case 'BOOL': return String(raw & 1);
    case 'BYTE': return String(raw & 0xFF);
    case 'INT': return String(s16(raw));
    case 'DINT': return String(s32(raw));
    case 'WORD': return `W#16#${hex(raw & 0xFFFF, 4)}`;
    case 'REAL': {
      const x = bitsF32(raw >>> 0);
      return Number.isFinite(x) ? String(Number(x.toPrecision(7))) : String(x);
    }
  }
}

/** Las entradas se escriben en la periferia: la CPU la copia a la imagen de entradas al empezar cada ciclo */
const deEscritura = (op: string) => op.replace(/^E([BWD])/, 'PE$1');

// ───────── Flujo de corriente (como en el editor KOP de la app) ─────────

function flujo(sim: SimController, seg: SegmentoKOP): Flow | null {
  const cpu = sim.cpu;
  if (cpu.state !== 'RUN') return null;
  const ob = cpu.obs.get('OB1');
  const blk = cpu.blocks.get('OB1');
  if (!ob || !blk) return null;
  const segLoc = sim.index.map.get(originKeySeg('OB1', seg.id));
  const segExecuted = !!segLoc && ob.stamp[segLoc[0].pc] === cpu.stamp;
  const simbolos = sim.compiled.symbols;
  return computeFlow(seg, (id, role) => {
    const locs = sim.index.map.get(originKeyElem('OB1', seg.id, id));
    if (!locs) return null;
    for (let i = locs.length - 1; i >= 0; i--) {
      const pc = locs[i].pc;
      if (blk.instrs[pc]?.origin?.role !== role) continue;
      const st = ob.st[pc];
      return { executed: ob.stamp[pc] === cpu.stamp, rlo: (st >> 1) & 1, sta: (st >> 2) & 1, count: ob.count[pc] };
    }
    return null;
  }, (s) => {
    try {
      if (s.k === 'TEMP') return cpu.timers[parseOperand(s.t, simbolos)!.n!].q;
      if (s.k === 'CONT') return cpu.counters[parseOperand(s.z, simbolos)!.n!].value > 0 ? 1 : 0;
      if (s.k === 'BIEST') return readRaw(cpu, makeReader(s.op, simbolos));
    } catch { /* operando no válido */ }
    return null;
  }, segExecuted);
}

// ───────── Panel ─────────

interface Vista {
  flujos: (Flow | null)[];
  bits: Map<string, number>;
  valores: Map<string, string>;
  temporizadores: { n: number; ms: number; q: number }[];
  contadores: { n: number; valor: number; q: number }[];
}

function Ejemplo({ d, t, sim, segs, figura }: { d: DatosVivo; t: TextosVivo; sim: SimController; segs: SegmentoKOP[] | null; figura: HTMLElement | null }) {
  const lang = d.nemotecnia;
  const ver = (op: string) => displayOperand(op, lang);
  const lectores = useRef(new Map<string, Reader | null>());
  const lector = (op: string, valorTZ = false) => {
    const clave = `${op}|${valorTZ}`;
    if (!lectores.current.has(clave)) {
      let r: Reader | null = null;
      try {
        const o = parseOperand(op, sim.compiled.symbols);
        if (o && (o.kind === 'mem' || o.kind === 'bit' || o.kind === 'timer' || o.kind === 'counter')) {
          r = makeReader(valorTZ && o.kind !== 'mem' && o.kind !== 'bit' ? `${op}:VALOR` : op, sim.compiled.symbols);
        }
      } catch { r = null; }
      lectores.current.set(clave, r);
    }
    return lectores.current.get(clave) ?? null;
  };
  const leer = (op: string) => {
    const r = lector(op);
    return r ? readRaw(sim.cpu, r) : NaN;
  };

  // Pilotos: las salidas del programa (A) y las marcas que comprueban las pruebas
  const usadas = sim.usage?.accesses ?? [];
  const pilotos = [...new Set([
    ...usadas.filter((a) => a.kind === 'bit' && a.area === 'A' && a.mode !== 'r')
      .sort((a, b) => a.byte - b.byte || a.bit - b.bit).map((a) => `A ${a.byte}.${a.bit}`),
    ...d.salidas.filter((s) => s.tipo === 'BOOL').map((s) => s.op),
  ])];
  const numeros = d.salidas.filter((s) => s.tipo !== 'BOOL');
  const bitsEntrada = d.entradas.filter((e) => e.tipo === 'BOOL');
  const numEntrada = d.entradas.filter((e) => e.tipo !== 'BOOL');

  const calcular = (): Vista => {
    const cpu = sim.cpu;
    return {
      flujos: segs ? segs.map((s) => flujo(sim, s)) : [],
      bits: new Map([...bitsEntrada.map((e) => [e.op, sim.getInputBit(e.op)] as const), ...pilotos.map((op) => [op, leer(op) & 1] as const)]),
      valores: new Map(numeros.map((s) => [s.op, texto(leer(s.op), s.tipo)])),
      temporizadores: [...(sim.usage?.timers.keys() ?? [])].sort((a, b) => a - b).map((n) => {
        const tm = cpu.timers[n];
        return { n, ms: tm.value * S5_BASES_MS[tm.base], q: tm.q };
      }),
      contadores: [...(sim.usage?.counters ?? [])].sort((a, b) => a - b).map((n) => ({ n, valor: cpu.counters[n].value, q: cpu.counters[n].value > 0 ? 1 : 0 })),
    };
  };
  const firma = (v: Vista) => JSON.stringify([
    v.flujos.map((f) => (f ? [...f.values()].join('') : '-')), [...v.bits], [...v.valores], v.temporizadores, v.contadores,
  ]);

  const [vista, setVista] = useState(calcular);
  const ultima = useRef('');
  useEffect(() => {
    let pendiente = 0;
    const mirar = () => {
      pendiente = 0;
      const v = calcular();
      const f = firma(v);
      if (f !== ultima.current) { ultima.current = f; setVista(v); }
    };
    const quitar = sim.subscribe(() => { if (!pendiente) pendiente = requestAnimationFrame(mirar); });
    return () => { quitar(); cancelAnimationFrame(pendiente); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Valores numéricos que escribe el alumno
  const [escritos, setEscritos] = useState(() => new Map(numEntrada.map((e) => [e.op, e.valor])));
  const [malos, setMalos] = useState(new Set<string>());
  const escribir = (e: OperandoVivo, valor: string) => {
    try {
      sim.setWord(deEscritura(e.op), parseUserValue(valor, tamano(e.tipo), formato(e.tipo)));
      setMalos((m) => { const n = new Set(m); n.delete(e.op); return n; });
    } catch {
      setMalos((m) => new Set(m).add(e.op));
    }
  };

  const iniciar = () => {
    for (const e of bitsEntrada) sim.setInputBit(e.op, Number(e.valor) ? 1 : 0);
    for (const e of numEntrada) escribir(e, escritos.get(e.op) ?? e.valor);
  };
  const reiniciar = () => {
    sim.mres();
    sim.setRun(true);
    iniciar();
  };

  // Solo se ejecuta mientras se ve alguna parte del ejemplo (el esquema o el panel)
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    iniciar();
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) sim.play();
      else sim.pause();
    });
    obs.observe(panel.current!.closest('.ejemplo') ?? panel.current!);
    return () => { obs.disconnect(); sim.dispose(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mayús + clic: pulsador (cambia la entrada solo mientras se mantiene)
  const momentanea = useRef<string | null>(null);
  const apretar = (e: PointerEvent, op: string, inicial: string) => {
    if (!e.shiftKey) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    momentanea.current = op;
    sim.pressMomentary(op, Number(inicial) ? 0 : 1);
  };
  const soltar = () => {
    if (momentanea.current) sim.releaseMomentary(momentanea.current);
  };
  const clic = (op: string) => {
    if (momentanea.current === op) { momentanea.current = null; return; }
    sim.toggleInput(op);
  };

  const live = (op: string) => {
    const r = lector(op, true);
    if (!r) return null;
    const raw = readRaw(sim.cpu, r);
    if (Number.isNaN(raw)) return null;
    return String(r.size === 2 && r.kind === 'mem' ? s16(raw) : r.size === 4 ? s32(raw) : raw);
  };

  const kop = segs && figura && createPortal(segs.map((seg, i) => (
    <div className="kop-seg" key={seg.id}>
      {segs.length > 1 && <p className="kop-titulo">{figura.dataset.segmento} {i + 1}{lang === 'de' && figura.dataset.titulos && seg.titulo ? ` · ${seg.titulo}` : ''}</p>}
      <div className="kop-lienzo">
        <KopSvg layout={layoutSegment(seg)} flow={vista.flujos[i]} selected={null} issues={new Map()} lang={lang}
          showOp={(op) => ({ main: displayOperand(op, lang) })} live={live}
          onSelect={nada} onEdit={nada} onPin={nada} onContext={nada} />
      </div>
    </div>
  )), figura);

  const segundos = (ms: number) => `${(ms / 1000).toLocaleString(document.documentElement.lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;

  return (
    <div className="vivo-panel" ref={panel}>
      {kop}
      <div className="vivo-cabeza">
        <span className="led-run" aria-hidden="true" />
        <b>{t.pruebalo}</b>
        <span className="vivo-pista">{t.pista} <span className="vivo-mayus">{t.pistaMayus}</span></span>
        <button type="button" className="vivo-reiniciar" onClick={reiniciar}>{t.reiniciar}</button>
      </div>
      <div className="vivo-es">
        {bitsEntrada.length > 0 && (
          <div className="palancas">
            {bitsEntrada.map((e) => (
              <button key={e.op} className="palanca" type="button" role="switch" aria-checked={vista.bits.get(e.op) === 1}
                onPointerDown={(ev) => apretar(ev, e.op, e.valor)} onPointerUp={soltar} onPointerCancel={soltar} onClick={() => clic(e.op)}>
                <span className="palanca-pista"><span className="palanca-bola" /></span>
                <span className="palanca-etiqueta">{ver(e.op)}</span>
              </button>
            ))}
          </div>
        )}
        {numEntrada.map((e) => (
          <label key={e.op} className={`vivo-campo${malos.has(e.op) ? ' mal' : ''}`}>
            <span>{ver(e.op)}</span>
            <input value={escritos.get(e.op) ?? ''} spellCheck={false} inputMode={e.tipo === 'WORD' ? 'text' : 'decimal'}
              title={malos.has(e.op) ? t.valorNoValido : undefined}
              onChange={(ev) => { const v = ev.target.value; setEscritos((m) => new Map(m).set(e.op, v)); escribir(e, v); }} />
          </label>
        ))}
        {(pilotos.length > 0 || numeros.length > 0 || vista.temporizadores.length > 0 || vista.contadores.length > 0) && (
          <div className="vivo-salidas">
            {pilotos.map((op) => (
              <span className="salida" key={op}>
                <span className={`piloto${vista.bits.get(op) ? ' on' : ''}`} aria-hidden="true" />
                <span className="palanca-etiqueta">{ver(op)}</span>
                <span className="sr-only">{vista.bits.get(op) ? '1' : '0'}</span>
              </span>
            ))}
            {vista.temporizadores.map((tm) => (
              <span className="vivo-valor" key={`t${tm.n}`}>
                <span className={`vivo-q${tm.q ? ' on' : ''}`} aria-hidden="true" />{ver(`T ${tm.n}`)}<b>{segundos(tm.ms)}</b>
              </span>
            ))}
            {vista.contadores.map((z) => (
              <span className="vivo-valor" key={`z${z.n}`}>
                <span className={`vivo-q${z.q ? ' on' : ''}`} aria-hidden="true" />{ver(`Z ${z.n}`)}<b>{z.valor}</b>
              </span>
            ))}
            {numeros.map((s) => (
              <span className="vivo-valor" key={s.op}>{ver(s.op)}<b>{vista.valores.get(s.op)}</b></span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ───────── Montaje ─────────

function montar() {
  const datosTextos = document.getElementById('vivo-textos');
  if (!datosTextos) return;
  const t = JSON.parse(datosTextos.textContent!) as TextosVivo;
  for (const el of document.querySelectorAll<HTMLElement>('[data-vivo]')) {
    const d = JSON.parse(el.dataset.vivo!) as DatosVivo;
    const segs = d.segmentos ?? (d.kop ? kopModel(d.id) : null);
    const sim = new SimController(programa(d, segs));
    if (sim.hasErrors) continue;
    const figura = segs ? el.closest('.ejemplo')?.querySelector<HTMLElement>('figure.kop') ?? null : null;
    figura?.replaceChildren();
    createRoot(el).render(<Ejemplo d={d} t={t} sim={sim} segs={segs} figura={figura} />);
  }
}

montar();
