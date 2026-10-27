// CPU simulada (2 acumuladores). Port fiel de la clase CPU de tools/interprete_referencia.py con una diferencia
// estructural: la ejecución es una máquina de estados reanudable (pila de marcos explícita), para
// poder ejecutar instrucción a instrucción, pararse en puntos de parada y reanudar.
import { CompileError, PLCError } from './errors';
import { type CBlock, type CompiledProgram, type Instr, type Lang, type Origin, compileProgramText } from './compiler';
import { type Area, type Op, type Symbols } from './operands';
import { s5timeDecode } from './constants';
import { bcdDecode, bcdEncode, bitsF32, f32Bits, roundHalfEven, s16, s32, S5_BASES_MS, u16, u32 } from './num';
import { BITLOGIC, CMP, CONV, FLOATFN, JUMPS, NEST_OPEN, SHIFTS, TSTART, WORDLOG } from './mnemonics';
import { T } from '../i18n';

export type TimerMode = 'SI' | 'SV' | 'SE' | 'SS' | 'SA' | null;

export class Timer {
  base = 0;
  value = 0;
  running = false;
  q = 0;
  prevS = 0;
  prevFr = 0;
  accMs = 0;
  mode: TimerMode = null;
  /** Solo para la interfaz: valor con el que se cargó por última vez. */
  initValue = 0;
  reset() {
    this.base = this.value = this.accMs = this.q = this.prevS = this.prevFr = this.initValue = 0;
    this.running = false;
    this.mode = null;
  }
}

export class Counter {
  value = 0;
  prevCu = 0;
  prevCd = 0;
  prevS = 0;
  prevFr = 0;
  reset() {
    this.value = this.prevCu = this.prevCd = this.prevS = this.prevFr = 0;
  }
}

export interface TraceRow {
  bloque: string;
  pc: number;
  linea: number;
  instr: string;
  er_antes: number;
  er: number;
  rlo: number;
  sta: number;
  or: number;
  ov: number;
  os: number;
  cc1: number;
  cc0: number;
  br: number;
  acu1: number;
  acu2: number;
  acu1_int: number;
  acu2_int: number;
  // extras (no se comparan en las pruebas): para explicaciones y la interfaz
  mn: string;
  origin?: Origin;
  rlo_antes: number;
  or_antes: number;
  acu1_antes: number;
  acu2_antes: number;
  /** Valor del operando leído (lógica de bits) */
  opVal?: number;
  /** Entrada sacada de la pila de paréntesis en ')' */
  nest?: { kind: string; rlo: number; orb: number; fc: number };
  jumped?: boolean;
}

interface NestEntry { kind: string; rlo: number; orb: number; fc: number }

export interface Frame {
  name: string;
  blk: CBlock;
  pc: number;
  depth: number;
  L: Uint8Array;
  nest: NestEntry[];
  /** La instrucción en pc es una llamada en curso: su fila de traza se registra al volver. */
  pendCall: boolean;
  pend: PendSnap | null;
}

interface PendSnap { er: number; rlo: number; orb: number; acc1: number; acc2: number }

/** Tabla «Observar»: último estado tras cada instrucción ejecutada (por bloque e índice). */
export class ObserveBlock {
  stamp: Uint32Array;
  count: Uint32Array;
  /** bits 0..8 = palabra de estado tras la instrucción; bit 9 = /ER antes */
  st: Uint16Array;
  acc1: Int32Array;
  acc2: Int32Array;
  constructor(n: number) {
    this.stamp = new Uint32Array(n);
    this.count = new Uint32Array(n);
    this.st = new Uint16Array(n);
    this.acc1 = new Int32Array(n);
    this.acc2 = new Int32Array(n);
  }
}

export interface ForceEntry { key: string; op: Op; raw: number }

export interface CpuOptions {
  cycleMs?: number;
  symbols?: Symbols;
  lang?: Lang;
  mSize?: number;
  instrLimit?: number;
}

export type StepResult =
  | { kind: 'instr' }
  | { kind: 'cycleStart' }
  | { kind: 'cycleEnd' }
  | { kind: 'stop' }
  | { kind: 'idle' };

export type RunResult = 'done' | 'break' | 'stop';

export interface StopLoc { block: string; pc: number; origin?: Origin; line: number; src: string }

const NEXT = -1;
const END = -2;
const CALL = -3;

const PI_SIZE = 128;
const PERIPH_SIZE = 2048;
const L_SIZE = 256;
const DB_SIZE = 1024;

export class CPU {
  static PI_SIZE = PI_SIZE;
  static PERIPH_SIZE = PERIPH_SIZE;
  static L_SIZE = L_SIZE;
  static DB_SIZE = DB_SIZE;

  blocks: Map<string, CBlock>;
  cycleMs: number;
  periphIn = new Uint8Array(PERIPH_SIZE);
  periphOut = new Uint8Array(PERIPH_SIZE);
  PAE = new Uint8Array(PI_SIZE);
  PAA = new Uint8Array(PI_SIZE);
  M: Uint8Array;
  rootL = new Uint8Array(L_SIZE);
  L: Uint8Array;
  dbs = new Map<number, Uint8Array>();
  openDb = 0;
  openDi = 0;
  timers: Timer[] = [];
  counters: Counter[] = [];
  acc1 = 0;
  acc2 = 0;
  ar1 = 0;
  ar2 = 0;
  fc = 0;
  rlo = 0;
  sta = 0;
  orb = 0;
  os = 0;
  ov = 0;
  cc0 = 0;
  cc1 = 0;
  br = 0;
  mcra = false;
  mcrStack: number[] = [];
  state: 'RUN' | 'STOP' = 'RUN';
  stopReason: string | null = null;
  stopLoc: StopLoc | null = null;
  timeMs = 0;
  cycles = 0;
  tracing = false;
  trace: TraceRow[] = [];
  instrLimit: number;
  icount = 0;
  first = true;

  // —— ejecución reanudable ——
  phase: 'IDLE' | 'CYCLE' = 'IDLE';
  frames: Frame[] = [];
  private obQueue: string[] = [];

  // —— extras de la app ——
  /** Sello del ciclo actual (para «Observar»: qué se ejecutó en el último ciclo). */
  stamp = 0;
  observe = false;
  obs = new Map<string, ObserveBlock>();
  forces: ForceEntry[] = [];
  breakpoints = new Map<string, Set<number>>();
  /** Se llama al terminar cada ciclo (analizador lógico). */
  onCycleEnd: (() => void) | null = null;
  /** Instrucciones ejecutadas en el último ciclo completo. */
  lastCycleInstr = 0;
  private skipBreak: { frame: Frame; pc: number } | null = null;
  /** Bytes de marcas remanentes (MB0..MB n-1) y contadores remanentes (Z0..Z n-1). */
  retentiveMBytes = 16;
  retentiveCounters = 8;
  retentiveTimers = 0;
  /** «Modo realista»: datos locales con basura al entrar en un bloque. */
  randomLocals = false;
  /**
   * Marca de ciclo (botón «Hardware» → propiedades de la CPU): byte de marcas cuyos bits
   * oscilan con pulso/pausa 1:1. null = desactivada.
   */
  clockByte: number | null = null;
  private rngState = 0x1234567;

