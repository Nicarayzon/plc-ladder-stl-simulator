// Maquetación KOP: árbol → rejilla. Coordenadas en celdas: x = columna, y = fila del cable.
import type { Elem, Rama, Salida, SegmentoKOP } from './model';
import { BOX_DEFS, isSalidaCuadro } from './model';

/** De dónde sale la corriente de un cable: la barra o la entrada/salida de un elemento. */
export type PowerRef = { id: string; side: 'in' | 'out' | 'q' } | 'rail';

export interface LItem {
  id: string;
  node: Elem | Salida;
  x: number;
  y: number;
  w: number;
  h: number;
  inRef: PowerRef;
  /** solo para pines secundarios de cuadros: nombre del pin */
  pin?: string;
}

export interface LPin { side: 'L' | 'R'; name: string; y: number; kind: 'bool' | 'val'; value?: string; field?: string; optional?: boolean; connected?: boolean; power?: PowerRef }

export interface LBox extends LItem {
  pins: LPin[];
}

export interface LWire { x1: number; y1: number; x2: number; y2: number; pw: PowerRef }
export interface LDot { x: number; y: number; pw: PowerRef }
/** Hueco donde se puede insertar (fin de una cadena vacía o al final) */
export interface LSlot { x: number; y: number; chain: string; index: number; pw: PowerRef }

export interface Layout {
  items: LItem[];
  boxes: LBox[];
  wires: LWire[];
  dots: LDot[];
  slots: LSlot[];
  width: number;
  height: number;
}

export const CONTACT_LIKE = new Set(['NA', 'NC', 'NOT', 'P', 'N', 'CON', 'POS', 'NEG']);

function elemW(e: Elem): number {
  switch (e.k) {
    case 'CMP': return 2;
    case 'SER': return e.items.length ? e.items.reduce((s, x) => s + elemW(x), 0) : 1;
    case 'PAR': return Math.max(1, ...e.ramas.map(elemW));
    default: return 1;
  }
}

function elemH(e: Elem): number {
  switch (e.k) {
    case 'CMP': return 2;
    case 'SER': return e.items.length ? Math.max(...e.items.map(elemH)) : 1;
    case 'PAR': return e.ramas.reduce((s, x) => s + elemH(x), 0);
    case 'POS':
    case 'NEG': return 1;
    default: return 1;
  }
}

export interface BoxPinDef { side: 'L' | 'R'; name: string; kind: 'bool' | 'val'; field: string; optional?: boolean }

export function boxPins(s: Salida): BoxPinDef[] {
  switch (s.k) {
    case 'TEMP':
      return [
        { side: 'L', name: 'S', kind: 'bool', field: '' }, { side: 'L', name: 'TW', kind: 'val', field: 'tw' }, { side: 'L', name: 'R', kind: 'bool', field: 'pinR', optional: true },
        { side: 'R', name: 'Q', kind: 'bool', field: 'q', optional: true }, { side: 'R', name: 'DUAL', kind: 'val', field: 'dual', optional: true }, { side: 'R', name: 'DEZ', kind: 'val', field: 'dez', optional: true },
      ];
    case 'CONT': {
      const L: BoxPinDef[] = [{ side: 'L', name: s.tipo === 'Z_RUECK' ? 'ZR' : 'ZV', kind: 'bool', field: '' }];
      if (s.tipo === 'ZAEHLER') L.push({ side: 'L', name: 'ZR', kind: 'bool', field: 'pinZR', optional: true });
      L.push({ side: 'L', name: 'S', kind: 'bool', field: 'pinS', optional: true }, { side: 'L', name: 'ZW', kind: 'val', field: 'zw', optional: true }, { side: 'L', name: 'R', kind: 'bool', field: 'pinR', optional: true });
      return [...L, { side: 'R', name: 'Q', kind: 'bool', field: 'q', optional: true }, { side: 'R', name: 'DUAL', kind: 'val', field: 'dual', optional: true }, { side: 'R', name: 'DEZ', kind: 'val', field: 'dez', optional: true }];
    }
    case 'BIEST':
      return s.tipo === 'SR'
        ? [{ side: 'L', name: 'S', kind: 'bool', field: '' }, { side: 'L', name: 'R', kind: 'bool', field: 'pin2' }, { side: 'R', name: 'Q', kind: 'bool', field: 'q', optional: true }]
        : [{ side: 'L', name: 'R', kind: 'bool', field: '' }, { side: 'L', name: 'S', kind: 'bool', field: 'pin2' }, { side: 'R', name: 'Q', kind: 'bool', field: 'q', optional: true }];
    case 'BOX': {
      const d = BOX_DEFS[s.fn];
      return [
        { side: 'L', name: 'EN', kind: 'bool', field: '' },
        ...d.ins.map((n) => ({ side: 'L' as const, name: n, kind: 'val' as const, field: `p.${n}` })),
        { side: 'R', name: 'ENO', kind: 'bool', field: 'eno', optional: true },
        ...d.outs.map((n) => ({ side: 'R' as const, name: n, kind: 'val' as const, field: `p.${n}` })),
      ];
    }
  }
  return [];
}

