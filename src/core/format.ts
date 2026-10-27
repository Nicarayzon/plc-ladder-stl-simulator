// Formatos de visualización y entrada de valores (tabla de variables, paneles, analizador)
import { parseConstant } from './constants';
import { bitsF32, f32Bits, s16, s32, hex } from './num';
import { T } from '../i18n';

export type Formato = 'BOOL' | 'BIN' | 'HEX' | 'DEC' | 'UDEC' | 'BCD' | 'REAL' | 'S5TIME' | 'TIME' | 'CHAR';
export const FORMATOS: Formato[] = ['BOOL', 'BIN', 'HEX', 'DEC', 'UDEC', 'BCD', 'REAL', 'S5TIME', 'TIME', 'CHAR'];

export function fmtValue(raw: number, size: 0 | 1 | 2 | 4, f: Formato): string {
  const bits = size === 0 ? 1 : size * 8;
  const u = size === 4 ? raw >>> 0 : raw & ((1 << bits) - 1);
  switch (f) {
    case 'BOOL': return size === 0 ? String(u & 1) : u ? 'TRUE' : 'FALSE';
    case 'BIN': {
      const s = u.toString(2).padStart(bits, '0');
      return '2#' + s.replace(/(\d{4})(?=\d)/g, '$1_');
    }
    case 'HEX': return size === 1 ? `B#16#${hex(u, 2)}` : size === 2 ? `W#16#${hex(u, 4)}` : size === 4 ? `DW#16#${hex(u, 8)}` : String(u);
    case 'DEC': return size === 2 ? String(s16(u)) : size === 4 ? String(s32(u)) : String(u);
    case 'UDEC': return String(u);
    case 'BCD': {
      const digits = size === 4 ? 7 : 3;
      let s = '';
      for (let i = digits - 1; i >= 0; i--) {
        const d = Math.floor(u / 2 ** (4 * i)) & 0xF;
        s += d > 9 ? '?' : String(d);
      }
      const neg = size === 4 ? (u >>> 28) === 0xF : size === 2 ? (u >>> 12) === 0xF : false;
      return (neg ? '-' : '') + 'C#' + s.replace(/^0+(?=\d)/, '');
    }
    case 'REAL': {
      if (size !== 4) return '—';
      return fmtReal(bitsF32(u));
    }
    case 'S5TIME': {
      if (size !== 2) return '—';
      return fmtS5time(u);
    }
    case 'TIME': return fmtTime(size === 4 ? s32(u) : s16(u));
    case 'CHAR': {
      let s = '';
      for (let i = (size || 1) - 1; i >= 0; i--) {
        const c = (u >>> (8 * i)) & 0xFF;
        s += c >= 32 && c < 127 ? String.fromCharCode(c) : '.';
      }
      return `'${s}'`;
    }
  }
}

/** `cifras`: cifras significativas (7 por defecto; la ventana de la tabla de variables usa 6) */
export function fmtReal(x: number, cifras = 7): string {
  if (Number.isNaN(x)) return 'NaN';
  if (!Number.isFinite(x)) return x > 0 ? '+inf' : '-inf';
  if (x === 0) return '0.0';
  const a = Math.abs(x);
  if (a >= 1e7 || a < 1e-4) return x.toExponential(cifras - 1).replace(/e\+?/, 'e+').replace('e+-', 'e-');
  const s = parseFloat(x.toPrecision(cifras)).toString();
  return s.includes('.') ? s : `${s}.0`;
}

export function fmtS5time(w: number): string {
  const base = (w >> 12) & 3;
  const d = [(w >> 8) & 0xF, (w >> 4) & 0xF, w & 0xF];
  if (d.some((x) => x > 9)) return T.motor.noEsS5(hex(w & 0xFFFF, 4));
  const v = d[0] * 100 + d[1] * 10 + d[2];
  const ms = v * [10, 100, 1000, 10000][base];
  return `S5T#${fmtDuration(ms)}`;
}

export function fmtDuration(ms: number): string {
  if (ms === 0) return '0MS';
  let r = Math.abs(ms);
  const parts: string[] = [];
  const units: [number, string][] = [[86400000, 'D'], [3600000, 'H'], [60000, 'M'], [1000, 'S'], [1, 'MS']];
  for (const [u, n] of units) {
    const q = Math.floor(r / u);
    if (q) {
      parts.push(`${q}${n}`);
      r -= q * u;
    }
  }
  return (ms < 0 ? '-' : '') + parts.join('_');
}

export function fmtTime(ms: number): string {
  return `T#${fmtDuration(ms)}`;
}

/** Interpreta lo que escribe el alumno en la tabla de variables. */
export function parseUserValue(text: string, size: 0 | 1 | 2 | 4, f: Formato): number {
  const t = text.trim();
  if (size === 0) {
    if (/^(1|true|on|sí|si)$/i.test(t)) return 1;
    if (/^(0|false|off|no)$/i.test(t)) return 0;
    throw new Error(T.motor.bit01);
  }
  if (f === 'REAL' || (/^[+-]?\d*\.\d+(e[+-]?\d+)?$/i.test(t) && size === 4)) {
    const v = parseFloat(t);
    if (Number.isNaN(v)) throw new Error(T.motor.realNoValido);
    return f32Bits(v);
  }
  if (f === 'BCD' && /^-?\d+$/.test(t)) {
    const v = parseInt(t, 10);
    const c = parseConstant(`C#${Math.abs(v)}`);
    if (!c) throw new Error(T.motor.bcdNoValido);
    return c.value | (v < 0 ? 0xF000 : 0);
  }
  if (f === 'S5TIME' && !/#/.test(t)) {
    const c = parseConstant(`S5T#${t}`);
    if (c) return c.value;
  }
  const c = parseConstant(t);
  if (!c) throw new Error(T.motor.valorNoValido);
  return c.value;
}

export const sizeOfFormatDefault = (size: 0 | 1 | 2 | 4): Formato => (size === 0 ? 'BOOL' : size === 4 ? 'DEC' : 'DEC');
