// Constantes AWL (parse_constant y compañía de la referencia)
import { CompileError, PLCError } from './errors';
import { bcdDecode, bcdEncode, f32Bits, hex, roundHalfEven, u16, u32 } from './num';
import { T as TX } from '../i18n';

export type CType = 'S5TIME' | 'TOD' | 'TIME' | 'DATE' | 'DINT' | 'DWORD' | 'WORD' | 'BYTE' | 'BCD' | 'PTR' | 'CHAR' | 'REAL' | 'INT';

export interface Const { value: number; ctype: CType }

/** Señal interna equivalente a ValueError/IndexError de Python dentro de parse_constant. */
class Bad extends Error {}

/** Elige la base más fina en la que el valor cabe en 3 cifras BCD. */
export function s5timeFromMs(ms: number): number {
  if (ms < 0) throw new CompileError(TX.motor.s5Negativo);
  const bases = [10, 100, 1000, 10000];
  for (let i = 0; i < 4; i++) {
    const v = Math.floor(ms / bases[i]);
    if (v <= 999) return ((i << 12) | bcdEncode(v, 3)) >>> 0;
  }
  throw new CompileError(TX.motor.s5Rango(ms));
}

export function s5timeDecode(w: number): [number, number] {
  const base = (w >> 12) & 0x3;
  let val: number;
  try {
    val = bcdDecode(w & 0x0FFF, 3);
  } catch (e) {
    if (e instanceof PLCError) throw new PLCError(TX.motor.tiempoNoValido(hex(w & 0xFFFF, 4)));
    throw e;
  }
  return [base, val];
}

const DUR_UNITS: Record<string, number> = { D: 86400000, H: 3600000, M: 60000, S: 1000, MS: 1 };

export function parseDurationMs(text: string): number {
  let t = text.toUpperCase().replace(/_/g, '');
  const neg = t.startsWith('-');
  if (neg) t = t.slice(1);
  let total = 0;
  let pos = 0;
  const re = /(\d+(?:\.\d+)?)(MS|D|H|M|S)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    if (m.index !== pos) throw new Bad(text);
    total += parseFloat(m[1]) * DUR_UNITS[m[2]];
    pos = m.index + m[0].length;
  }
  if (pos === 0 || pos !== t.length) throw new Bad(text);
  const ms = roundHalfEven(total);
  return neg ? -ms : ms;
}

function pyInt(s: string, base = 10): number {
  const t = s.trim();
  const re = base === 16 ? /^[+-]?[0-9A-Fa-f]+$/ : base === 2 ? /^[+-]?[01]+$/ : /^[+-]?\d+$/;
  if (!re.test(t)) throw new Bad(s);
  const neg = t.startsWith('-');
  const body = t.replace(/^[+-]/, '');
  let v = 0;
  for (const ch of body) v = v * base + parseInt(ch, base);
  return neg ? -v : v;
}

const REAL_RE = /^[+-]?(\d+\.\d*([eE][+-]?\d+)?|\d+[eE][+-]?\d+)$/;
const INT_RE = /^[+-]?\d+$/;
export const PTR_AREAS: Record<string, number> = { P: 0x80, E: 0x81, A: 0x82, M: 0x83, DBX: 0x84, DIX: 0x85, L: 0x86, V: 0x87 };

function daysSince1990(y: number, mo: number, d: number): number {
  if (y < 1 || y > 9999 || mo < 1 || mo > 12 || d < 1) throw new Bad('fecha');
  const t = Date.UTC(2000, mo - 1, d);
  const dt = new Date(t);
  dt.setUTCFullYear(y);
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) throw new Bad('fecha');
  const base = Date.UTC(1990, 0, 1);
  return Math.round((dt.getTime() - base) / 86400000);
}

