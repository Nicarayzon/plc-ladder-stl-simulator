// Flujo de corriente en línea a partir de la tabla «Observar» de la CPU
import type { Elem, Rama, Salida, SegmentoKOP } from './model';

/** 1 = con corriente, 0 = sin corriente, -1 = no ejecutado en el último ciclo */
export type Pw = 1 | 0 | -1;

export interface KeyState { executed: boolean; rlo: number; sta: number; count: number }

/** Estado de la instrucción con el papel `role` del elemento `id` (o null si no existe). */
export type KeyLookup = (id: string, role: 'key' | 'q') => KeyState | null;
/** Lectura directa de Q de un cuadro sin ramas en Q (T, Z o bit). */
export type DirectLookup = (s: Salida) => number | null;

export type Flow = Map<string, Pw>;

const and = (a: Pw, b: number): Pw => (a === -1 ? -1 : a === 1 && b ? 1 : 0);

export function computeFlow(seg: SegmentoKOP, key: KeyLookup, direct: DirectLookup, segExecuted: boolean): Flow {
  const f: Flow = new Map();
  const set = (id: string, side: string, v: Pw) => f.set(`${id}:${side}`, v);

  function chain(e: Elem, inPw: Pw): Pw {
    set(e.id, 'in', inPw);
    let out: Pw;
    switch (e.k) {
      case 'SER': {
        let p = inPw;
        for (const it of e.items) p = chain(it, p);
        out = p;
        break;
      }
      case 'PAR': {
        let any: Pw = inPw === -1 ? -1 : 0;
        for (const b of e.ramas) {
          const o = chain(b, inPw);
          if (o === 1) any = 1;
        }
        out = any;
        break;
      }
      case 'NA':
      case 'NC': {
        const k = key(e.id, 'key');
        if (!k || !k.executed) out = -1;
        else out = and(inPw, e.k === 'NA' ? k.sta : k.sta ^ 1);
        set(e.id, 'cond', !k || !k.executed ? -1 : ((e.k === 'NA' ? k.sta : k.sta ^ 1) as Pw));
        break;
      }
      case 'NOT': {
        const k = key(e.id, 'key');
        out = !k || !k.executed || inPw === -1 ? -1 : inPw === 1 ? 0 : 1;
        break;
      }
      case 'P':
      case 'N': {
        const k = key(e.id, 'key');
        out = !k || !k.executed ? -1 : (k.rlo as Pw);
        break;
      }
      case 'POS':
      case 'NEG':
      case 'CMP': {
        const k = key(e.id, 'key');
        out = !k || !k.executed ? -1 : and(inPw, k.rlo);
        set(e.id, 'cond', !k || !k.executed ? -1 : (k.rlo as Pw));
        break;
      }
      case 'CON':
      default:
        out = inPw;
    }
    set(e.id, 'out', out);
    return out;
  }

  function ramas(rs: Rama[] | undefined, inPw: Pw) {
    for (const r of rs ?? []) {
      const p = r.pre ? chain(r.pre, inPw) : inPw;
      salida(r.salida, p);
    }
  }

  function salida(s: Salida, inPw: Pw) {
    set(s.id, 'in', inPw);
    set(s.id, 'out', inPw);
    const pins: [string, Elem | undefined][] = [];
    let q: Rama[] | undefined;
    if (s.k === 'TEMP') { pins.push(['pinR', s.pinR]); q = s.q; } else if (s.k === 'CONT') { pins.push(['pinZR', s.pinZR], ['pinS', s.pinS], ['pinR', s.pinR]); q = s.q; } else if (s.k === 'BIEST') { pins.push(['pin2', s.pin2]); q = s.q; } else if (s.k === 'BOX') q = s.eno;
    for (const [, c] of pins) if (c) chain(c, segExecuted ? 1 : -1);
    if (s.k === 'TEMP' || s.k === 'CONT' || s.k === 'BIEST' || s.k === 'BOX') {
      const k = key(s.id, 'q');
      let qp: Pw;
      if (k && k.executed) qp = k.rlo as Pw;
      else if (!segExecuted) qp = -1;
      else {
        const d = direct(s);
        qp = d === null ? -1 : (d ? 1 : 0);
      }
      set(s.id, 'q', qp);
      ramas(q, qp);
    }
  }

  const rail: Pw = segExecuted ? 1 : -1;
  f.set('rail', rail);
  const out = chain(seg.entrada, rail);
  ramas(seg.salidas, out);
  return f;
}