  constructor(program: string | Record<string, string> | CompiledProgram, opts: CpuOptions = {}) {
    const { cycleMs = 10, symbols, lang = 'de', mSize = 2048, instrLimit = 1_000_000 } = opts;
    const cp = typeof program === 'string' || !(program as CompiledProgram).blocks || !((program as CompiledProgram).blocks instanceof Map)
      ? compileProgramText(program as string | Record<string, string>, symbols, lang)
      : (program as CompiledProgram);
    if (!cp.blocks.has('OB1')) throw new CompileError(T.motor.faltaOb1);
    this.blocks = cp.blocks;
    this.cycleMs = cycleMs;
    this.M = new Uint8Array(mSize);
    this.L = this.rootL;
    for (let i = 0; i < 256; i++) {
      this.timers.push(new Timer());
      this.counters.push(new Counter());
    }
    this.instrLimit = instrLimit;
    this.rebuildObserve();
  }

  // ───────────── programa ─────────────
  /** Cambia el programa (solo entre ciclos). La memoria, T y Z se conservan. */
  setProgram(cp: CompiledProgram) {
    if (this.phase !== 'IDLE') throw new Error(T.motor.cargarEnCiclo);
    if (!cp.blocks.has('OB1')) throw new CompileError(T.motor.faltaOb1);
    this.blocks = cp.blocks;
    this.rebuildObserve();
  }

  rebuildObserve() {
    this.obs.clear();
    for (const [name, b] of this.blocks) this.obs.set(name, new ObserveBlock(b.instrs.length));
  }

  // ───────────── ciclo ─────────────
  /** Un ciclo completo: temporizadores → PAE → OB100/OB1 → PAA. Si hay un ciclo a medias, lo termina. */
  scan(): void {
    if (this.state !== 'RUN') return;
    try {
      if (this.phase === 'IDLE') this.beginCycle();
      while (this.phase === 'CYCLE') this.execOne();
    } catch (e) {
      this.handleError(e);
    }
  }

  /** Ejecuta una instrucción. Si no hay ciclo en curso, empieza uno (sin ejecutar nada todavía). */
  stepInstruction(): StepResult {
    if (this.state !== 'RUN') return { kind: 'stop' };
    try {
      if (this.phase === 'IDLE') {
        this.beginCycle();
        return this.isIdle() ? { kind: 'cycleEnd' } : { kind: 'cycleStart' };
      }
      this.execOne();
    } catch (e) {
      this.handleError(e);
      return { kind: 'stop' };
    }
    return this.isIdle() ? { kind: 'cycleEnd' } : { kind: 'instr' };
  }

  /**
   * Ejecuta como mucho `maxCycles` ciclos (terminando antes el ciclo a medias) o hasta el plazo.
   * Con `breakpoints` se para antes de una instrucción marcada.
   */
  run(opts: { maxCycles: number; deadline?: number; breakpoints?: boolean; now?: () => number }): RunResult {
    if (this.state !== 'RUN') return 'stop';
    const { maxCycles, deadline, breakpoints = false } = opts;
    const now = opts.now ?? (() => performance.now());
    const useBp = breakpoints && this.breakpoints.size > 0;
    let done = 0;
    try {
      for (;;) {
        if (this.phase === 'IDLE') {
          if (done >= maxCycles) return 'done';
          if (deadline !== undefined && done > 0 && now() > deadline) return 'done';
          this.beginCycle();
          if (this.isIdle()) {
            done++;
            continue;
          }
        }
        if (useBp) {
          const f = this.frames[this.frames.length - 1];
          const set = this.breakpoints.get(f.name);
          if (set && set.has(f.pc) && !(this.skipBreak && this.skipBreak.frame === f && this.skipBreak.pc === f.pc)) {
            this.skipBreak = { frame: f, pc: f.pc };
            return 'break';
          }
        }
        this.skipBreak = null;
        this.execOne();
        if (this.isIdle()) done++;
      }
    } catch (e) {
      this.handleError(e);
      return 'stop';
    }
  }

  /** (función para que TypeScript no estreche el tipo de `phase` tras beginCycle) */
  isIdle(): boolean {
    return this.phase === 'IDLE';
  }

  /** Posición de la próxima instrucción (en pausa a mitad de ciclo). */
  currentLoc(): { block: string; pc: number; instr: Instr } | null {
    if (this.phase !== 'CYCLE' || !this.frames.length) return null;
    const f = this.frames[this.frames.length - 1];
    const instr = f.blk.instrs[f.pc];
    return instr ? { block: f.name, pc: f.pc, instr } : null;
  }

  private beginCycle() {
    this.updateTimers(this.cycleMs);
    this.timeMs += this.cycleMs;
    this.cycles += 1;
    if (this.clockByte !== null) this.updateClockByte();
    this.PAE.set(this.periphIn.subarray(0, PI_SIZE));
    if (this.forces.length) this.applyForces(false);
    this.icount = 0;
    this.stamp = (this.stamp + 1) >>> 0;
    if (this.tracing) this.trace = [];
    this.phase = 'CYCLE';
    this.obQueue = [];
    if (this.first) {
      this.first = false;
      if (this.blocks.has('OB100')) this.obQueue.push('OB100');
    }
    this.obQueue.push('OB1');
    this.enterBlock(this.obQueue.shift()!, true, 0);
    this.settle();
  }

  private endCycle() {
    if (this.forces.length) this.applyForces(true);
    this.periphOut.set(this.PAA, 0);
    this.phase = 'IDLE';
    this.lastCycleInstr = this.icount;
    if (this.onCycleEnd) this.onCycleEnd();
  }

  private handleError(e: unknown) {
    if (!(e instanceof PLCError)) throw e;
    const f = this.frames[this.frames.length - 1];
    if (f) {
      const ins = f.blk.instrs[Math.min(f.pc, f.blk.instrs.length - 1)];
      this.stopLoc = { block: f.name, pc: f.pc, origin: ins?.origin, line: ins?.line ?? 0, src: ins?.src ?? '' };
    } else this.stopLoc = null;
    this.state = 'STOP';
    this.stopReason = T.motor.obNoCargado(e.message, e.ob);
    this.PAA.fill(0);
    this.periphOut.fill(0);
    this.frames = [];
    this.L = this.rootL;
    this.phase = 'IDLE';
  }

  /**
   * Activa, cambia o quita la marca de ciclo. El byte que deja de ser marca de ciclo se pone a 0:
   * lo escribía la CPU, no el programa, y si no se quedaría con el último valor congelado.
   */
  setClockByte(b: number | null) {
    const antes = this.clockByte;
    if (antes === b) return;
    if (antes !== null && antes >= 0 && antes < this.M.length) this.M[antes] = 0;
    this.clockByte = b;
    if (b !== null) this.updateClockByte();
  }

