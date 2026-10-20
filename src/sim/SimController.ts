// Controlador del simulador: posee la CPU, el programa compilado, el bucle de tiempo real,
// la E/S, el forzado, los puntos de parada y el analizador. Vive fuera de React.
import { CPU, type TraceRow, type StopLoc } from '../core/cpu';
import type { CompiledProgram } from '../core/compiler';
import { clockByteOf, compileProgram, type Programa, type ProgramCompile } from '../core/program';
import { analyzeUsage, type Usage } from '../core/usage';
import { parseOperand } from '../core/operands';
import { AnalyzerBuffer } from './analyzer';
import { makeReader, readRaw, writeRaw, type Reader } from './readers';
import { getSettings } from '../store/settings';

export type InputTipo = 'INT' | 'NA' | 'NC' | 'SENSOR';

export interface ForceItem { text: string; reader: Reader; raw: number; display: string }

export type Trigger = { signalId: number; edge: 'sube' | 'baja' | 'cambia' } | null;

/**
 * Despertares del bucle por segundo. Con requestAnimationFrame iba a la frecuencia de la pantalla
 * (180 Hz en un monitor rápido) aunque a ×1 solo haya 100 ciclos por segundo; con un temporizador
 * fijo se ahorra trabajo. El tiempo del PLC sale del reloj, así que la precisión no cambia.
 */
export const LOOP_HZ = 90;
const LOOP_MS = 1000 / LOOP_HZ;

export const originKeyLine = (block: string, seg: string, line: number) => `${block}|${seg}|L${line}`;
export const originKeyElem = (block: string, seg: string, elem: string) => `${block}|${seg}|E${elem}`;
export const originKeySeg = (block: string, seg: string) => `${block}|${seg}|S`;

export interface OriginIndex {
  /** origen → posiciones (bloque, pc) */
  map: Map<string, { block: string; pc: number }[]>;
  /** (bloque, pc) → claves de origen */
  rev: Map<string, string[]>;
}

export function buildOriginIndex(cp: CompiledProgram): OriginIndex {
  const map = new Map<string, { block: string; pc: number }[]>();
  const rev = new Map<string, string[]>();
  const add = (k: string, block: string, pc: number) => {
    const arr = map.get(k);
    if (arr) arr.push({ block, pc });
    else map.set(k, [{ block, pc }]);
    const rk = `${block}|${pc}`;
    const r = rev.get(rk);
    if (r) r.push(k);
    else rev.set(rk, [k]);
  };
  for (const [name, b] of cp.blocks) {
    const seenSeg = new Set<string>();
    b.instrs.forEach((ins, pc) => {
      const o = ins.origin;
      if (!o?.seg) return;
      if (!seenSeg.has(o.seg)) {
        seenSeg.add(o.seg);
        add(originKeySeg(name, o.seg), name, pc);
      }
      if (o.elem) add(originKeyElem(name, o.seg, o.elem), name, pc);
      else if (o.line !== undefined && ins.line > 0) add(originKeyLine(name, o.seg, o.line), name, pc);
    });
  }
  return { map, rev };
}

export class SimController {
  cpu: CPU;
  programa: Programa;
  compiled: ProgramCompile;
  usage: Usage | null = null;
  index: OriginIndex = { map: new Map(), rev: new Map() };
  /** Programa válido pendiente de cargar al terminar el ciclo en curso */
  pending: { cp: CompiledProgram; pc: ProgramCompile } | null = null;
  playing = false;
  /** Arrancar solo en cuanto el programa no tenga errores (hasta que el alumno pause a mano) */
  autoPlay = false;
  speed = 1;
  limited = false;
  inputs = new Map<string, InputTipo>();
  forces = new Map<string, ForceItem>();
  bpKeys = new Set<string>();
  analyzer = new AnalyzerBuffer();
  trigger: Trigger = null;
  /** Traza del último ciclo capturado o del paso a paso */
  trace: TraceRow[] = [];
  traceCycle = 0;
  lastStop: { reason: string; loc: StopLoc | null } | null = null;
  message: string | null = null;
  /** Sube en cada aviso, también tras cada lote de ciclos */
  version = 0;
  /** Sube solo con cambios que no son un ciclo más: programa, RUN/STOP, pausa, E/S, forzado,
   *  puntos de parada, traza… Los paneles que no enseñan la memoria en vivo solo miran esto. */
  rev = 0;

