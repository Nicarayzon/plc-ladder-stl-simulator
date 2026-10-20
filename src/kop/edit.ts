// Operaciones de edición KOP puras: devuelven un segmento nuevo y el id que queda seleccionado.
import { newId } from './ids';
import type { Elem, FnBox, FnCmp, Rama, Salida, SegmentoKOP, TempTipo, ContTipo } from './model';

type Ser = Extract<Elem, { k: 'SER' }>;
type Par = Extract<Elem, { k: 'PAR' }>;

export interface EditResult { seg: SegmentoKOP; sel: string | null }

/** Selección de una cadena de pin de un cuadro: `${boxId}#${campo}` */
export const pinSel = (boxId: string, field: string) => `${boxId}#${field}`;

type Loc =
  | { kind: 'ser'; ser: Ser; index: number; node: Elem }
  | { kind: 'par'; par: Par; index: number; node: Elem }
  | { kind: 'root'; node: Ser; set: (e: Ser) => void }
  | { kind: 'salida'; ramas: Rama[]; index: number; node: Salida; top: boolean };

function locate(seg: SegmentoKOP, id: string): Loc | null {
  let found: Loc | null = null;
  const elem = (e: Elem, parent: { ser?: Ser; par?: Par; index: number } | null, setRoot?: (x: Ser) => void) => {
    if (found) return;
    if (e.id === id) {
      if (parent?.ser) found = { kind: 'ser', ser: parent.ser, index: parent.index, node: e };
      else if (parent?.par) found = { kind: 'par', par: parent.par, index: parent.index, node: e };
      else if (e.k === 'SER' && setRoot) found = { kind: 'root', node: e, set: setRoot };
      return;
    }
    if (e.k === 'SER') e.items.forEach((x, i) => elem(x, { ser: e, index: i }));
    else if (e.k === 'PAR') e.ramas.forEach((x, i) => elem(x, { par: e, index: i }));
  };
  const ramas = (rs: Rama[] | undefined, top: boolean) => {
    rs?.forEach((r, i) => {
      if (found) return;
      if (r.salida.id === id) { found = { kind: 'salida', ramas: rs, index: i, node: r.salida, top }; return; }
      if (r.pre) elem(r.pre, null, (x) => { r.pre = x; });
      sal(r.salida);
    });
  };
  const sal = (s: Salida) => {
    if (found) return;
    const sr = s as unknown as Record<string, Elem | undefined>;
    for (const f of ['pinR', 'pinZR', 'pinS', 'pin2']) {
      const c = sr[f];
      if (c) elem(c, null, (x) => { sr[f] = x; });
    }
    if (s.k === 'TEMP' || s.k === 'CONT' || s.k === 'BIEST') ramas(s.q, false);
    if (s.k === 'BOX') ramas(s.eno, false);
  };
  elem(seg.entrada, null, (x) => { seg.entrada = x; });
  ramas(seg.salidas, true);
  return found;
}

export function findNode(seg: SegmentoKOP, id: string): Elem | Salida | null {
  const l = locate(seg, id);
  return l ? l.node : null;
}

const ser = (...items: Elem[]): Ser => ({ k: 'SER', id: newId(), items });
const isEmptyChain = (e: Elem | undefined) => !e || (e.k === 'SER' && e.items.length === 0);

// ───────────── normalización ─────────────
function normElem(e: Elem): Elem | null {
  if (e.k === 'SER') {
    const items: Elem[] = [];
    for (const it of e.items) {
      const n = normElem(it);
      if (!n) continue;
      if (n.k === 'SER') items.push(...n.items);
      else items.push(n);
    }
    e.items = items;
    return e;
  }
  if (e.k === 'PAR') {
    const ramas: Elem[] = [];
    for (const b of e.ramas) {
      let n = normElem(b);
      if (!n) continue;
      if (n.k === 'SER' && n.items.length === 0) continue;
      if (n.k === 'SER' && n.items.length === 1) n = n.items[0];
      if (n.k === 'PAR') ramas.push(...n.ramas);
      else ramas.push(n);
    }
    e.ramas = ramas;
    if (ramas.length === 0) return null;
    if (ramas.length === 1) return ramas[0];
    return e;
  }
  return e;
}