  /** Escribe el byte de marcas de ciclo según el tiempo simulado (bit = 1 en la segunda mitad de cada periodo). */
  updateClockByte() {
    const b = this.clockByte;
    if (b === null || b < 0 || b >= this.M.length) return;
    let v = 0;
    for (let i = 0; i < 8; i++) if (Math.floor(this.timeMs / (CLOCK_PERIODS_MS[i] / 2)) % 2 === 1) v |= 1 << i;
    this.M[b] = v;
  }

  // _update_timers
  updateTimers(dt: number) {
    for (const t of this.timers) {
      if (!t.running) continue;
      t.accMs += dt;
      const b = S5_BASES_MS[t.base];
      while (t.value > 0 && t.accMs >= b) {
        t.value -= 1;
        t.accMs -= b;
      }
      if (t.value === 0) {
        t.running = false;
        t.accMs = 0;
        t.q = t.mode === 'SE' || t.mode === 'SS' ? 1 : 0;
      }
    }
  }

  // _run_block (entrada): crea el marco del bloque
  private enterBlock(name: string, isOb: boolean, depth: number) {
    const blk = this.blocks.get(name);
    if (!blk) throw new PLCError(T.motor.bloqueNoExiste(name));
    if (depth > 16) throw new PLCError(T.motor.pilaBloques, 121);
    const L = new Uint8Array(L_SIZE);
    if (this.randomLocals) for (let i = 0; i < L_SIZE; i++) L[i] = this.rand() & 0xFF;
    this.L = L;
    if (isOb) {
      // Simplificación documentada: al empezar cada OB la palabra de estado y los ACU valen 0.
      this.fc = this.rlo = this.sta = this.orb = this.os = this.ov = this.cc0 = this.cc1 = this.br = 0;
      this.acc1 = this.acc2 = 0;
      this.mcra = false;
      this.mcrStack = [];
    } else {
      this.fc = this.orb = this.os = 0;
    }
    this.frames.push({ name, blk, pc: 0, depth, L, nest: [], pendCall: false, pend: null });
  }

  private rand(): number {
    let x = this.rngState;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rngState = x >>> 0;
    return this.rngState;
  }

  /** Cierra los bloques terminados, registra las llamadas pendientes y pasa al siguiente OB. */
  private settle() {
    while (this.frames.length) {
      const f = this.frames[this.frames.length - 1];
      if (f.pc < f.blk.instrs.length) return;
      // fin de bloque
      this.os = 0; // el fin de bloque borra OS
      this.fc = this.orb = 0;
      this.frames.pop();
      if (this.frames.length) {
        const c = this.frames[this.frames.length - 1];
        this.L = c.L;
        if (c.pendCall) {
          c.pendCall = false;
          this.record(c, c.pc, c.pend!, undefined);
          c.pend = null;
          c.pc += 1;
        }
        continue;
      }
      this.L = this.rootL;
      if (this.obQueue.length) {
        this.enterBlock(this.obQueue.shift()!, true, 0);
        continue;
      }
      this.endCycle();
      return;
    }
  }

  private extra: { opVal?: number; nest?: NestEntry; jumped?: boolean } = {};

  private execOne() {
    this.icount += 1;
    if (this.icount > this.instrLimit) throw new PLCError(T.motor.cicloExcedido, 80);
    const f = this.frames[this.frames.length - 1];
    const ins = f.blk.instrs[f.pc];
    const snap: PendSnap = { er: this.fc, rlo: this.rlo, orb: this.orb, acc1: this.acc1, acc2: this.acc2 };
    if (this.tracing) this.extra = {};
    const r = this.exec(ins, f);
    if (r === CALL) {
      f.pendCall = true;
      f.pend = snap;
      this.enterBlock(`${ins.op!.name}${ins.op!.n}`, false, f.depth + 1);
      this.settle();
      return;
    }
    this.record(f, f.pc, snap, ins);
    f.pc = r === END ? f.blk.instrs.length : r === NEXT ? f.pc + 1 : r;
    this.settle();
  }

  private record(f: Frame, pc: number, snap: PendSnap, insIn: Instr | undefined) {
    if (this.observe) {
      const ob = this.obs.get(f.name);
      if (ob && pc < ob.stamp.length) {
        if (ob.stamp[pc] !== this.stamp) {
          ob.stamp[pc] = this.stamp;
          ob.count[pc] = 1;
        } else ob.count[pc] += 1;
        ob.st[pc] = this.stw() | (snap.er << 9);
        ob.acc1[pc] = this.acc1 | 0;
        ob.acc2[pc] = this.acc2 | 0;
      }
    }
    if (this.tracing) {
      const ins = insIn ?? f.blk.instrs[pc];
      this.trace.push({
        bloque: f.name, pc, linea: ins.line, instr: ins.src,
        er_antes: snap.er, er: this.fc, rlo: this.rlo, sta: this.sta, or: this.orb,
        ov: this.ov, os: this.os, cc1: this.cc1, cc0: this.cc0, br: this.br,
        acu1: s32(this.acc1), acu2: s32(this.acc2), acu1_int: s16(this.acc1), acu2_int: s16(this.acc2),
        mn: ins.mn, origin: ins.origin, rlo_antes: snap.rlo, or_antes: snap.orb,
        acu1_antes: s32(snap.acc1), acu2_antes: s32(snap.acc2),
        opVal: insIn ? this.extra.opVal : undefined, nest: insIn ? this.extra.nest : undefined, jumped: insIn ? this.extra.jumped : undefined,
      });
    }
  }

  // ───────────── memoria ─────────────
  db(n: number): Uint8Array {
    if (!n) throw new PLCError(T.motor.sinDb);
    let d = this.dbs.get(n);
    if (!d) {
      d = new Uint8Array(DB_SIZE);
      this.dbs.set(n, d);
    }
    return d;
  }

  buf(area: Area, db: number | undefined): Uint8Array {
    switch (area) {
      case 'E': return this.PAE;
      case 'A': return this.PAA;
      case 'M': return this.M;
      case 'L': return this.L;
      case 'PE': return this.periphIn;
      case 'PA': return this.periphOut;
      case 'DB': return this.db(db || this.openDb);
      case 'DI': return this.db(db || this.openDi);
    }
    throw new PLCError(T.motor.areaDesconocida(area));
  }

  // resultado de _resolve (sin reservar memoria)
  private rByte = 0;
  private rBit = 0;

  private resolve(op: Op) {
    if (!op.ind) {
      if (op.area === 'DB' && op.db) this.openDb = op.db; // una dirección completa abre el DB
      this.rByte = op.byte!;
      this.rBit = op.bit ?? 0;
      return;
    }
    let ptr: number;
    if (op.ind.k === 'mem') ptr = this.rmem(op.ind.ptr);
    else {
      const ar = op.ind.reg === 1 ? this.ar1 : this.ar2;
      ptr = (ar & 0x00FFFFFF) + op.ind.off;
    }
    const byte = Math.floor(ptr / 8) & 0xFFFF;
    const bit = ptr & 7;
    if (op.kind === 'mem' && bit !== 0) throw new PLCError(T.motor.punteroBit0);
    this.rByte = byte;
    this.rBit = bit;
  }