  private listeners = new Set<() => void>();
  /** Temporizador del bucle (null = parado) */
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Próximo despertar previsto (para mantener el ritmo aunque el temporizador se retrase) */
  private nextAt = 0;
  /** Último despertar del bucle propio con la ventana visible */
  private lastTick = -Infinity;
  private lastT = 0;
  private debt = 0;
  private pressedAt = new Map<string, number>();
  private pendingRelease = new Set<string>();
  private captureArmed = false;
  private trigPrev = new Map<number, number>();
  private dirty = false;
  /** Durante un lote de ciclos ha pasado algo «estructural» (programa cargado, traza capturada) */
  private structural = false;

  constructor(programa: Programa) {
    this.programa = programa;
    this.compiled = compileProgram(programa);
    const cp = this.compiled.cp ?? { blocks: new Map([['OB1', { name: 'OB1', instrs: [], labels: new Map() }]]) };
    this.cpu = this.newCpu(cp);
    this.cpu.clockByte = clockByteOf(programa);
    if (this.compiled.cp) this.applyCompiled(this.compiled.cp, this.compiled);
  }

  private newCpu(cp: CompiledProgram): CPU {
    const st = getSettings();
    const cpu = new CPU(cp, { cycleMs: st.cycleMs });
    cpu.observe = true;
    cpu.retentiveMBytes = st.retentiveMBytes;
    cpu.retentiveCounters = st.retentiveCounters;
    cpu.retentiveTimers = st.retentiveTimers;
    cpu.randomLocals = st.randomLocals;
    cpu.onCycleEnd = () => this.afterCycle();
    return cpu;
  }

  applySettings() {
    const st = getSettings();
    this.cpu.cycleMs = st.cycleMs;
    this.cpu.retentiveMBytes = st.retentiveMBytes;
    this.cpu.retentiveCounters = st.retentiveCounters;
    this.cpu.retentiveTimers = st.retentiveTimers;
    this.cpu.randomLocals = st.randomLocals;
    this.bump();
  }

  // ───────────── suscripción (useSyncExternalStore) ─────────────
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  bump() {
    this.rev++;
    this.notify();
  }
  private notify() {
    this.version++;
    for (const l of this.listeners) l();
  }
  private scheduleBump() {
    if (this.dirty) return;
    this.dirty = true;
    queueMicrotask(() => {
      this.dirty = false;
      this.bump();
    });
  }

  // ───────────── programa ─────────────
  /** Recompila el programa. Si es válido se carga en el siguiente límite de ciclo. */
  setProgram(p: Programa) {
    this.programa = p;
    this.cpu.setClockByte(clockByteOf(p)); // el hardware se aplica aunque el código tenga errores
    const pc = compileProgram(p);
    this.compiled = pc;
    if (pc.cp) {
      if (this.cpu.phase === 'IDLE') this.applyCompiled(pc.cp, pc);
      else this.pending = { cp: pc.cp, pc };
      if (this.autoPlay && !this.playing && this.cpu.state === 'RUN' && this.cpu.phase === 'IDLE') this.play();
    }
    this.bump();
  }

  private applyCompiled(cp: CompiledProgram, pc: ProgramCompile) {
    this.cpu.setProgram(cp);
    this.usage = analyzeUsage(cp);
    this.index = buildOriginIndex(cp);
    this.pending = null;
    this.syncBreakpoints();
    // re-resolver símbolos en forzados y señales
    for (const [k, f] of this.forces) {
      try {
        f.reader = makeReader(f.text, pc.symbols);
      } catch {
        this.forces.delete(k);
      }
    }
    this.syncForces();
  }

  /** ¿Hay un programa con errores sin cargar? */
  get hasErrors() {
    return !this.compiled.cp;
  }

  // ───────────── CPU ─────────────
  get running() {
    return this.cpu.state === 'RUN';
  }

  /** Selector RUN/STOP de la CPU. RUN desde STOP = rearranque completo (OB100). */
  setRun(run: boolean) {
    if (run) {
      if (this.cpu.state === 'STOP') {
        if (this.hasErrors) {
          this.message = 'El programa tiene errores: corrígelos antes de pasar a RUN';
          this.bump();
          return;
        }
        this.cpu.restart();
        this.lastStop = null;
        this.analyzer.markers.push({ t: this.cpu.timeMs, label: 'Arranque' });
      }
      this.play();
    } else {
      this.pause();
      this.cpu.stopManual();
      this.analyzer.markers.push({ t: this.cpu.timeMs, label: 'STOP' });
      this.bump();
    }
  }

  mres() {
    this.pause();
    this.cpu.mres();
    this.cpu.stopManual();
    for (const [k, t] of this.inputs) if (t === 'NC') this.setInputBit(k, 1);
    this.analyzer.clear();
    this.trace = [];
    this.lastStop = null;
    this.message = 'Borrado total (MRES): se ha borrado toda la memoria';
    this.bump();
  }