function normRoot(e: Elem | undefined): Ser | undefined {
  if (!e) return undefined;
  const n = normElem(e);
  if (!n) return ser();
  return n.k === 'SER' ? n : ser(n);
}

export function normalize(seg: SegmentoKOP): SegmentoKOP {
  seg.entrada = normRoot(seg.entrada) ?? ser();
  const ramas = (rs: Rama[] | undefined) => rs?.forEach((r) => {
    if (r.pre) {
      const n = normRoot(r.pre);
      r.pre = n && n.items.length ? n : undefined;
    }
    sal(r.salida);
  });
  const sal = (s: Salida) => {
    const sr = s as unknown as Record<string, Elem | undefined>;
    for (const f of ['pinR', 'pinZR', 'pinS', 'pin2']) if (sr[f]) sr[f] = normRoot(sr[f]);
    if (s.k === 'TEMP' || s.k === 'CONT' || s.k === 'BIEST') ramas(s.q);
    if (s.k === 'BOX') ramas(s.eno);
  };
  ramas(seg.salidas);
  return seg;
}

const clone = (s: SegmentoKOP): SegmentoKOP => structuredClone(s);

// ───────────── operaciones ─────────────

/** Inserta un elemento en serie antes o después de la selección (o al final de la entrada). */
export function insertSeries(segIn: SegmentoKOP, selId: string | null, e: Elem, side: 'before' | 'after' = 'after'): EditResult {
  const seg = clone(segIn);
  if (selId && selId.includes('#')) {
    const [boxId, field] = selId.split('#');
    const box = findNode(seg, boxId) as unknown as Record<string, Elem | undefined> | null;
    if (box) {
      const cur = box[field];
      box[field] = cur && cur.k === 'SER' ? { ...cur, items: [...cur.items, e] } : ser(...(cur ? [cur] : []), e);
      return { seg: normalize(seg), sel: e.id };
    }
  }
  const loc = selId ? locate(seg, selId) : null;
  if (!loc) {
    (seg.entrada as Ser).items.push(e);
    return { seg: normalize(seg), sel: e.id };
  }
  switch (loc.kind) {
    case 'ser':
      loc.ser.items.splice(side === 'after' ? loc.index + 1 : loc.index, 0, e);
      break;
    case 'par':
      loc.par.ramas[loc.index] = side === 'after' ? ser(loc.node, e) : ser(e, loc.node);
      break;
    case 'root':
      if (side === 'after') loc.node.items.push(e);
      else loc.node.items.unshift(e);
      break;
    case 'salida': {
      const r = loc.ramas[loc.index];
      if (loc.top && loc.ramas.length === 1 && !r.pre) (seg.entrada as Ser).items.push(e);
      else r.pre = r.pre ? (r.pre.k === 'SER' ? { ...r.pre, items: [...r.pre.items, e] } : ser(r.pre, e)) : ser(e);
      break;
    }
  }
  return { seg: normalize(seg), sel: e.id };
}