  private check(buf: Uint8Array, byte: number, size: number, area: string) {
    if (byte < 0 || byte + size > buf.length) throw new PLCError(T.motor.fueraDeRango(area, byte));
  }

  rbit(op: Op): number {
    this.resolve(op);
    const byte = this.rByte;
    const bit = this.rBit;
    const b = this.buf(op.area!, op.db);
    this.check(b, byte, 1, op.area!);
    return (b[byte] >> bit) & 1;
  }

  wbit(op: Op, v: number) {
    this.resolve(op);
    const byte = this.rByte;
    const bit = this.rBit;
    const b = this.buf(op.area!, op.db);
    this.check(b, byte, 1, op.area!);
    if (v) b[byte] |= 1 << bit;
    else b[byte] &= ~(1 << bit) & 0xFF;
  }

  rmem(op: Op): number {
    this.resolve(op);
    const byte = this.rByte;
    const b = this.buf(op.area!, op.db);
    const size = op.size!;
    this.check(b, byte, size, op.area!);
    if (size === 1) return b[byte];
    if (size === 2) return (b[byte] << 8) | b[byte + 1];
    return ((b[byte] << 24) | (b[byte + 1] << 16) | (b[byte + 2] << 8) | b[byte + 3]) >>> 0;
  }

  wmem(op: Op, value: number) {
    this.resolve(op);
    const byte = this.rByte;
    const b = this.buf(op.area!, op.db);
    const size = op.size!;
    this.check(b, byte, size, op.area!);
    writeBE(b, byte, size, value);
    if (op.area === 'PA' && byte + size <= PI_SIZE) writeBE(this.PAA, byte, size, value); // T PAW actualiza también la PAA
  }

  bitval(op: Op): number {
    switch (op.kind) {
      case 'bit': return this.rbit(op);
      case 'timer': return this.timers[op.n!].q;
      case 'counter': return this.counters[op.n!].value > 0 ? 1 : 0;
      case 'status': return this.statusVal(op.name!);
    }
    throw new PLCError(T.motor.noBooleano(op.text));
  }

  statusVal(name: string): number {
    const c1 = this.cc1;
    const c0 = this.cc0;
    switch (name) {
      case 'OV': return this.ov;
      case 'OS': return this.os;
      case 'BIE': return this.br;
      case '==0': return c1 === 0 && c0 === 0 ? 1 : 0;
      case '<>0': return c1 !== c0 ? 1 : 0;
      case '>0': return c1 === 1 && c0 === 0 ? 1 : 0;
      case '<0': return c1 === 0 && c0 === 1 ? 1 : 0;
      case '>=0': return c0 === 0 ? 1 : 0;
      case '<=0': return c1 === 0 ? 1 : 0;
      case 'UO': return c1 === 1 && c0 === 1 ? 1 : 0;
    }
    return 0;
  }

  stw(): number {
    return this.fc | (this.rlo << 1) | (this.sta << 2) | (this.orb << 3) | (this.os << 4) |
      (this.ov << 5) | (this.cc0 << 6) | (this.cc1 << 7) | (this.br << 8);
  }

  setStw(v: number) {
    this.fc = v & 1; this.rlo = (v >> 1) & 1; this.sta = (v >> 2) & 1; this.orb = (v >> 3) & 1;
    this.os = (v >> 4) & 1; this.ov = (v >> 5) & 1; this.cc0 = (v >> 6) & 1; this.cc1 = (v >> 7) & 1; this.br = (v >> 8) & 1;
  }

  loadVal(op: Op): number {
    switch (op.kind) {
      case 'const': return op.value!;
      case 'mem': return this.rmem(op);
      case 'timer': return this.timers[op.n!].value;
      case 'counter': return this.counters[op.n!].value;
      case 'stw': return this.stw();
      case 'dbreg': {
        const n = op.name!.startsWith('DB') ? this.openDb : this.openDi;
        if (op.name!.endsWith('NO')) return n;
        const d = this.dbs.get(n);
        return d ? d.length : 0;
      }
    }
    throw new PLCError(T.motor.noCargar(op.text));
  }

  private mcrOk(): boolean {
    if (!this.mcra) return true;
    for (const v of this.mcrStack) if (!v) return false;
    return true;
  }

  private ccFrom(v: number) {
    if (v === 0) { this.cc1 = 0; this.cc0 = 0; } else if (v < 0) { this.cc1 = 0; this.cc0 = 1; } else { this.cc1 = 1; this.cc0 = 0; }
  }

  // ───────────── lógica de bits ─────────────
  // _logic: U/UN/O/ON/X/XN. `v` es el valor real del operando.
  private logic(base: string, neg: boolean, v: number) {
    const x = neg ? v ^ 1 : v;
    let r: number;
    if (base === 'U') {
      r = this.fc ? this.rlo & x : x;
      r |= this.orb; // si un grupo O anterior ya dio 1, el resultado es 1
    } else if (base === 'O') {
      r = (this.fc ? this.rlo | x : x) | this.orb;
      this.orb = 0;
    } else {
      r = (this.fc ? this.rlo ^ x : x) | this.orb;
      this.orb = 0;
    }
    this.rlo = r;
    this.fc = 1;
    this.sta = v;
  }

  private endChain() {
    this.fc = 0;
    this.orb = 0;
  }

  // ───────────── temporizadores ─────────────
  // _timer_start
  private timerStart(n: number, mode: TimerMode) {
    const t = this.timers[n];
    const rlo = this.rlo;
    const edge = rlo && !t.prevS;
    const fall = !rlo && t.prevS;
    t.prevS = rlo;
    const load = () => {
      const [base, value] = s5timeDecode(this.acc1 & 0xFFFF);
      t.base = base;
      t.value = value;
      t.initValue = value;
      t.accMs = 0;
      t.running = true;
      t.mode = mode;
    };
    if (mode === 'SI') { // impulso
      if (edge) { load(); t.q = 1; } else if (!rlo) { t.running = false; t.q = 0; }
    } else if (mode === 'SV') { // impulso prolongado (se redispara)
      if (edge) { load(); t.q = 1; }
    } else if (mode === 'SE') { // retardo a la conexión
      if (edge) { load(); t.q = 0; } else if (!rlo) { t.running = false; t.q = 0; }
    } else if (mode === 'SS') { // retardo a la conexión con memoria
      if (edge) { load(); t.q = 0; }
    } else if (mode === 'SA') { // retardo a la desconexión
      if (rlo) { t.running = false; t.q = 1; t.mode = 'SA'; } else if (fall) { load(); t.q = 1; }
    }
  }

