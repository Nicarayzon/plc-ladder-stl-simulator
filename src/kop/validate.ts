// Reglas de validación KOP
import { parseOperand, type Op, type Symbols } from '../core/operands';
import type { Elem, Rama, Salida, SegmentoKOP } from './model';
import { BOX_DEFS, isSolitaria } from './model';

export interface KopIssue { id: string; field?: string; msg: string; severity: 'error' | 'aviso' }

type Kind = 'bitTZ' | 'bit' | 'bitRTZ' | 'timer' | 'counter' | 'word' | 'dword' | 'real' | 's5' | 'zw' | 'in' | 'out' | 'block';

function check(op: string, kind: Kind, symbols?: Symbols): string | null {
  if (!op.trim()) return 'falta el operando';
  let o: Op | null;
  try {
    o = parseOperand(op, symbols);
  } catch (e) {
    return (e as Error).message;
  }
  if (!o) return 'falta el operando';
  const isMem = (sizes: number[]) => o!.kind === 'mem' && sizes.includes(o!.size!);
  switch (kind) {
    case 'bitTZ': return ['bit', 'timer', 'counter', 'status'].includes(o.kind) ? null : `${o.text} no es un bit, T ni Z`;
    case 'bit': return o.kind === 'bit' ? null : `${o.text} no es un bit`;
    case 'bitRTZ': return ['bit', 'timer', 'counter'].includes(o.kind) ? null : `${o.text} no es un bit, T ni Z`;
    case 'timer': return o.kind === 'timer' ? null : `${o.text} no es un temporizador (T n)`;
    case 'counter': return o.kind === 'counter' ? null : `${o.text} no es un contador (Z n)`;
    case 'word': return isMem([2]) || (o.kind === 'const' && ['INT', 'WORD'].includes(o.ctype!)) ? null : `${o.text}: hace falta una palabra o un INT`;
    case 'dword': return isMem([4]) || (o.kind === 'const' && ['DINT', 'DWORD', 'INT'].includes(o.ctype!)) ? null : `${o.text}: hace falta una doble palabra o un DINT`;
    case 'real': return isMem([4]) || (o.kind === 'const' && ['REAL', 'DINT', 'DWORD'].includes(o.ctype!)) ? null : `${o.text}: hace falta una doble palabra o un REAL`;
    case 's5': return isMem([2]) || (o.kind === 'const' && o.ctype === 'S5TIME') ? null : `${o.text}: el tiempo se da como S5T#… o como palabra`;
    case 'zw': return isMem([2]) || (o.kind === 'const' && (o.ctype === 'BCD' || o.ctype === 'WORD')) ? null : `${o.text}: el valor de contaje se da como C#… o como palabra`;
    case 'in': return o.kind === 'mem' || o.kind === 'const' || o.kind === 'timer' || o.kind === 'counter' ? null : `${o.text} no es un valor`;
    case 'out': return o.kind === 'mem' ? null : `${o.text}: la salida tiene que ser un byte, palabra o doble palabra`;
    case 'block': return o.kind === 'block' && o.name === 'FC' ? null : `${o.text}: solo se puede llamar a FC n`;
  }
  return null;
}