/** Abre una rama paralela sobre la selección (F8). Si ya es una rama de un paralelo, añade otra. */
export function wrapParallel(segIn: SegmentoKOP, selId: string | null): EditResult {
  const seg = clone(segIn);
  const c: Elem = { k: 'NA', id: newId(), op: '' };
  if (!selId) {
    const ent = seg.entrada as Ser;
    if (!ent.items.length) ent.items.push({ k: 'NA', id: newId(), op: '' });
    const all: Elem = ent.items.length === 1 ? ent.items[0] : ser(...ent.items);
    ent.items = [{ k: 'PAR', id: newId(), ramas: [all, c] }];
    return { seg: normalize(seg), sel: c.id };
  }
  const loc = locate(seg, selId);
  if (!loc) return { seg, sel: selId };
  if (loc.kind === 'salida') {
    const s: Salida = { k: 'BOB', id: newId(), op: '' };
    loc.ramas.splice(loc.index + 1, 0, { salida: s });
    return { seg: normalize(seg), sel: s.id };
  }
  if (loc.kind === 'par') {
    loc.par.ramas.splice(loc.index + 1, 0, c);
    return { seg: normalize(seg), sel: c.id };
  }
  if (loc.kind === 'ser') {
    loc.ser.items[loc.index] = { k: 'PAR', id: newId(), ramas: [loc.node, c] };
    return { seg: normalize(seg), sel: c.id };
  }
  // raíz de una cadena: paralelo de toda la cadena
  const all: Elem = loc.node.items.length === 1 ? loc.node.items[0] : ser(...loc.node.items);
  loc.node.items = [{ k: 'PAR', id: newId(), ramas: [all, c] }];
  return { seg: normalize(seg), sel: c.id };
}

/** Añade una rama al paralelo que contiene la selección (F9). */
export function addBranchToEnclosing(segIn: SegmentoKOP, selId: string): EditResult {
  const seg = clone(segIn);
  const c: Elem = { k: 'NA', id: newId(), op: '' };
  // busca el PAR más cercano que contenga la selección
  let target: Par | null = null;
  const walk = (e: Elem, stack: Par[]): boolean => {
    if (e.id === selId) { target = stack[stack.length - 1] ?? null; return true; }
    if (e.k === 'SER') return e.items.some((x) => walk(x, stack));
    if (e.k === 'PAR') return e.ramas.some((x) => walk(x, [...stack, e]));
    return false;
  };
  walk(seg.entrada, []);
  for (const r of seg.salidas) if (!target && r.pre) walk(r.pre, []);
  if (!target) return wrapParallel(segIn, selId);
  (target as Par).ramas.push(c);
  return { seg: normalize(seg), sel: c.id };
}

/** Añade una salida en paralelo (nueva rama de salida). */
export function addOutput(segIn: SegmentoKOP, s: Salida): EditResult {
  const seg = clone(segIn);
  if (seg.salidas.length === 1 && isSolitaria(seg.salidas[0].salida)) seg.salidas = [];
  if (isSolitaria(s)) seg.salidas = [];
  seg.salidas.push({ salida: s });
  return { seg: normalize(seg), sel: s.id };
}

const isSolitaria = (s: Salida) => s.k === 'JMP' || s.k === 'JMPN' || s.k === 'RET' || s.k === 'CALL';

/** Sustituye la salida seleccionada (o la única) por otra, conservando los contactos delante. */
export function replaceOutput(segIn: SegmentoKOP, selId: string | null, s: Salida): EditResult {
  const seg = clone(segIn);
  const loc = selId ? locate(seg, selId) : null;
  if (loc && loc.kind === 'salida') {
    loc.ramas[loc.index] = { ...loc.ramas[loc.index], salida: s };
    if (isSolitaria(s) && loc.top) seg.salidas = [{ salida: s }];
  } else if (seg.salidas.length === 1) seg.salidas[0] = { ...seg.salidas[0], salida: s };
  else seg.salidas.push({ salida: s });
  return { seg: normalize(seg), sel: s.id };
}

/** Sustituye un nodo por otro (NA ↔ NC, tipo de bobina…), conservando el id. */
export function replaceNode(segIn: SegmentoKOP, id: string, node: Elem | Salida): EditResult {
  const seg = clone(segIn);
  const loc = locate(seg, id);
  if (!loc) return { seg, sel: id };
  if (loc.kind === 'ser') loc.ser.items[loc.index] = node as Elem;
  else if (loc.kind === 'par') loc.par.ramas[loc.index] = node as Elem;
  else if (loc.kind === 'salida') loc.ramas[loc.index] = { ...loc.ramas[loc.index], salida: node as Salida };
  return { seg: normalize(seg), sel: node.id };
}