  play() {
    if (this.cpu.state !== 'RUN') return;
    this.autoPlay = true;
    if (this.hasErrors && !this.compiled.cp) {
      // sigue con el último programa válido
    }
    this.playing = true;
    this.lastT = performance.now();
    this.debt = 0;
    if (this.timer === null) {
      this.nextAt = this.lastT;
      this.schedule();
    }
    this.bump();
  }

  pause() {
    this.autoPlay = false;
    this.playing = false;
    this.stopLoop();
    this.bump();
  }

  private stopLoop() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Programa el siguiente despertar a ritmo fijo (LOOP_HZ). */
  private schedule() {
    const now = performance.now();
    this.nextAt += LOOP_MS;
    if (this.nextAt < now - LOOP_MS) this.nextAt = now + LOOP_MS; // muy retrasado: no recuperar a ráfagas
    this.timer = setTimeout(this.tick, Math.max(0, this.nextAt - now));
  }

  setSpeed(n: number) {
    this.speed = n;
    this.bump();
  }

  private tick = () => {
    this.timer = null;
    // ventana minimizada u oculta: el tiempo se para, como antes (salvo que la ventana de señales
    // haga avanzar la simulación con pump())
    if (typeof document !== 'undefined' && document.hidden) {
      if (this.playing && this.cpu.state === 'RUN') this.timer = setTimeout(this.tick, 250);
      return;
    }
    this.lastTick = performance.now();
    this.frame(this.lastTick);
    if (this.playing && this.cpu.state === 'RUN') this.schedule();
  };

  /**
   * Despertar desde otra ventana (las señales en una ventana aparte): si la principal está
   * minimizada u oculta no avanza, y así la simulación sigue al ritmo de la otra.
   */
  pump() {
    if (!this.playing || this.cpu.state !== 'RUN') return;
    const now = performance.now();
    if (now - this.lastTick < LOOP_MS * 3) return; // el bucle de la ventana principal funciona
    if (now - this.lastT < LOOP_MS * 0.5) return;
    this.frame(now);
    if (!this.playing) this.stopLoop();
  }

  /** Ejecuta los ciclos que tocan por el tiempo transcurrido y avisa a los paneles. */
  private frame(now: number) {
    if (!this.playing || this.cpu.state !== 'RUN') {
      this.playing = false;
      this.checkStop();
      this.bump();
      return;
    }
    const state0 = this.cpu.state;
    const limited0 = this.limited;
    const message0 = this.message;
    const stop0 = this.lastStop;
    const cyc = this.cpu.cycleMs;
    let dt = now - this.lastT;
    this.lastT = now;
    if (dt > 250) dt = 250; // ventana en segundo plano
    if (dt < 0) dt = 0;
    this.debt += dt * this.speed;
    let n = Math.floor(this.debt / cyc);
    if (n > 1000) n = 1000;
    this.debt -= n * cyc;
    let limited = false;
    if (this.debt > 5 * cyc) {
      this.debt = 5 * cyc;
      limited = true;
    }
    if (n > 0) {
      const before = this.cpu.cycles;
      // como mucho 8 ms de cada despertar (11 ms): el resto es para la interfaz
      const res = this.cpu.run({ maxCycles: n, deadline: now + 8, breakpoints: true });
      if (this.cpu.cycles - before < n && res === 'done') limited = true;
      if (res === 'break') {
        this.playing = false;
        this.autoPlay = false;
        this.cpu.tracing = false;
        this.message = 'Punto de parada';
      }
      if (this.triggerHit) {
        this.triggerHit = false;
        this.playing = false;
        this.autoPlay = false;
        this.message = 'Disparo del analizador';
      }
    }
    this.limited = limited;
    this.checkStop();
    if (!(this.playing && this.cpu.state === 'RUN')) this.playing = false;
    const changed = this.structural || !this.playing || this.cpu.state !== state0 || this.limited !== limited0 || this.message !== message0 || this.lastStop !== stop0;
    this.structural = false;
    // sin ciclos nuevos no hay nada que avisar
    if (changed) this.bump();
    else if (n > 0) this.notify();
  }

  private triggerHit = false;

  private checkStop() {
    if (this.cpu.state === 'STOP' && this.cpu.stopReason && !this.lastStop) {
      this.lastStop = { reason: this.cpu.stopReason, loc: this.cpu.stopLoc };
      this.analyzer.markers.push({ t: this.cpu.timeMs, label: 'STOP' });
      this.playing = false;
      this.autoPlay = false;
    }
  }

