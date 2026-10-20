// Pequeño lenguaje para escribir modelos KOP en código (modelos de los ejercicios y pruebas)
import { assignIds } from './ids';
import type { ContTipo, Elem, FnBox, FnCmp, Rama, Salida, SegmentoKOP, TempTipo } from './model';

type E = Elem;
type Chain = E | E[] | undefined;

export const ser = (...items: E[]): E => ({ k: 'SER', id: '', items });
const toSer = (c: Chain): E => (c === undefined ? ser() : Array.isArray(c) ? ser(...c) : c.k === 'SER' ? c : ser(c));
const branch = (c: E | E[]): E => (Array.isArray(c) ? (c.length === 1 ? c[0] : ser(...c)) : c);

export const na = (op: string): E => ({ k: 'NA', id: '', op });
export const nc = (op: string): E => ({ k: 'NC', id: '', op });
export const not = (): E => ({ k: 'NOT', id: '' });
export const p = (mem: string): E => ({ k: 'P', id: '', mem });
export const n = (mem: string): E => ({ k: 'N', id: '', mem });
export const pos = (op: string, mem: string): E => ({ k: 'POS', id: '', op, mem });
export const neg = (op: string, mem: string): E => ({ k: 'NEG', id: '', op, mem });
export const con = (op: string): E => ({ k: 'CON', id: '', op });
export const cmp = (fn: FnCmp, in1: string, in2: string): E => ({ k: 'CMP', id: '', fn, in1, in2 });
export const par = (...ramas: (E | E[])[]): E => ({ k: 'PAR', id: '', ramas: ramas.map(branch) });

export const bob = (op: string): Salida => ({ k: 'BOB', id: '', op });
export const s = (op: string): Salida => ({ k: 'S', id: '', op });
export const r = (op: string): Salida => ({ k: 'R', id: '', op });
export const save = (): Salida => ({ k: 'SAVE', id: '' });
export const coilT = (k: 'SI' | 'SV' | 'SE' | 'SS' | 'SA', t: string, tw: string): Salida => ({ k, id: '', t, tw });
export const zv = (z: string): Salida => ({ k: 'ZV', id: '', z });
export const zr = (z: string): Salida => ({ k: 'ZR', id: '', z });
export const sz = (z: string, zw: string): Salida => ({ k: 'SZ', id: '', z, zw });
export const jmp = (meta: string): Salida => ({ k: 'JMP', id: '', meta });
export const jmpn = (meta: string): Salida => ({ k: 'JMPN', id: '', meta });
export const ret = (): Salida => ({ k: 'RET', id: '' });
export const call = (bloque: string): Salida => ({ k: 'CALL', id: '', bloque });

export const rama = (salida: Salida, pre?: Chain): Rama => (pre === undefined ? { salida } : { pre: toSer(pre), salida });
type RamaLike = Rama | Salida;
const toRama = (x: RamaLike): Rama => ('salida' in x ? x : { salida: x });

export function temp(tipo: TempTipo, t: string, tw: string, o: { pinR?: Chain; dual?: string; dez?: string; q?: RamaLike[] } = {}): Salida {
  return { k: 'TEMP', id: '', tipo, t, tw, pinR: o.pinR === undefined ? undefined : toSer(o.pinR), dual: o.dual, dez: o.dez, q: o.q?.map(toRama) };
}

export function cont(tipo: ContTipo, z: string, o: { pinZR?: Chain; pinS?: Chain; zw?: string; pinR?: Chain; dual?: string; dez?: string; q?: RamaLike[] } = {}): Salida {
  return {
    k: 'CONT', id: '', tipo, z,
    pinZR: o.pinZR === undefined ? undefined : toSer(o.pinZR),
    pinS: o.pinS === undefined ? undefined : toSer(o.pinS),
    zw: o.zw,
    pinR: o.pinR === undefined ? undefined : toSer(o.pinR),
    dual: o.dual, dez: o.dez, q: o.q?.map(toRama),
  };
}

export const biest = (tipo: 'SR' | 'RS', op: string, pin2: Chain, q?: RamaLike[]): Salida =>
  ({ k: 'BIEST', id: '', tipo, op, pin2: toSer(pin2), q: q?.map(toRama) });

export const box = (fn: FnBox, pins: Record<string, string>, eno?: RamaLike[]): Salida => ({ k: 'BOX', id: '', fn, p: pins, eno: eno?.map(toRama) });

export function seg(o: { titulo?: string; comentario?: string; meta?: string; entrada?: Chain; salidas?: RamaLike[] }): SegmentoKOP {
  return { id: '', titulo: o.titulo, comentario: o.comentario, meta: o.meta, entrada: toSer(o.entrada), salidas: (o.salidas ?? []).map(toRama) };
}

/** Asigna ids deterministas: prefijo.s1, prefijo.s2… */
export function segs(prefix: string, list: SegmentoKOP[]): SegmentoKOP[] {
  return list.map((sg, i) => assignIds(sg, `${prefix}.s${i + 1}`));
}