export function deleteNode(segIn: SegmentoKOP, id: string): EditResult {
  const seg = clone(segIn);
  if (id.includes('#')) {
    const [boxId, field] = id.split('#');
    const box = findNode(seg, boxId) as unknown as Record<string, unknown> | null;
    if (box) {
      if (field === 'q' || field === 'eno') box[field] = undefined;
      else if (field === 'pin2') box[field] = ser();
      else box[field] = undefined;
    }
    return { seg: normalize(seg), sel: boxId };
  }
  const loc = locate(seg, id);
  if (!loc) return { seg, sel: null };
  let next: string | null = null;
  if (loc.kind === 'ser') {
    loc.ser.items.splice(loc.index, 1);
    next = loc.ser.items[Math.min(loc.index, loc.ser.items.length - 1)]?.id ?? null;
  } else if (loc.kind === 'par') {
    loc.par.ramas.splice(loc.index, 1);
    next = loc.par.ramas[Math.max(0, loc.index - 1)]?.id ?? null;
  } else if (loc.kind === 'salida') {
    loc.ramas.splice(loc.index, 1);
    if (loc.top && !seg.salidas.length) {
      const s: Salida = { k: 'BOB', id: newId(), op: '' };
      seg.salidas.push({ salida: s });
      next = s.id;
    }
  } else if (loc.kind === 'root') {
    loc.node.items = [];
  }
  return { seg: normalize(seg), sel: next };
}

/** Cambia un campo de texto (operando) de un nodo: op, mem, in1, in2, t, tw, z, zw, dual, dez, meta, bloque, p.IN… */
export function setField(segIn: SegmentoKOP, id: string, field: string, value: string): SegmentoKOP {
  const seg = clone(segIn);
  if (id === seg.id) {
    if (field === 'meta') seg.meta = value || undefined;
    return seg;
  }
  const n = findNode(seg, id) as unknown as Record<string, unknown> | null;
  if (!n) return seg;
  if (field.startsWith('p.')) {
    const p = { ...(n.p as Record<string, string>) };
    p[field.slice(2)] = value;
    n.p = p;
  } else if (['dual', 'dez', 'zw'].includes(field) && !value.trim()) n[field] = undefined;
  else n[field] = value;
  return seg;
}

/** Conecta un pin booleano de un cuadro (crea una cadena con un contacto vacío). */
export function connectPin(segIn: SegmentoKOP, boxId: string, field: string): EditResult {
  const seg = clone(segIn);
  const n = findNode(seg, boxId) as unknown as Record<string, unknown> | null;
  if (!n) return { seg, sel: null };
  if (field === 'q' || field === 'eno') {
    const s: Salida = { k: 'BOB', id: newId(), op: '' };
    n[field] = [...((n[field] as Rama[] | undefined) ?? []), { salida: s }];
    return { seg, sel: s.id };
  }
  const c: Elem = { k: 'NA', id: newId(), op: '' };
  const cur = n[field] as Elem | undefined;
  n[field] = cur && !isEmptyChain(cur) ? (cur.k === 'SER' ? { ...cur, items: [...cur.items, c] } : ser(cur, c)) : ser(c);
  return { seg: normalize(seg), sel: c.id };
}

// ───────────── fábrica de elementos (catálogo) ─────────────
export type CatalogKind =
  | 'NA' | 'NC' | 'NOT' | 'P' | 'N' | 'POS' | 'NEG' | 'CON' | `CMP:${FnCmp}`
  | 'BOB' | 'S' | 'R' | 'SAVE' | 'SI' | 'SV' | 'SE' | 'SS' | 'SA' | 'ZV' | 'ZR' | 'SZ'
  | 'JMP' | 'JMPN' | 'RET' | 'CALL' | `TEMP:${TempTipo}` | `CONT:${ContTipo}` | 'BIEST:SR' | 'BIEST:RS' | `BOX:${FnBox}`;

