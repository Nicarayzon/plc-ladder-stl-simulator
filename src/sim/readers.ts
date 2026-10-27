// Lectura y escritura de operandos desde la interfaz (sin efectos laterales sobre la CPU)
import { CPU, readBE, writeBE } from '../core/cpu';
import { parseOperand, translateEnOperand, type Op, type Symbols } from '../core/operands';
import { bcdEncode, hex } from '../core/num';
import { T } from '../i18n';

/** timerS5 y counterBcd: «T n» y «Z n» en la tabla de variables dan el valor (S5TIME y C#, lo que carga `L C`). */
export type ReaderKind = 'bit' | 'mem' | 'timerQ' | 'timerVal' | 'timerS5' | 'counterQ' | 'counterVal' | 'counterBcd';

export interface Reader {
  key: string;
  op: Op;
  kind: ReaderKind;
  size: 0 | 1 | 2 | 4;
}

/** Lo que se escribe en la tabla de variables, las señales o el panel E/S vale con cualquiera de las dos nemotecnias:
 *  si la alemana no lo entiende, se prueba como inglesa («I 124.0», «Q 4.0», «C 1»…). */
function parseOperandoAlguna(t: string, symbols?: Symbols): Op | null {
  try {
    return parseOperand(t, symbols);
  } catch (e) {
    const de = translateEnOperand(t);
    if (de !== t) {
      try { return parseOperand(de, symbols); } catch { /* el error que cuenta es el del original */ }
    }
    throw e;
  }
}

/** «MW 10», «T 1», «T 1:VALOR», «"Motor"»…
 *  Con `valorTZ` (tabla de variables), «T 1» y «Z 1» sin «:Q» dan el valor y no el bit. */
export function makeReader(text: string, symbols?: Symbols, valorTZ = false): Reader {
  let t = text.trim();
  let tipo: string | null = null;
  // «:VALUE» y «:WERT» son lo mismo que «:VALOR» (para quien usa la app en inglés o en alemán)
  const m = /^(.*?):\s*(VALOR|VALUE|WERT|Q)$/i.exec(t);
  if (m) {
    t = m[1].trim();
    tipo = ['VALUE', 'WERT'].includes(m[2].toUpperCase()) ? 'VALOR' : m[2].toUpperCase();
  }
  const op = parseOperandoAlguna(t, symbols);
  if (!op) throw new Error(T.motor.operandoVacio);
  if (op.ind) throw new Error(T.motor.sinIndirecto);
  if (op.kind === 'bit') return { key: text, op, kind: 'bit', size: 0 };
  if (op.kind === 'mem') return { key: text, op, kind: 'mem', size: op.size! };
  if (valorTZ && tipo === null && (op.kind === 'timer' || op.kind === 'counter')) return { key: text, op, kind: op.kind === 'timer' ? 'timerS5' : 'counterBcd', size: 2 };
  if (op.kind === 'timer') return { key: text, op, kind: tipo === 'VALOR' ? 'timerVal' : 'timerQ', size: tipo === 'VALOR' ? 2 : 0 };
  if (op.kind === 'counter') return { key: text, op, kind: tipo === 'VALOR' ? 'counterVal' : 'counterQ', size: tipo === 'VALOR' ? 2 : 0 };
  throw new Error(T.motor.noObservar(op.text));
}

function bufFor(cpu: CPU, op: Op, create: boolean): Uint8Array | null {
  switch (op.area) {
    case 'E': return cpu.PAE;
    case 'A': return cpu.PAA;
    case 'M': return cpu.M;
    case 'L': return cpu.rootL;
    case 'PE': return cpu.periphIn;
    case 'PA': return cpu.periphOut;
    case 'DB':
    case 'DI': {
      const n = op.db || (op.area === 'DB' ? cpu.openDb : cpu.openDi);
      if (!n) return null;
      return create ? cpu.db(n) : cpu.dbs.get(n) ?? null;
    }
  }
  return null;
}

/** Valor bruto (sin signo) o NaN si no se puede leer. */
export function readRaw(cpu: CPU, r: Reader): number {
  const op = r.op;
  switch (r.kind) {
    case 'timerQ': return cpu.timers[op.n!].q;
    case 'timerVal': return cpu.timers[op.n!].value;
    case 'timerS5': { const t = cpu.timers[op.n!]; return ((t.base << 12) | bcdEncode(t.value, 3)) >>> 0; }
    case 'counterBcd': return bcdEncode(cpu.counters[op.n!].value, 3);
    case 'counterQ': return cpu.counters[op.n!].value > 0 ? 1 : 0;
    case 'counterVal': return cpu.counters[op.n!].value;
  }
  const b = bufFor(cpu, op, false);
  if (!b) return op.area === 'DB' || op.area === 'DI' ? 0 : NaN;
  const byte = op.byte!;
  if (r.kind === 'bit') return byte < b.length ? (b[byte] >> op.bit!) & 1 : NaN;
  if (byte + r.size > b.length) return NaN;
  return readBE(b, byte, r.size);
}

/** Las tres cifras BCD de un S5TIME o de un C#. */
function bcd3(raw: number, que: string): number {
  const d = [(raw >> 8) & 0xF, (raw >> 4) & 0xF, raw & 0xF];
  if (d.some((x) => x > 9)) throw new Error(T.motor.noEsValido(hex(raw & 0xFFFF, 4), que));
  return d[0] * 100 + d[1] * 10 + d[2];
}

/** Escritura única («Forzar valor» de la tabla de variables). E y PE van a la periferia. */
export function writeRaw(cpu: CPU, r: Reader, raw: number) {
  const op = r.op;
  if (r.kind === 'timerVal') {
    cpu.timers[op.n!].value = Math.max(0, Math.min(999, raw));
    return;
  }
  if (r.kind === 'counterVal') {
    cpu.counters[op.n!].value = Math.max(0, Math.min(999, raw));
    return;
  }
  if (r.kind === 'timerS5') {
    const t = cpu.timers[op.n!];
    t.value = bcd3(raw, 'S5TIME');
    t.base = (raw >> 12) & 3;
    t.accMs = 0;
    return;
  }
  if (r.kind === 'counterBcd') {
    if (raw & 0xF000) throw new Error(T.motor.contador999);
    cpu.counters[op.n!].value = bcd3(raw, 'C#');
    return;
  }
  if (r.kind !== 'bit' && r.kind !== 'mem') throw new Error(T.motor.soloModificar);
  let b: Uint8Array | null;
  if (op.area === 'E' || op.area === 'PE') b = cpu.periphIn;
  else b = bufFor(cpu, op, true);
  if (!b) throw new Error(T.motor.sinDbAbierto);
  const byte = op.byte!;
  if (r.kind === 'bit') {
    if (byte >= b.length) throw new Error(T.motor.dirFueraRango);
    if (raw) b[byte] |= 1 << op.bit!;
    else b[byte] &= ~(1 << op.bit!) & 0xFF;
    if (op.area === 'E' && byte < cpu.PAE.length) {
      if (raw) cpu.PAE[byte] |= 1 << op.bit!;
      else cpu.PAE[byte] &= ~(1 << op.bit!) & 0xFF;
    }
    if (op.area === 'A' && byte < 128) cpu.periphOut[byte] = cpu.PAA[byte];
    return;
  }
  if (byte + r.size > b.length) throw new Error(T.motor.dirFueraRango);
  writeBE(b, byte, r.size, raw);
  if (op.area === 'E' && byte + r.size <= 128) writeBE(cpu.PAE, byte, r.size, raw);
  if (op.area === 'PA' && byte + r.size <= 128) writeBE(cpu.PAA, byte, r.size, raw);
}