  /** Al terminar cada ciclo: analizador, pulsadores, programa pendiente, captura de traza. */
  private afterCycle() {
    this.analyzer.sample(this.cpu);
    if (this.pendingRelease.size) {
      for (const k of this.pendingRelease) this.releaseNow(k);
      this.pendingRelease.clear();
    }
    if (this.captureArmed && this.cpu.tracing) {
      this.trace = this.cpu.trace.slice();
      this.traceCycle = this.cpu.cycles;
      this.cpu.tracing = false;
      this.captureArmed = false;
      this.structural = true;
    }
    if (this.trigger) {
      const s = this.analyzer.signals.find((x) => x.id === this.trigger!.signalId);
      if (s) {
        const v = AnalyzerBuffer.value(this.cpu, s);
        const prev = this.trigPrev.get(s.id);
        this.trigPrev.set(s.id, v);
        if (prev !== undefined && prev !== v) {
          const e = this.trigger.edge;
          if (e === 'cambia' || (e === 'sube' && v > prev) || (e === 'baja' && v < prev)) this.triggerHit = true;
        }
      }
    }
    if (this.pending) {
      this.applyCompiled(this.pending.cp, this.pending.pc);
      this.structural = true;
    }
  }

  stepCycle() {
    this.pause();
    if (this.cpu.state !== 'RUN') return;
    this.captureArmed = true;
    this.cpu.tracing = this.cpu.phase === 'IDLE' ? true : this.cpu.tracing;
    if (this.cpu.phase === 'IDLE') this.cpu.scan();
    else {
      // termina el ciclo a medias
      while (this.cpu.phase === 'CYCLE' && this.cpu.state === 'RUN') this.cpu.stepInstruction();
      this.trace = this.cpu.trace.slice();
      this.cpu.tracing = false;
      this.captureArmed = false;
    }
    this.checkStop();
    this.message = null;
    this.bump();
  }

  stepInstr() {
    this.pause();
    if (this.cpu.state !== 'RUN') return;
    if (this.cpu.phase === 'IDLE') {
      this.cpu.tracing = true;
      this.captureArmed = true;
    }
    this.cpu.stepInstruction();
    if (this.cpu.tracing) this.trace = this.cpu.trace.slice();
    this.checkStop();
    this.message = null;
    this.bump();
  }

  /** Captura la traza completa del próximo ciclo. */
  captureNextCycle() {
    this.captureArmed = true;
    if (this.cpu.phase === 'IDLE') this.cpu.tracing = true;
    if (!this.playing) this.stepCycle();
  }

  // ───────────── entradas ─────────────
  /** Tipo de la entrada: el configurado con clic derecho o el de Ajustes (pulsador por defecto). */
  inputTipo(key: string): InputTipo {
    return this.inputs.get(key) ?? this.defaultTipo ?? getSettings().entradaClic;
  }

  /** Tipo por defecto de este simulador (el simulador libre usa interruptores); null = el de Ajustes */
  defaultTipo: InputTipo | null = null;

  /** Pone en reposo (0, o 1 si es NC) todas las entradas que no tienen tipo propio, o todas. */
  resetInputs(all = false) {
    const pi = this.cpu.periphIn;
    const keep = new Map<string, number>();
    for (const [k, t] of this.inputs) if (!all && t !== 'NC') keep.set(k, this.getInputBit(k));
    for (let b = 0; b < 128; b++) pi[b] = 0;
    for (const [k, t] of this.inputs) if (t === 'NC') this.setInputBit(k, 1);
    for (const [k, v] of keep) if (v) this.setInputBit(k, 1);
    this.pendingRelease.clear();
    this.pressedAt.clear();
    this.momentaryPrev.clear();
    this.bump();
  }

  /** Quita el tipo propio de la entrada: vuelve al comportamiento general (selector del panel). */
  clearInputTipo(key: string) {
    this.inputs.delete(key);
    this.setInputBit(key, 0);
    this.bump();
  }

  setInputTipo(key: string, t: InputTipo) {
    this.inputs.set(key, t);
    if (t === 'NC') this.setInputBit(key, 1);
    else if (t === 'NA') this.setInputBit(key, 0);
    this.bump();
  }

  private bitPos(key: string): [number, number] {
    const op = parseOperand(key)!;
    return [op.byte!, op.bit!];
  }

  getInputBit(key: string): number {
    const [b, i] = this.bitPos(key);
    return (this.cpu.periphIn[b] >> i) & 1;
  }

  setInputBit(key: string, v: number) {
    const [b, i] = this.bitPos(key);
    if (v) this.cpu.periphIn[b] |= 1 << i;
    else this.cpu.periphIn[b] &= ~(1 << i) & 0xFF;
    this.scheduleBump();
  }

