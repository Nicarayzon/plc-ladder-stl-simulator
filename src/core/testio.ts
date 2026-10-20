// Lectura/escritura para las pruebas (test_write / test_read / _expected_matches de la referencia)
import { TestValueError } from './errors';
import { parseConstant } from './constants';
import { parseOperand } from './operands';
import { bitsF32, f32Bits, s16, s32 } from './num';
import { type CPU, writeBE } from './cpu';

export type TestValue = number | string | boolean;

export function splitKey(key: string): [string, string | null] {
  const k = String(key).trim();
  const i = k.lastIndexOf(':');
  if (i >= 0) return [k.slice(0, i).trim(), k.slice(i + 1).trim().toUpperCase()];
  return [k, null];
}

export function valueToRaw(value: TestValue, tipo: string | null): number {
  if (tipo === 'REAL') return f32Bits(typeof value === 'string' ? parseFloat(value) : Number(value));
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const c = parseConstant(value);
    if (c === null) throw new TestValueError(`valor no válido: ${value}`);
    return c.value;
  }
  if (!Number.isInteger(value)) return f32Bits(value);
  return value;
}

function toInt(v: TestValue): number {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) throw new TestValueError(`valor no válido: ${v}`);
    return n;
  }
  return Math.trunc(v);
}

export function testWrite(cpu: CPU, key: string, value: TestValue) {
  const [opstr, tipo] = splitKey(key);
  const op = parseOperand(opstr);
  if (op && op.kind === 'bit') {
    if (op.area === 'E' && !op.ind) { // entrada física: se copia a la PAE al empezar el ciclo
      const b = op.byte!;
      if (b >= cpu.periphIn.length) throw new TestValueError(`no se puede escribir ${key}`);
      if (toInt(value)) cpu.periphIn[b] |= 1 << op.bit!;
      else cpu.periphIn[b] &= ~(1 << op.bit!) & 0xFF;
    } else cpu.wbit(op, toInt(value));
    return;
  }
  if (op && op.kind === 'mem') {
    const raw = valueToRaw(value, tipo);
    if ((op.area === 'E' || op.area === 'PE') && !op.ind) {
      if (op.byte! + op.size! > cpu.periphIn.length) throw new TestValueError(`no se puede escribir ${key}`);
      const mask = op.size === 4 ? 0xFFFFFFFF : (1 << (8 * op.size!)) - 1;
      writeBE(cpu.periphIn, op.byte!, op.size!, raw & mask);
    } else cpu.wmem(op, raw);
    return;
  }
  throw new TestValueError(`no se puede escribir ${key}`);
}

export function testRead(cpu: CPU, key: string): number {
  const [opstr, tipo] = splitKey(key);
  const op = parseOperand(opstr);
  if (op && op.kind === 'bit') return cpu.rbit(op);
  if (op && op.kind === 'timer') {
    const t = cpu.timers[op.n!];
    return tipo === 'VALOR' ? t.value : t.q;
  }
  if (op && op.kind === 'counter') {
    const c = cpu.counters[op.n!];
    return tipo === 'VALOR' ? c.value : c.value > 0 ? 1 : 0;
  }
  if (op && op.kind === 'mem') {
    const raw = cpu.rmem(op);
    if (tipo === 'REAL') return bitsF32(raw);
    if (tipo === 'WORD' || tipo === 'DWORD' || tipo === 'BYTE') return raw;
    if (tipo === 'INT' || (tipo === null && op.size === 2)) return s16(raw);
    if (tipo === 'DINT' || (tipo === null && op.size === 4)) return s32(raw);
    return raw;
  }
  throw new TestValueError(`no se puede leer ${key}`);
}

export function expectedMatches(actual: number, expected: TestValue, tipo: string | null): boolean {
  if (tipo === 'REAL') return Math.abs(actual - (typeof expected === 'string' ? parseFloat(expected) : Number(expected))) <= 1e-3;
  if (typeof expected === 'string') {
    const c = parseConstant(expected);
    if (c === null) throw new TestValueError(`valor no válido: ${expected}`);
    let exp = c.value;
    if ((tipo === null || tipo === 'INT') && Number.isInteger(actual) && actual < 0) exp = s16(exp);
    return actual === exp;
  }
  return actual === toInt(expected);
}

/** Formatea un valor leído como lo haría Python (str(int) / repr(float)). */
export function fmtGot(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return String(v);
}