export function makeNode(kind: CatalogKind): Elem | Salida {
  const id = newId();
  if (kind.startsWith('CMP:')) return { k: 'CMP', id, fn: kind.slice(4) as FnCmp, in1: '', in2: '' };
  if (kind.startsWith('TEMP:')) return { k: 'TEMP', id, tipo: kind.slice(5) as TempTipo, t: '', tw: '' };
  if (kind.startsWith('CONT:')) return { k: 'CONT', id, tipo: kind.slice(5) as ContTipo, z: '' };
  if (kind.startsWith('BIEST:')) return { k: 'BIEST', id, tipo: kind.slice(6) as 'SR' | 'RS', op: '', pin2: ser({ k: 'NA', id: newId(), op: '' }) };
  if (kind.startsWith('BOX:')) return { k: 'BOX', id, fn: kind.slice(4) as FnBox, p: {} };
  switch (kind) {
    case 'NA': case 'NC': case 'CON': return { k: kind, id, op: '' };
    case 'NOT': return { k: 'NOT', id };
    case 'P': case 'N': return { k: kind, id, mem: '' };
    case 'POS': case 'NEG': return { k: kind, id, op: '', mem: '' };
    case 'BOB': case 'S': case 'R': return { k: kind, id, op: '' };
    case 'SAVE': return { k: 'SAVE', id };
    case 'SI': case 'SV': case 'SE': case 'SS': case 'SA': return { k: kind, id, t: '', tw: '' };
    case 'ZV': case 'ZR': return { k: kind, id, z: '' };
    case 'SZ': return { k: 'SZ', id, z: '', zw: '' };
    case 'JMP': case 'JMPN': return { k: kind, id, meta: '' };
    case 'RET': return { k: 'RET', id };
    case 'CALL': return { k: 'CALL', id, bloque: 'FC 1' };
  }
  return { k: 'NA', id, op: '' };
}

export const isElemKind = (n: Elem | Salida): n is Elem => ['NA', 'NC', 'NOT', 'P', 'N', 'POS', 'NEG', 'CON', 'CMP', 'SER', 'PAR'].includes(n.k);

/** Inserta un nodo del catálogo según su clase: contactos en serie, salidas como salida. */
export function insertFromCatalog(seg: SegmentoKOP, selId: string | null, kind: CatalogKind): EditResult {
  const node = makeNode(kind);
  if (isElemKind(node)) return insertSeries(seg, selId, node, 'after');
  const sel = selId ? findNode(seg, selId) : null;
  // si la selección es una salida vacía o la única bobina sin operando, se sustituye
  if (sel && !isElemKind(sel)) return replaceOutput(seg, selId, node);
  if (seg.salidas.length === 1) {
    const s0 = seg.salidas[0].salida;
    if (s0.k === 'BOB' && !s0.op) return replaceOutput(seg, s0.id, node);
  }
  return addOutput(seg, node);
}

/** Todos los campos de operando editables de un nodo, en orden (para Tab). */
export function operandFields(n: Elem | Salida): string[] {
  switch (n.k) {
    case 'NA': case 'NC': case 'CON': case 'BOB': case 'S': case 'R': return ['op'];
    case 'P': case 'N': return ['mem'];
    case 'POS': case 'NEG': return ['op', 'mem'];
    case 'CMP': return ['in1', 'in2'];
    case 'SI': case 'SV': case 'SE': case 'SS': case 'SA': return ['t', 'tw'];
    case 'ZV': case 'ZR': return ['z'];
    case 'SZ': return ['z', 'zw'];
    case 'JMP': case 'JMPN': return ['meta'];
    case 'CALL': return ['bloque'];
    case 'TEMP': return ['t', 'tw', 'dual', 'dez'];
    case 'CONT': return ['z', 'zw', 'dual', 'dez'];
    case 'BIEST': return ['op'];
    case 'BOX': return [];
  }
  return [];
}
