// Índice de uso de operandos: qué lee y qué escribe cada instrucción (E/S, avisos, equivalencia, paneles).
import type { CompiledProgram, Instr } from './compiler';
import type { Area, Op } from './operands';

export type Mode = 'r' | 'w' | 'rw';

export interface Access {
  block: string;
  idx: number;
  ins: Instr;
  mode: Mode;
  kind: 'bit' | 'mem' | 'timer' | 'counter';
  area: Area | 'T' | 'Z';
  byte: number;
  bit: number;
  size: number;
  db?: number;
  indirect: boolean;
}

export interface Usage {
  accesses: Access[];
  timers: Map<number, Set<string>>; // n → tipos de arranque usados (SI, SE…)
  counters: Set<number>;
  usesEdges: boolean;
  usesSetReset: boolean;
  usesTimersOrCounters: boolean;
  hasIndirect: boolean;
}

const BIT_READ = new Set(['U', 'UN', 'O', 'ON', 'X', 'XN']);

function access(block: string, idx: number, ins: Instr, op: Op, mode: Mode): Access | null {
  if (op.kind === 'bit') return { block, idx, ins, mode, kind: 'bit', area: op.area!, byte: op.byte ?? -1, bit: op.bit ?? 0, size: 0, db: op.db, indirect: !!op.ind };
  if (op.kind === 'mem') return { block, idx, ins, mode, kind: 'mem', area: op.area!, byte: op.byte ?? -1, bit: 0, size: op.size!, db: op.db, indirect: !!op.ind };
  if (op.kind === 'timer') return { block, idx, ins, mode, kind: 'timer', area: 'T', byte: op.n!, bit: 0, size: 0, indirect: false };
  if (op.kind === 'counter') return { block, idx, ins, mode, kind: 'counter', area: 'Z', byte: op.n!, bit: 0, size: 0, indirect: false };
  return null;
}

export function analyzeUsage(cp: CompiledProgram): Usage {
  const u: Usage = { accesses: [], timers: new Map(), counters: new Set(), usesEdges: false, usesSetReset: false, usesTimersOrCounters: false, hasIndirect: false };
  for (const [block, b] of cp.blocks) {
    b.instrs.forEach((ins, idx) => {
      const op = ins.op;
      if (!op) return;
      const mn = ins.mn;
      let mode: Mode | null = null;
      if (BIT_READ.has(mn)) mode = 'r';
      else if (mn === '=') mode = 'w';
      else if (mn === 'S' || mn === 'R') {
        mode = 'w';
        if (op.kind === 'bit') u.usesSetReset = true;
      } else if (mn === 'FP' || mn === 'FN') {
        mode = 'rw';
        u.usesEdges = true;
      } else if (mn === 'L' || mn === 'LC' || mn === 'LAR1' || mn === 'LAR2') mode = 'r';
      else if (mn === 'T' || mn === 'TAR1' || mn === 'TAR2') mode = 'w';
      else if (['SI', 'SV', 'SE', 'SS', 'SA'].includes(mn)) {
        mode = 'w';
        const set = u.timers.get(op.n!) ?? new Set<string>();
        set.add(mn);
        u.timers.set(op.n!, set);
      } else if (mn === 'FR' || mn === 'ZV' || mn === 'ZR') mode = 'w';
      if (!mode) return;
      if (op.kind === 'timer') {
        u.usesTimersOrCounters = true;
        if (!u.timers.has(op.n!)) u.timers.set(op.n!, new Set());
      }
      if (op.kind === 'counter') {
        u.usesTimersOrCounters = true;
        u.counters.add(op.n!);
      }
      const a = access(block, idx, ins, op, mode);
      if (a) {
        if (a.indirect) u.hasIndirect = true;
        u.accesses.push(a);
        if (op.ind && op.ind.k === 'mem') {
          const p = access(block, idx, ins, op.ind.ptr, 'r');
          if (p) u.accesses.push(p);
        }
      }
    });
  }
  return u;
}

export const bitKey = (area: string, byte: number, bit: number) => `${area}${byte}.${bit}`;
export const memKey = (area: string, byte: number, size: number) => `${area}${size === 1 ? 'B' : size === 2 ? 'W' : 'D'}${byte}`;

/** Bits de entrada (E) leídos directamente, ordenados. */
export function inputBits(u: Usage): string[] {
  const set = new Set<string>();
  for (const a of u.accesses) {
    if (a.area !== 'E' || a.indirect) continue;
    if (a.kind === 'bit' && a.mode !== 'w') set.add(bitKey('E', a.byte, a.bit));
    if (a.kind === 'mem' && a.mode !== 'w') for (let b = a.byte; b < a.byte + a.size; b++) for (let i = 0; i < 8; i++) set.add(bitKey('E', b, i));
  }
  return sortBits([...set]);
}

/** Bits de salida (A) escritos o leídos, ordenados. */
export function outputBits(u: Usage): string[] {
  const set = new Set<string>();
  for (const a of u.accesses) {
    if ((a.area !== 'A' && a.area !== 'PA') || a.indirect) continue;
    if (a.kind === 'bit') set.add(bitKey('A', a.byte, a.bit));
    if (a.kind === 'mem' && a.byte < 128) for (let b = a.byte; b < a.byte + a.size; b++) for (let i = 0; i < 8; i++) set.add(bitKey('A', b, i));
  }
  return sortBits([...set]);
}

/** Palabras de periferia de entrada (PEW) leídas. */
export function analogInputs(u: Usage): string[] {
  const set = new Set<string>();
  for (const a of u.accesses) if (a.area === 'PE' && a.kind === 'mem' && !a.indirect) set.add(`PEW ${a.byte}`);
  return [...set].sort((x, y) => parseInt(x.slice(4), 10) - parseInt(y.slice(4), 10));
}

/** Palabras de salida (AW / PAW) escritas. */
export function outputWords(u: Usage): string[] {
  const set = new Set<string>();
  for (const a of u.accesses) if ((a.area === 'A' || a.area === 'PA') && a.kind === 'mem' && a.mode !== 'r' && !a.indirect && a.size >= 2) set.add(`${a.area === 'PA' ? 'PAW' : 'AW'} ${a.byte}`);
  return [...set].sort();
}

export function sortBits(keys: string[]): string[] {
  const parse = (k: string) => {
    const m = /^([A-Z]+)(\d+)\.(\d)$/.exec(k)!;
    return [m[1], parseInt(m[2], 10), parseInt(m[3], 10)] as const;
  };
  return keys.sort((a, b) => {
    const [aa, ab, ai] = parse(a);
    const [ba, bb, bi] = parse(b);
    return aa === ba ? (ab === bb ? ai - bi : ab - bb) : aa < ba ? -1 : 1;
  });
}