  // ───────────── ejecución de una instrucción (_exec) ─────────────
  private exec(ins: Instr, f: Frame): number {
    const mn = ins.mn;
    const op = ins.op;

    // --- lógica de bits ---
    if (BITLOGIC.has(mn)) {
      const v = this.bitval(op!);
      if (this.tracing) this.extra.opVal = v;
      this.logic(mn[0], mn.endsWith('N'), v);
      return NEXT;
    }
    switch (mn) {
      case 'O0':
        if (this.fc) this.orb = this.rlo;
        this.fc = 0;
        this.sta = 1;
        return NEXT;
      case ')': {
        const nest = f.nest;
        if (!nest.length) throw new PLCError(T.motor.cierraSinAbrir);
        const e = nest.pop()!;
        if (this.tracing) this.extra.nest = e;
        const inner = this.rlo;
        this.rlo = e.rlo;
        this.orb = e.orb;
        this.fc = e.fc;
        this.logic(e.kind[0], e.kind.endsWith('N'), inner);
        this.sta = 1;
        return NEXT;
      }
      case '=': {
        const v = this.mcrOk() ? this.rlo : 0;
        this.wbit(op!, v);
        this.endChain();
        this.sta = v;
        return NEXT;
      }
      case 'S':
      case 'R': {
        if (op!.kind === 'bit') {
          if (this.rlo && this.mcrOk()) this.wbit(op!, mn === 'S' ? 1 : 0);
          this.sta = this.rbit(op!);
        } else if (op!.kind === 'timer') { // R T n
          if (this.rlo) {
            const t = this.timers[op!.n!];
            t.running = false; t.value = 0; t.base = 0; t.q = 0; t.accMs = 0;
          }
          this.sta = this.rlo;
        } else { // S Z n / R Z n
          const c = this.counters[op!.n!];
          if (mn === 'S') {
            if (this.rlo && !c.prevS) c.value = bcdDecode(this.acc1 & 0x0FFF, 3);
            c.prevS = this.rlo;
          } else if (this.rlo) c.value = 0;
          this.sta = this.rlo;
        }
        this.endChain();
        return NEXT;
      }
      case 'NOT':
        this.rlo ^= 1;
        this.orb = 0;
        this.sta = 1;
        return NEXT;
      case 'SET':
        this.rlo = 1; this.sta = 1;
        this.endChain();
        return NEXT;
      case 'CLR':
        this.rlo = 0; this.sta = 0;
        this.endChain();
        return NEXT;
      case 'SAVE':
        this.br = this.rlo;
        return NEXT;
      case 'FP':
      case 'FN': {
        const prev = this.rbit(op!);
        const cur = this.rlo;
        this.wbit(op!, cur);
        this.rlo = mn === 'FP' ? cur & (prev ^ 1) : (cur ^ 1) & prev;
        this.fc = 1; this.orb = 0; this.sta = cur;
        if (this.tracing) this.extra.opVal = prev;
        return NEXT;
      }
    }
    if (NEST_OPEN.has(mn)) {
      if (f.nest.length >= 7) throw new PLCError(T.motor.pilaAnidamiento);
      f.nest.push({ kind: mn.slice(0, -1), rlo: this.rlo, orb: this.orb, fc: this.fc });
      this.fc = 0; this.orb = 0; this.sta = 1;
      return NEXT;
    }

    // --- temporizadores y contadores ---
    if (TSTART.has(mn)) {
      this.timerStart(op!.n!, mn as TimerMode);
      this.sta = this.rlo;
      this.endChain();
      return NEXT;
    }
    switch (mn) {
      case 'FR': {
        if (op!.kind === 'timer') {
          const t = this.timers[op!.n!];
          if (this.rlo && !t.prevFr) t.prevS = 0;
          t.prevFr = this.rlo;
        } else {
          const c = this.counters[op!.n!];
          if (this.rlo && !c.prevFr) c.prevCu = c.prevCd = c.prevS = 0;
          c.prevFr = this.rlo;
        }
        this.endChain();
        return NEXT;
      }
      case 'ZV':
      case 'ZR': {
        const c = this.counters[op!.n!];
        if (mn === 'ZV') {
          if (this.rlo && !c.prevCu && c.value < 999) c.value += 1;
          c.prevCu = this.rlo;
        } else {
          if (this.rlo && !c.prevCd && c.value > 0) c.value -= 1;
          c.prevCd = this.rlo;
        }
        this.sta = this.rlo;
        this.endChain();
        return NEXT;
      }

      // --- carga y transferencia ---
      case 'L': {
        const v = this.loadVal(op!);
        this.acc2 = this.acc1;
        this.acc1 = u32(v);
        return NEXT;
      }
      case 'LC': {
        let v: number;
        if (op!.kind === 'timer') {
          const t = this.timers[op!.n!];
          v = ((t.base << 12) | bcdEncode(t.value, 3)) >>> 0;
        } else v = bcdEncode(this.counters[op!.n!].value, 3);
        this.acc2 = this.acc1;
        this.acc1 = v;
        return NEXT;
      }
      case 'T':
        if (op!.kind === 'stw') this.setStw(this.acc1);
        else this.wmem(op!, this.mcrOk() ? this.acc1 : 0);
        return NEXT;
      case 'LAR1':
      case 'LAR2': {
        let v: number;
        if (op === null) v = this.acc1;
        else if (op.kind === 'ar') v = op.n === 2 ? this.ar2 : this.ar1;
        else v = this.loadVal(op);
        if (mn === 'LAR1') this.ar1 = u32(v);
        else this.ar2 = u32(v);
        return NEXT;
      }
      case 'TAR1':
      case 'TAR2': {
        const v = mn === 'TAR1' ? this.ar1 : this.ar2;
        if (op === null) {
          this.acc2 = this.acc1;
          this.acc1 = v;
        } else if (op.kind === 'ar') this.ar2 = v;
        else this.wmem(op, v);
        return NEXT;
      }
      case '+AR1':
      case '+AR2': {
        const add = op !== null ? op.value! : s16(this.acc1);
        if (mn === '+AR1') this.ar1 = u32(this.ar1 + add);
        else this.ar2 = u32(this.ar2 + add);
        return NEXT;
      }

      // --- acumuladores ---
      case 'TAK': {
        const a = this.acc1;
        this.acc1 = this.acc2;
        this.acc2 = a;
        return NEXT;
      }
      case 'PUSH':
        this.acc2 = this.acc1;
        return NEXT;
      case 'POP':
        this.acc1 = this.acc2;
        return NEXT;
      case 'INC':
      case 'DEC': {
        let ll = this.acc1 & 0xFF;
        ll = mn === 'INC' ? (ll + op!.value!) & 0xFF : (ll - op!.value!) & 0xFF;
        this.acc1 = ((this.acc1 & 0xFFFFFF00) | ll) >>> 0;
        return NEXT;
      }
      case '+': {
        if (op!.ctype === 'INT') {
          const low = u16(s16(this.acc1) + s16(op!.value!));
          this.acc1 = ((this.acc1 & 0xFFFF0000) | low) >>> 0;
        } else this.acc1 = u32(this.acc1 + s32(op!.value!));
        return NEXT;
      }

      // --- aritmética ---
      case '+I':
      case '-I': {
        const a = s16(this.acc2);
        const b = s16(this.acc1);
        const r = mn === '+I' ? a + b : a - b;
        const w = s16(r);
        this.acc1 = ((this.acc1 & 0xFFFF0000) | u16(w)) >>> 0;
        this.ccFrom(w);
        this.ov = r !== w ? 1 : 0;
        this.os |= this.ov;
        return NEXT;
      }
      case '*I': {
        const r = s16(this.acc2) * s16(this.acc1);
        this.acc1 = u32(r);
        this.ccFrom(r);
        this.ov = r >= -32768 && r <= 32767 ? 0 : 1;
        this.os |= this.ov;
        return NEXT;
      }
      case '/I': {
        const a = s16(this.acc2);
        const b = s16(this.acc1);
        if (b === 0) {
          this.cc1 = this.cc0 = 1;
          this.ov = this.os = 1;
          return NEXT;
        }
        const q = Math.trunc(a / b);
        const rem = a - q * b;
        const w = s16(q);
        this.acc1 = ((u16(rem) << 16) | u16(w)) >>> 0;
        this.ccFrom(w);
        this.ov = q !== w ? 1 : 0;
        this.os |= this.ov;
        return NEXT;
      }
      case '+D':
      case '-D':
      case '*D': {
        const a = s32(this.acc2);
        const b = s32(this.acc1);
        let r: number;
        let w: number;
        if (mn === '*D') {
          r = a * b; // puede no ser exacto por encima de 2^53, pero signo y «cabe/no cabe» sí lo son
          w = Math.imul(a, b);
        } else {
          r = mn === '+D' ? a + b : a - b;
          w = r | 0;
        }
        this.acc1 = u32(w);
        this.ccFrom(mn === '*D' ? r : w);
        this.ov = r !== w ? 1 : 0;
        this.os |= this.ov;
        return NEXT;
      }
      case '/D':
      case 'MOD': {
        const a = s32(this.acc2);
        const b = s32(this.acc1);
        if (b === 0) {
          this.cc1 = this.cc0 = 1;
          this.ov = this.os = 1;
          return NEXT;
        }
        const q = Math.trunc(a / b);
        const res = mn === '/D' ? q : a - q * b;
        const w = res | 0;
        this.acc1 = u32(w);
        this.ccFrom(w);
        this.ov = res !== w ? 1 : 0;
        this.os |= this.ov;
        return NEXT;
      }
      case '+R':
      case '-R':
      case '*R':
      case '/R': {
        const a = bitsF32(this.acc2);
        const b = bitsF32(this.acc1);
        const r = mn === '+R' ? a + b : mn === '-R' ? a - b : mn === '*R' ? a * b : a / b;
        // NaN como en la referencia: /R entre 0 con a = 0 o NaN da el NaN canónico; si no, gana el primer NaN de entrada
        const nan = mn === '/R' && b === 0 ? CANON_NAN : nanOf(this.acc2, this.acc1);
        this.setReal(r, nan);
        return NEXT;
      }
    }
    if (FLOATFN.has(mn)) {
      const x = bitsF32(this.acc1);
      if (mn === 'ABS') {
        this.acc1 = (this.acc1 & 0x7FFFFFFF) >>> 0;
        return NEXT;
      }
      let r: number;
      switch (mn) {
        case 'SQR': r = x * x; break;
        case 'SQRT': r = Math.sqrt(x); break;
        case 'EXP': r = Math.exp(x); break;
        case 'LN': r = x > 0 ? Math.log(x) : x === 0 ? -Infinity : NaN; break;
        case 'SIN': r = Math.sin(x); break;
        case 'COS': r = Math.cos(x); break;
        case 'TAN': r = Math.tan(x); break;
        case 'ASIN': r = Math.asin(x); break;
        case 'ACOS': r = Math.acos(x); break;
        default: r = Math.atan(x); break;
      }
      let nan = CANON_NAN;
      if (isNanBits(this.acc1) && mn !== 'LN') {
        nan = (this.acc1 | 0x00400000) >>> 0;
        if (mn === 'COS') nan = (nan & 0x7FFFFFFF) >>> 0; // libm de la referencia (Apple Silicon)
        else if (mn === 'ACOS') nan = (nan ^ 0x80000000) >>> 0;
      }
      this.setReal(r, nan);
      return NEXT;
    }

    // --- comparación ---
    if (CMP.has(mn)) {
      const typ = mn[mn.length - 1];
      const rel = mn.slice(0, -1);
      let a: number;
      let b: number;
      if (typ === 'I') { a = s16(this.acc2); b = s16(this.acc1); } else if (typ === 'D') { a = s32(this.acc2); b = s32(this.acc1); } else {
        a = bitsF32(this.acc2); b = bitsF32(this.acc1);
      }
      let res: number;
      if (typ === 'R' && (Number.isNaN(a) || Number.isNaN(b))) {
        res = 0;
        this.cc1 = this.cc0 = 1;
        this.ov = this.os = 1;
      } else {
        switch (rel) {
          case '==': res = a === b ? 1 : 0; break;
          case '<>': res = a !== b ? 1 : 0; break;
          case '>': res = a > b ? 1 : 0; break;
          case '<': res = a < b ? 1 : 0; break;
          case '>=': res = a >= b ? 1 : 0; break;
          default: res = a <= b ? 1 : 0; break;
        }
        if (a > b) { this.cc1 = 1; this.cc0 = 0; } else if (a < b) { this.cc1 = 0; this.cc0 = 1; } else { this.cc1 = 0; this.cc0 = 0; }
        this.ov = 0;
      }
      this.rlo = res; this.fc = 1; this.orb = 0; this.sta = res;
      return NEXT;
    }

    // --- conversión ---
    if (CONV.has(mn)) {
      this.conv(mn);
      return NEXT;
    }

    // --- lógica de palabras ---
    if (WORDLOG.has(mn)) {
      const other = op !== null ? op.value! : this.acc2;
      const k = mn[0];
      let res: number;
      if (mn.endsWith('W')) {
        const x = this.acc1 & 0xFFFF;
        const y = other & 0xFFFF;
        res = k === 'U' ? x & y : k === 'O' ? x | y : x ^ y;
        this.acc1 = ((this.acc1 & 0xFFFF0000) | res) >>> 0;
      } else {
        const x = this.acc1;
        res = (k === 'U' ? x & other : k === 'O' ? x | other : x ^ other) >>> 0;
        this.acc1 = res;
      }
      this.cc1 = res !== 0 ? 1 : 0;
      this.cc0 = 0;
      this.ov = 0;
      return NEXT;
    }

    // --- desplazamiento y rotación ---
    if (SHIFTS.has(mn)) {
      const n = op !== null ? op.value! : this.acc2 & 0xFF;
      if (n === 0) return NEXT;
      let last: number;
      let res: number;
      if (mn === 'SLW' || mn === 'SRW' || mn === 'SSI') {
        const low = this.acc1 & 0xFFFF;
        if (mn === 'SLW') {
          last = n <= 16 ? (low >> (16 - n)) & 1 : 0;
          res = n < 16 ? (low << n) & 0xFFFF : 0;
        } else if (mn === 'SRW') {
          last = n <= 16 ? (low >> (n - 1)) & 1 : 0;
          res = n < 16 ? low >> n : 0;
        } else {
          const v = s16(low);
          last = (v >> Math.min(n - 1, 15)) & 1;
          res = u16(v >> Math.min(n, 15));
        }
        this.acc1 = ((this.acc1 & 0xFFFF0000) | res) >>> 0;
      } else {
        const a = this.acc1;
        if (mn === 'SLD') {
          last = n <= 32 ? (a >>> (32 - n)) & 1 : 0;
          res = n < 32 ? (a << n) >>> 0 : 0;
        } else if (mn === 'SRD') {
          last = n <= 32 ? (a >>> (n - 1)) & 1 : 0;
          res = n < 32 ? a >>> n : 0;
        } else if (mn === 'SSD') {
          const v = s32(a);
          last = (v >> Math.min(n - 1, 31)) & 1;
          res = u32(v >> Math.min(n, 31));
        } else if (mn === 'RLD') {
          const k = n % 32;
          res = k ? ((a << k) | (a >>> (32 - k))) >>> 0 : a;
          last = res & 1;
        } else {
          const k = n % 32;
          res = k ? ((a >>> k) | (a << (32 - k))) >>> 0 : a;
          last = (res >>> 31) & 1;
        }
        this.acc1 = res;
      }
      this.cc1 = last;
      this.cc0 = 0;
      this.ov = 0;
      return NEXT;
    }
    if (mn === 'RLDA' || mn === 'RRDA') {
      const a = this.acc1;
      const old = this.cc1;
      if (mn === 'RLDA') {
        this.cc1 = (a >>> 31) & 1;
        this.acc1 = ((a << 1) | old) >>> 0;
      } else {
        this.cc1 = a & 1;
        this.acc1 = ((a >>> 1) | (old << 31)) >>> 0;
      }
      this.cc0 = this.ov = 0;
      return NEXT;
    }

    // --- saltos ---
    if (JUMPS.has(mn)) {
      const tgt = ins.target;
      let cond: boolean;
      switch (mn) {
        case 'SPA':
          if (this.tracing) this.extra.jumped = true;
          return tgt;
        case 'SPB':
        case 'SPBN':
        case 'SPBB':
        case 'SPBNB':
          cond = (mn === 'SPB' || mn === 'SPBB' ? this.rlo : this.rlo ^ 1) === 1;
          if (mn === 'SPBB' || mn === 'SPBNB') this.br = this.rlo;
          this.rlo = 1; this.sta = 1;
          this.endChain();
          break;
        case 'SPBI':
        case 'SPBIN':
          cond = (mn === 'SPBI' ? this.br : this.br ^ 1) === 1;
          this.sta = 1;
          this.endChain();
          break;
        case 'SPS':
          cond = this.os === 1;
          this.os = 0;
          break;
        case 'LOOP': {
          const low = (this.acc1 - 1) & 0xFFFF;
          this.acc1 = ((this.acc1 & 0xFFFF0000) | low) >>> 0;
          cond = low !== 0;
          break;
        }
        case 'SPL': {
          const k = this.acc1 & 0xFF;
          if (this.tracing) this.extra.jumped = true;
          return k < ins.splCount ? f.pc + 1 + k : tgt;
        }
        default: {
          const c1 = this.cc1;
          const c0 = this.cc0;
          switch (mn) {
            case 'SPO': cond = this.ov === 1; break;
            case 'SPZ': cond = c1 === 0 && c0 === 0; break;
            case 'SPN': cond = c1 !== c0; break;
            case 'SPP': cond = c1 === 1 && c0 === 0; break;
            case 'SPM': cond = c1 === 0 && c0 === 1; break;
            case 'SPPZ': cond = c0 === 0; break;
            case 'SPMZ': cond = c1 === 0; break;
            default: cond = c1 === 1 && c0 === 1; break; // SPU
          }
        }
      }
      if (this.tracing) this.extra.jumped = cond;
      return cond ? tgt : NEXT;
    }

    // --- bloques ---
    switch (mn) {
      case 'BE':
      case 'BEA':
        return END;
      case 'BEB':
        if (this.rlo) return END;
        this.rlo = 1; this.sta = 1;
        this.endChain();
        return NEXT;
      case 'AUF':
        this.db(op!.n!);
        if (op!.name === 'DB') this.openDb = op!.n!;
        else this.openDi = op!.n!;
        return NEXT;
      case 'UC':
      case 'CC':
      case 'CALL':
        if (mn === 'CC' && !this.rlo) {
          this.endChain();
          return NEXT;
        }
        return CALL;

      // --- MCR ---
      case 'MCRA':
        this.mcra = true;
        return NEXT;
      case 'MCRD':
        this.mcra = false;
        return NEXT;
      case 'MCR(':
        if (this.mcrStack.length >= 8) throw new PLCError(T.motor.pilaMcr);
        this.mcrStack.push(this.rlo);
        this.endChain();
        return NEXT;
      case ')MCR':
        if (!this.mcrStack.length) throw new PLCError(T.motor.mcrSinAbrir);
        this.mcrStack.pop();
        this.endChain();
        return NEXT;
      case 'NOP':
      case 'BLD':
        return NEXT;
    }
    throw new PLCError(T.motor.noImplementada(mn));
  }