export function validateSegment(seg: SegmentoKOP, symbols?: Symbols): KopIssue[] {
  const out: KopIssue[] = [];
  const req = (id: string, field: string, op: string | undefined, kind: Kind) => {
    const m = check(op ?? '', kind, symbols);
    if (m) out.push({ id, field, msg: m, severity: 'error' });
  };
  const opt = (id: string, field: string, op: string | undefined, kind: Kind) => {
    if (op && op.trim()) req(id, field, op, kind);
  };
  const firstOf = (e: Elem): Elem | null => (e.k === 'SER' ? (e.items[0] ? firstOf(e.items[0]) : null) : e);
  const needsLeft = (e: Elem | null) => !!e && ['NOT', 'P', 'N', 'CON'].includes(e.k);

  const elem = (e: Elem) => {
    switch (e.k) {
      case 'NA': case 'NC': req(e.id, 'op', e.op, 'bitTZ'); break;
      case 'CON': req(e.id, 'op', e.op, 'bit'); break;
      case 'P': case 'N': req(e.id, 'mem', e.mem, 'bit'); break;
      case 'POS': case 'NEG': req(e.id, 'op', e.op, 'bitTZ'); req(e.id, 'mem', e.mem, 'bit'); break;
      case 'CMP': {
        const k: Kind = e.fn.endsWith('I') ? 'word' : e.fn.endsWith('D') ? 'dword' : 'real';
        req(e.id, 'in1', e.in1, k);
        req(e.id, 'in2', e.in2, k);
        break;
      }
      case 'SER': e.items.forEach(elem); break;
      case 'PAR':
        if (e.ramas.length < 2) out.push({ id: e.id, msg: 'un paralelo necesita al menos 2 ramas', severity: 'error' });
        for (const b of e.ramas) {
          if (b.k === 'SER' && !b.items.length) out.push({ id: e.id, msg: 'hay una rama paralela vacía', severity: 'error' });
          if (needsLeft(firstOf(b))) out.push({ id: firstOf(b)!.id, msg: 'NOT, P, N y el conector necesitan lógica a su izquierda', severity: 'error' });
          elem(b);
        }
        break;
    }
  };
  const ramas = (rs: Rama[] | undefined) => rs?.forEach((r) => { if (r.pre) elem(r.pre); salida(r.salida); });
  const chainPin = (c: Elem | undefined) => {
    if (!c) return;
    if (needsLeft(firstOf(c))) out.push({ id: firstOf(c)!.id, msg: 'NOT, P, N y el conector necesitan lógica a su izquierda', severity: 'error' });
    elem(c);
  };
  const salida = (s: Salida) => {
    switch (s.k) {
      case 'BOB': case 'S': req(s.id, 'op', s.op, 'bit'); break;
      case 'R': req(s.id, 'op', s.op, 'bitRTZ'); break;
      case 'SI': case 'SV': case 'SE': case 'SS': case 'SA': req(s.id, 't', s.t, 'timer'); req(s.id, 'tw', s.tw, 's5'); break;
      case 'ZV': case 'ZR': req(s.id, 'z', s.z, 'counter'); break;
      case 'SZ': req(s.id, 'z', s.z, 'counter'); req(s.id, 'zw', s.zw, 'zw'); break;
      case 'JMP': case 'JMPN':
        if (!/^[A-Za-z][A-Za-z0-9_]{0,3}$/.test(s.meta)) out.push({ id: s.id, field: 'meta', msg: 'la meta tiene de 1 a 4 caracteres y empieza por letra', severity: 'error' });
        break;
      case 'CALL': req(s.id, 'bloque', s.bloque, 'block'); break;
      case 'TEMP':
        req(s.id, 't', s.t, 'timer'); req(s.id, 'tw', s.tw, 's5'); opt(s.id, 'dual', s.dual, 'out'); opt(s.id, 'dez', s.dez, 'out');
        chainPin(s.pinR); ramas(s.q);
        break;
      case 'CONT':
        req(s.id, 'z', s.z, 'counter');
        if (s.pinS) req(s.id, 'zw', s.zw, 'zw');
        opt(s.id, 'dual', s.dual, 'out'); opt(s.id, 'dez', s.dez, 'out');
        chainPin(s.pinZR); chainPin(s.pinS); chainPin(s.pinR); ramas(s.q);
        break;
      case 'BIEST': req(s.id, 'op', s.op, 'bit'); chainPin(s.pin2); ramas(s.q); break;
      case 'BOX': {
        const d = BOX_DEFS[s.fn];
        for (const n of d.ins) req(s.id, `p.${n}`, s.p[n], 'in');
        for (const n of d.outs) req(s.id, `p.${n}`, s.p[n], 'out');
        ramas(s.eno);
        break;
      }
    }
  };

  if (needsLeft(firstOf(seg.entrada))) out.push({ id: firstOf(seg.entrada)!.id, msg: 'NOT, P, N y el conector necesitan lógica a su izquierda', severity: 'error' });
  elem(seg.entrada);
  if (seg.salidas.some((r) => isSolitaria(r.salida)) && (seg.salidas.length > 1 || seg.salidas[0].pre))
    out.push({ id: seg.salidas.find((r) => isSolitaria(r.salida))!.salida.id, msg: 'los saltos, RET y CALL van solos en su segmento', severity: 'error' });
  if (seg.meta && (!/^[A-Za-z][A-Za-z0-9_]{0,3}$/.test(seg.meta))) out.push({ id: seg.id, field: 'meta', msg: 'la meta tiene de 1 a 4 caracteres y empieza por letra (no por _)', severity: 'error' });
  ramas(seg.salidas);
  return out;
}
