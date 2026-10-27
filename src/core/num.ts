// Utilidades numéricas (equivalentes a u16/u32/s16/s32/f32_bits/bits_f32 de tools/interprete_referencia.py)
import { PLCError } from './errors';
import { T } from '../i18n';

export const u16 = (x: number): number => x & 0xFFFF;
export const u32 = (x: number): number => x >>> 0;
export const s16 = (x: number): number => (x << 16) >> 16;
export const s32 = (x: number): number => x | 0;

const F32 = new Float32Array(1);
const U32 = new Uint32Array(F32.buffer);

/** float → patrón IEEE 754 de 32 bits (desborda a ±inf; NaN canónico 0x7FC00000). */
export function f32Bits(f: number): number {
  if (Number.isNaN(f)) return 0x7FC00000;
  F32[0] = f;
  return U32[0];
}

export function bitsF32(u: number): number {
  U32[0] = u >>> 0;
  return F32[0];
}

export const toF32 = (f: number): number => bitsF32(f32Bits(f));

/** round() de Python sobre float: al par en x,5. */
export function roundHalfEven(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

export const hex = (v: number, pad = 0): string => (v >>> 0).toString(16).toUpperCase().padStart(pad, '0');

export function bcdDecode(value: number, ndigits: number): number {
  let v = 0;
  for (let i = ndigits - 1; i >= 0; i--) {
    const d = Math.floor(value / 2 ** (4 * i)) & 0xF;
    if (d > 9) throw new PLCError(T.motor.bcd(hex(d), hex(value)));
    v = v * 10 + d;
  }
  return v;
}

export function bcdEncode(v: number, ndigits: number): number {
  let r = 0;
  for (let i = 0; i < ndigits; i++) {
    r += (v % 10) * 2 ** (4 * i);
    v = Math.floor(v / 10);
  }
  return r >>> 0;
}

export const S5_BASES_MS = [10, 100, 1000, 10000];