  // _set_real
  private setReal(r: number, nanBits = CANON_NAN) {
    const bits = Number.isNaN(r) ? nanBits : f32Bits(r);
    const fv = bitsF32(bits);
    this.acc1 = bits;
    if (Number.isNaN(fv)) {
      this.cc1 = this.cc0 = 1;
      this.ov = 1;
    } else if (!Number.isFinite(fv)) {
      if (fv > 0) { this.cc1 = 1; this.cc0 = 0; } else { this.cc1 = 0; this.cc0 = 1; }
      this.ov = 1;
    } else if (fv === 0) {
      this.cc1 = this.cc0 = 0;
      this.ov = r !== 0 ? 1 : 0; // subdesbordamiento
    } else {
      if (fv > 0) { this.cc1 = 1; this.cc0 = 0; } else { this.cc1 = 0; this.cc0 = 1; }
      this.ov = 0;
    }
    this.os |= this.ov;
  }

  // _conv
  private conv(mn: string) {
    const a = this.acc1;
    switch (mn) {
      case 'BTI': {
        let v = bcdDecode(a & 0x0FFF, 3);
        if (a & 0x8000) v = -v;
        this.acc1 = ((a & 0xFFFF0000) | u16(v)) >>> 0;
        break;
      }
      case 'ITB': {
        const v = s16(a);
        if (Math.abs(v) > 999) {
          this.ov = this.os = 1;
        } else {
          const w = bcdEncode(Math.abs(v), 3) | (v < 0 ? 0xF000 : 0);
          this.acc1 = ((a & 0xFFFF0000) | w) >>> 0;
          this.ov = 0;
        }
        break;
      }
      case 'BTD': {
        let v = bcdDecode(a & 0x0FFFFFFF, 7);
        if (a & 0x80000000) v = -v;
        this.acc1 = u32(v);
        break;
      }
      case 'DTB': {
        const v = s32(a);
        if (Math.abs(v) > 9999999) {
          this.ov = this.os = 1;
        } else {
          this.acc1 = (bcdEncode(Math.abs(v), 7) | (v < 0 ? 0xF0000000 : 0)) >>> 0;
          this.ov = 0;
        }
        break;
      }
      case 'ITD':
        this.acc1 = u32(s16(a));
        break;
      case 'DTR':
        this.acc1 = f32Bits(s32(a));
        break;
      case 'RND':
      case 'TRUNC':
      case 'RND+':
      case 'RND-': {
        const x = bitsF32(a);
        if (!Number.isFinite(x)) {
          this.ov = this.os = 1;
          return;
        }
        const r = mn === 'RND' ? roundHalfEven(x) : mn === 'TRUNC' ? Math.trunc(x) : mn === 'RND+' ? Math.ceil(x) : Math.floor(x);
        if (!(r >= -(2 ** 31) && r < 2 ** 31)) {
          this.ov = this.os = 1;
          return;
        }
        this.acc1 = u32(r);
        this.ov = 0;
        break;
      }
      case 'INVI':
        this.acc1 = (a ^ 0x0000FFFF) >>> 0;
        break;
      case 'INVD':
        this.acc1 = ~a >>> 0;
        break;
      case 'NEGI': {
        const r = -s16(a);
        const w = s16(r);
        this.acc1 = ((a & 0xFFFF0000) | u16(w)) >>> 0;
        this.ccFrom(w);
        this.ov = r !== w ? 1 : 0;
        this.os |= this.ov;
        break;
      }
      case 'NEGD': {
        const r = -s32(a);
        const w = r | 0;
        this.acc1 = u32(w);
        this.ccFrom(w);
        this.ov = r !== w ? 1 : 0;
        this.os |= this.ov;
        break;
      }
      case 'NEGR':
        this.acc1 = (a ^ 0x80000000) >>> 0;
        break;
      case 'CAW':
        this.acc1 = ((a & 0xFFFF0000) | ((a & 0xFF) << 8) | ((a >>> 8) & 0xFF)) >>> 0;
        break;
      case 'CAD':
        this.acc1 = (((a & 0xFF) << 24) | (((a >>> 8) & 0xFF) << 16) | (((a >>> 16) & 0xFF) << 8) | ((a >>> 24) & 0xFF)) >>> 0;
        break;
    }
  }