/** Devuelve {value (u32), ctype} o null si `tok` no es una constante. */
export function parseConstant(tok: string): Const | null {
  const t = tok.trim();
  const T = t.toUpperCase();
  const after = (s: string) => s.slice(s.indexOf('#') + 1);
  try {
    if (T.startsWith('S5T#') || T.startsWith('S5TIME#')) return { value: s5timeFromMs(parseDurationMs(after(T))), ctype: 'S5TIME' };
    if (T.startsWith('TIME_OF_DAY#') || T.startsWith('TOD#')) {
      const parts = after(T).split(':');
      if (parts.length !== 3) throw new Bad(tok);
      const [hh, mm, ss] = parts;
      if (!/^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(ss)) throw new Bad(tok);
      const ms = (pyInt(hh) * 3600 + pyInt(mm) * 60) * 1000 + roundHalfEven(parseFloat(ss) * 1000);
      return { value: u32(ms), ctype: 'TOD' };
    }
    if (T.startsWith('TIME#') || T.startsWith('T#')) return { value: u32(parseDurationMs(after(T))), ctype: 'TIME' };
    if (T.startsWith('DATE#') || T.startsWith('D#')) {
      const parts = after(T).split('-');
      if (parts.length !== 3) throw new Bad(tok);
      const [y, mo, d] = parts.map((p) => pyInt(p));
      return { value: daysSince1990(y, mo, d), ctype: 'DATE' };
    }
    if (T.startsWith('L#')) {
      const v = pyInt(T.slice(2));
      if (!(v >= -(2 ** 31) && v < 2 ** 31)) throw new Bad(tok);
      return { value: u32(v), ctype: 'DINT' };
    }
    if (T.startsWith('DW#16#')) {
      const v = pyInt(T.slice(6).replace(/_/g, ''), 16);
      if (v > 0xFFFFFFFF || v < 0) throw new Bad(tok);
      return { value: v >>> 0, ctype: 'DWORD' };
    }
    if (T.startsWith('W#16#')) {
      const v = pyInt(T.slice(5).replace(/_/g, ''), 16);
      if (v > 0xFFFF || v < 0) throw new Bad(tok);
      return { value: v, ctype: 'WORD' };
    }
    if (T.startsWith('B#16#')) {
      const v = pyInt(T.slice(5).replace(/_/g, ''), 16);
      if (v > 0xFF || v < 0) throw new Bad(tok);
      return { value: v, ctype: 'BYTE' };
    }
    if (T.startsWith('16#')) {
      const v = pyInt(T.slice(3).replace(/_/g, ''), 16);
      return v <= 0xFFFF && v >= 0 ? { value: v, ctype: 'WORD' } : { value: u32(v % 2 ** 32), ctype: 'DWORD' };
    }
    if (T.startsWith('2#')) {
      const bits = T.slice(2).replace(/_/g, '');
      const v = pyInt(bits, 2);
      return bits.length <= 16 ? { value: v, ctype: 'WORD' } : { value: u32(v % 2 ** 32), ctype: 'DWORD' };
    }
    if (T.startsWith('C#')) {
      const v = pyInt(T.slice(2));
      if (!(v >= 0 && v <= 999)) throw new Bad(tok);
      return { value: bcdEncode(v, 3), ctype: 'BCD' };
    }
    if (T.startsWith('B#(')) {
      const parts = T.slice(3, -1).split(',').map((p) => pyInt(p));
      if ((parts.length !== 2 && parts.length !== 4) || parts.some((p) => !(p >= 0 && p <= 255))) throw new Bad(tok);
      let v = 0;
      for (const p of parts) v = v * 256 + p;
      return { value: v >>> 0, ctype: parts.length === 2 ? 'WORD' : 'DWORD' };
    }
    if (T.startsWith('P#')) {
      const body = T.slice(2).replace(/ /g, '');
      if (body.startsWith('DB') && body.includes('.') && body.includes('DBX'))
        throw new CompileError(TX.motor.punterosAny);
      const m = /^(DBX|DIX|[PEAMLV])?(\d+)\.([0-7])$/.exec(body);
      if (!m) throw new Bad(tok);
      const off = parseInt(m[2], 10) * 8 + parseInt(m[3], 10);
      if (m[1]) return { value: u32(PTR_AREAS[m[1]] * 2 ** 24 + off), ctype: 'PTR' };
      return { value: off, ctype: 'PTR' };
    }
    if (t.length >= 3 && t[0] === "'" && t[t.length - 1] === "'") {
      const chars = Array.from(t.slice(1, -1));
      if (!(chars.length >= 1 && chars.length <= 4)) throw new Bad(tok);
      let v = 0;
      for (const ch of chars) v = v * 256 + (ch.codePointAt(0)! & 0xFF);
      return { value: v >>> 0, ctype: 'CHAR' };
    }
    if (REAL_RE.test(t)) return { value: f32Bits(parseFloat(t)), ctype: 'REAL' };
    if (INT_RE.test(t)) {
      const v = parseInt(t, 10);
      if (v >= -32768 && v <= 32767) return { value: u16(v), ctype: 'INT' };
      if (v >= -(2 ** 31) && v < 2 ** 31) return { value: u32(v), ctype: 'DINT' };
      throw new Bad(tok);
    }
  } catch (e) {
    if (e instanceof Bad) throw new CompileError(TX.motor.constanteNoValida(tok));
    throw e;
  }
  return null;
}