export function pinValue(s: Salida, field: string): string | undefined {
  if (field.startsWith('p.')) return (s as Extract<Salida, { k: 'BOX' }>).p[field.slice(2)];
  return (s as unknown as Record<string, string | undefined>)[field];
}

const BOX_W = 2;

export function layoutSegment(seg: SegmentoKOP): Layout {
  const L: Layout = { items: [], boxes: [], wires: [], dots: [], slots: [], width: 0, height: 0 };
  const coils: { y: number; fromX: number; pw: PowerRef; s: Salida }[] = [];
  /** fila libre más baja en la zona izquierda (para las cadenas de los pines secundarios) */
  let leftBottom = 0;

  function placeChain(e: Elem, x: number, y: number, inRef: PowerRef, chainKey: string): { w: number; h: number; out: PowerRef } {
    if (e.k === 'SER') {
      if (!e.items.length) {
        L.wires.push({ x1: x, y1: y, x2: x + 1, y2: y, pw: inRef });
        L.slots.push({ x, y, chain: e.id, index: 0, pw: inRef });
        return { w: 1, h: 1, out: inRef };
      }
      let cx = x;
      let h = 1;
      let ref = inRef;
      e.items.forEach((it) => {
        const r = placeChain(it, cx, y, ref, e.id);
        cx += r.w;
        h = Math.max(h, r.h);
        ref = r.out;
      });
      return { w: cx - x, h, out: ref };
    }
    if (e.k === 'PAR') {
      const W = elemW(e);
      let yy = y;
      const rows: number[] = [];
      e.ramas.forEach((b) => {
        rows.push(yy);
        const r = placeChain(b, x, yy, inRef, e.id);
        if (r.w < W) L.wires.push({ x1: x + r.w, y1: yy, x2: x + W, y2: yy, pw: r.out });
        yy += r.h;
      });
      const last = rows[rows.length - 1];
      L.wires.push({ x1: x, y1: y, x2: x, y2: last, pw: inRef });
      L.wires.push({ x1: x + W, y1: y, x2: x + W, y2: last, pw: { id: e.id, side: 'out' } });
      rows.slice(0, -1).forEach((ry) => {
        L.dots.push({ x, y: ry, pw: inRef });
        L.dots.push({ x: x + W, y: ry, pw: { id: e.id, side: 'out' } });
      });
      return { w: W, h: yy - y, out: { id: e.id, side: 'out' } };
    }
    L.items.push({ id: e.id, node: e, x, y, w: elemW(e), h: elemH(e), inRef });
    void chainKey;
    return { w: elemW(e), h: elemH(e), out: { id: e.id, side: 'out' } };
  }

  /** Coloca las ramas de salida a partir de la columna x (punto de bifurcación). Devuelve la fila siguiente libre. */
  function placeRamas(ramas: Rama[], x: number, y: number, inRef: PowerRef): number {
    let yy = y;
    const rows: number[] = [];
    for (const r of ramas) {
      rows.push(yy);
      let px = x;
      let ref = inRef;
      let h = 1;
      if (r.pre && (r.pre.k !== 'SER' || r.pre.items.length)) {
        const res = placeChain(r.pre, x, yy, inRef, r.pre.id);
        px = x + res.w;
        ref = res.out;
        h = res.h;
      }
      const s = r.salida;
      if (isSalidaCuadro(s)) {
        const bx = px + 1;
        L.wires.push({ x1: px, y1: yy, x2: bx, y2: yy, pw: ref });
        const defs = boxPins(s);
        const pins: LPin[] = [];
        let ly = yy;
        let maxY = yy;
        let first = true;
        // pines de la izquierda
        for (const d of defs.filter((p) => p.side === 'L')) {
          if (first) {
            pins.push({ side: 'L', name: d.name, y: yy, kind: 'bool', connected: true, power: ref });
            first = false;
            ly = yy + 1;
            continue;
          }
          if (d.kind === 'val') {
            pins.push({ side: 'L', name: d.name, y: ly, kind: 'val', value: pinValue(s, d.field), field: d.field, optional: d.optional });
            maxY = Math.max(maxY, ly);
            ly += 1;
          } else {
            const chain = (s as unknown as Record<string, Elem | undefined>)[d.field];
            const py = Math.max(ly, leftBottom);
            if (chain) {
              const res = placeChain(chain, 0, py, 'rail', chain.id);
              if (res.w < bx) L.wires.push({ x1: res.w, y1: py, x2: bx, y2: py, pw: res.out });
              pins.push({ side: 'L', name: d.name, y: py, kind: 'bool', field: d.field, connected: true, optional: d.optional, power: res.out });
              leftBottom = py + res.h;
              maxY = Math.max(maxY, py + res.h - 1);
              ly = py + res.h;
            } else {
              pins.push({ side: 'L', name: d.name, y: ly, kind: 'bool', field: d.field, connected: false, optional: d.optional });
              maxY = Math.max(maxY, ly);
              ly += 1;
            }
          }
        }
        // pines de la derecha
        let ry = yy;
        let qBottom = yy + 1;
        for (const d of defs.filter((p) => p.side === 'R')) {
          if (d.kind === 'bool') {
            const q = (s as unknown as Record<string, Rama[] | undefined>)[d.field];
            pins.push({ side: 'R', name: d.name, y: yy, kind: 'bool', field: d.field, connected: !!q?.length, optional: true, power: { id: s.id, side: 'q' } });
            if (q?.length) qBottom = placeRamas(q, bx + BOX_W, yy, { id: s.id, side: 'q' });
            ry = yy + 1;
          } else {
            pins.push({ side: 'R', name: d.name, y: ry, kind: 'val', value: pinValue(s, d.field), field: d.field, optional: d.optional });
            maxY = Math.max(maxY, ry);
            ry += 1;
          }
        }
        const bh = Math.max(maxY - yy + 1, 2);
        const box: LBox = { id: s.id, node: s, x: bx, y: yy, w: BOX_W, h: bh, inRef: ref, pins };
        L.boxes.push(box);
        h = Math.max(h, bh, qBottom - yy, ly - yy);
      } else {
        coils.push({ y: yy, fromX: px, pw: ref, s });
      }
      yy += h;
    }
    if (ramas.length > 1) {
      const last = rows[rows.length - 1];
      L.wires.push({ x1: x, y1: y, x2: x, y2: last, pw: inRef });
      rows.slice(0, -1).forEach((ry) => L.dots.push({ x, y: ry, pw: inRef }));
    }
    return yy;
  }

  const ent = placeChain(seg.entrada, 0, 0, 'rail', seg.entrada.id);
  leftBottom = ent.h;
  const xb = ent.w;
  const bottom = seg.salidas.length ? placeRamas(seg.salidas, xb, 0, ent.out) : ent.h;
  // bobinas alineadas a la derecha
  let coilX = 0;
  for (const c of coils) coilX = Math.max(coilX, c.fromX + 1);
  for (const b of L.boxes) for (const p of b.pins) if (p.side === 'R' && p.kind === 'val') coilX = Math.max(coilX, b.x + b.w + 1);
  for (const c of coils) {
    if (c.fromX < coilX) L.wires.push({ x1: c.fromX, y1: c.y, x2: coilX, y2: c.y, pw: c.pw });
    L.items.push({ id: c.s.id, node: c.s, x: coilX, y: c.y, w: 1, h: 1, inRef: c.pw });
  }
  let maxX = Math.max(coilX + 1, xb + 1);
  for (const it of L.items) maxX = Math.max(maxX, it.x + it.w);
  for (const b of L.boxes) maxX = Math.max(maxX, b.x + b.w + (b.pins.some((p) => p.side === 'R' && p.kind === 'val') ? 1 : 0));
  L.width = maxX;
  L.height = Math.max(bottom, leftBottom, 1);
  for (const it of L.items) L.height = Math.max(L.height, it.y + it.h);
  return L;
}