  // ───────────── funciones de la app (no están en la referencia) ─────────────

  /** Forzado permanente: se reaplica tras leer la PAE y antes de escribir las salidas. */
  private applyForces(outputsOnly: boolean) {
    for (const fe of this.forces) {
      const op = fe.op;
      if (outputsOnly && op.area !== 'A' && op.area !== 'PA') continue;
      try {
        if (op.kind === 'bit') {
          this.wbit(op, fe.raw ? 1 : 0);
        } else if (op.kind === 'mem') {
          if (op.area === 'PE') writeBE(this.periphIn, op.byte!, op.size!, fe.raw);
          else this.wmem(op, fe.raw);
        }
      } catch {
        /* forzado de una dirección fuera de rango: se ignora */
      }
    }
  }

  /** RUN desde STOP: rearranque completo (borra lo no remanente y vuelve a ejecutar OB100). */
  restart() {
    this.PAA.fill(0);
    this.periphOut.fill(0);
    this.M.fill(0, Math.min(this.retentiveMBytes, this.M.length));
    for (let i = this.retentiveTimers; i < 256; i++) this.timers[i].reset();
    for (let i = this.retentiveCounters; i < 256; i++) this.counters[i].reset();
    this.resetRegisters();
    this.state = 'RUN';
    this.stopReason = null;
    this.stopLoc = null;
    this.first = true;
  }