  /** Pulsar según el tipo de la entrada: interruptor/sensor → cambia; NA → 1 mientras se pulsa; NC → 0 mientras se pulsa. */
  press(key: string) {
    const t = this.inputTipo(key);
    if (t === 'INT' || t === 'SENSOR') {
      this.toggleInput(key);
      return;
    }
    this.pressMomentary(key, t === 'NC' ? 0 : 1);
  }

  release(key: string) {
    const t = this.inputTipo(key);
    if (t === 'INT' || t === 'SENSOR') return;
    this.releaseMomentary(key);
  }

  /** Interruptor: cambia la entrada y se queda. */
  toggleInput(key: string) {
    this.setInputBit(key, this.getInputBit(key) ^ 1);
  }

  /** Accionamiento momentáneo (pulsador): la entrada vale `value` mientras se mantiene y luego vuelve a como estaba. */
  pressMomentary(key: string, value = 1) {
    if (!this.momentaryPrev.has(key)) this.momentaryPrev.set(key, this.getInputBit(key));
    this.pendingRelease.delete(key);
    this.setInputBit(key, value);
    this.pressedAt.set(key, this.cpu.cycles);
  }

  /** Suelta un accionamiento momentáneo. El pulso dura al menos un ciclo, también con la CPU en pausa. */
  releaseMomentary(key: string) {
    if (!this.pressedAt.has(key) && !this.momentaryPrev.has(key)) return;
    const at = this.pressedAt.get(key);
    if (at !== undefined && this.cpu.cycles <= at && this.cpu.state === 'RUN') this.pendingRelease.add(key);
    else this.releaseNow(key);
  }

  private momentaryPrev = new Map<string, number>();

  private releaseNow(key: string) {
    const prev = this.momentaryPrev.get(key);
    if (prev !== undefined) {
      this.setInputBit(key, prev);
      this.momentaryPrev.delete(key);
    } else {
      const t = this.inputTipo(key);
      this.setInputBit(key, t === 'NC' ? 1 : 0);
    }
    this.pressedAt.delete(key);
  }

  setWord(text: string, raw: number) {
    const r = makeReader(text, this.compiled.symbols);
    writeRaw(this.cpu, r, raw);
    this.scheduleBump();
  }

  // ───────────── variables y forzado ─────────────
  read(r: Reader): number {
    return readRaw(this.cpu, r);
  }

  modify(text: string, raw: number, valorTZ = false) {
    const r = makeReader(text, this.compiled.symbols, valorTZ);
    writeRaw(this.cpu, r, raw);
    this.bump();
  }

  force(text: string, raw: number, display: string) {
    const r = makeReader(text, this.compiled.symbols);
    if (r.kind !== 'bit' && r.kind !== 'mem') throw new Error('Solo se pueden forzar bits, bytes, palabras y dobles palabras');
    this.forces.set(r.op.text, { text, reader: r, raw, display });
    this.syncForces();
    writeRaw(this.cpu, r, raw);
    this.bump();
  }

  unforce(key: string) {
    this.forces.delete(key);
    this.syncForces();
    this.bump();
  }

  unforceAll() {
    this.forces.clear();
    this.syncForces();
    this.bump();
  }

  private syncForces() {
    this.cpu.forces = [...this.forces.values()].map((f) => ({ key: f.reader.op.text, op: f.reader.op, raw: f.raw }));
  }

  // ───────────── puntos de parada ─────────────
  toggleBreakpoint(key: string) {
    if (this.bpKeys.has(key)) this.bpKeys.delete(key);
    else this.bpKeys.add(key);
    this.syncBreakpoints();
    this.bump();
  }

  clearBreakpoints() {
    this.bpKeys.clear();
    this.syncBreakpoints();
    this.bump();
  }

  private syncBreakpoints() {
    const m = new Map<string, Set<number>>();
    for (const k of this.bpKeys) {
      const locs = this.index.map.get(k);
      if (!locs?.length) continue;
      const first = locs[0];
      const set = m.get(first.block) ?? new Set<number>();
      set.add(first.pc);
      m.set(first.block, set);
    }
    this.cpu.breakpoints = m;
  }

  /** Claves de origen de la próxima instrucción (en pausa a mitad de ciclo). */
  currentOriginKeys(): string[] {
    const loc = this.cpu.currentLoc();
    if (!loc) return [];
    return this.index.rev.get(`${loc.block}|${loc.pc}`) ?? [];
  }

  dispose() {
    this.pause();
    this.listeners.clear();
  }
}