  /** Pasa a STOP a mano (como el selector de la CPU). */
  stopManual() {
    this.frames = [];
    this.L = this.rootL;
    this.phase = 'IDLE';
    this.state = 'STOP';
    this.stopReason = null;
    this.stopLoc = null;
    this.PAA.fill(0);
    this.periphOut.fill(0);
  }

  /** Borrado total: todo a 0, incluidos lo remanente y los DB. */
  mres() {
    this.PAE.fill(0);
    this.PAA.fill(0);
    this.periphOut.fill(0);
    this.M.fill(0);
    this.rootL.fill(0);
    this.dbs.clear();
    for (const t of this.timers) t.reset();
    for (const c of this.counters) c.reset();
    this.resetRegisters();
    this.first = true;
    this.cycles = 0;
    this.timeMs = 0;
  }

  private resetRegisters() {
    this.frames = [];
    this.L = this.rootL;
    this.phase = 'IDLE';
    this.acc1 = this.acc2 = this.ar1 = this.ar2 = 0;
    this.fc = this.rlo = this.sta = this.orb = this.os = this.ov = this.cc0 = this.cc1 = this.br = 0;
    this.openDb = this.openDi = 0;
    this.mcra = false;
    this.mcrStack = [];
  }
}

const CANON_NAN = 0x7FC00000;

/** Periodos de la marca de ciclo de la CPU real, bits 0..7 (ms): 10, 5, 2,5, 2, 1,25, 1, 0,625 y 0,5 Hz. */
export const CLOCK_PERIODS_MS = [100, 200, 400, 500, 800, 1000, 1600, 2000];

export function isNanBits(b: number): boolean {
  return (b & 0x7F800000) === 0x7F800000 && (b & 0x007FFFFF) !== 0;
}

/** NaN resultante: el primer operando NaN (silenciado) o el NaN canónico. */
function nanOf(a: number, b: number): number {
  if (isNanBits(a)) return (a | 0x00400000) >>> 0;
  if (isNanBits(b)) return (b | 0x00400000) >>> 0;
  return CANON_NAN;
}

export function writeBE(b: Uint8Array, byte: number, size: number, value: number) {
  const v = value >>> 0;
  if (size === 1) b[byte] = v & 0xFF;
  else if (size === 2) {
    b[byte] = (v >>> 8) & 0xFF;
    b[byte + 1] = v & 0xFF;
  } else {
    b[byte] = (v >>> 24) & 0xFF;
    b[byte + 1] = (v >>> 16) & 0xFF;
    b[byte + 2] = (v >>> 8) & 0xFF;
    b[byte + 3] = v & 0xFF;
  }
}

export function readBE(b: Uint8Array, byte: number, size: number): number {
  if (size === 1) return b[byte];
  if (size === 2) return (b[byte] << 8) | b[byte + 1];
  return ((b[byte] << 24) | (b[byte + 1] << 16) | (b[byte + 2] << 8) | b[byte + 3]) >>> 0;
}
