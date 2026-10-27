// Explicaciones automáticas de cada fila de la traza
import type { TraceRow } from './cpu';
import { cleanLine, splitMnemonic } from './compiler';
import { s16, s32 } from './num';
import { T as TX } from '../i18n';

const LABEL_RE = /^([A-Za-z_][A-Za-z0-9_]{0,3})\s*:(?!=)\s*(.*)$/;

/** Operando de la fila tal como lo escribió el alumno, compactado («E 0.2» → «E0.2»). */
export function rowOperand(src: string): string {
  let line = cleanLine(src);
  const m = LABEL_RE.exec(line);
  if (m) line = m[2];
  if (!line) return '';
  const [, rest] = splitMnemonic(line);
  return compact(rest);
}

export const compact = (op: string) => op.replace(/^([A-Za-z]+)\s+(\d)/, '$1$2');

const b = (v: number) => String(v);
const neg = (mn: string) => mn.endsWith('N') || mn.endsWith('N(');

function logicSentence(r: TraceRow, op: string): string {
  const X = TX.traza;
  const mn = r.mn;
  const v = r.opVal ?? r.sta;
  const isNeg = neg(mn);
  const x = isNeg ? v ^ 1 : v;
  const xs = isNeg ? `NOT ${op} = ¬${v} = ${x}` : `${op} = ${v}`;
  const base = mn[0];
  const sym = base === 'U' ? '∧' : base === 'O' ? '∨' : '⊕';
  if (r.or_antes && base === 'U') return X.orA1;
  if (!r.er_antes) {
    if (r.or_antes) return X.primeraConOr(xs);
    return X.primera(xs);
  }
  const inner = base === 'U' ? r.rlo_antes & x : base === 'O' ? r.rlo_antes | x : r.rlo_antes ^ x;
  if (r.or_antes) return X.conOr(r.rlo_antes, sym, x);
  void inner;
  return X.combina(sym, isNeg ? `¬${op}` : op, r.rlo_antes, x, r.rlo);
}

const CMP_TXT: Record<string, string> = { '==': '=', '<>': '≠', '>': '>', '<': '<', '>=': '≥', '<=': '≤' };

function acuVal(v: number, typ: string): string {
  if (typ === 'I') return String(s16(v));
  if (typ === 'D') return String(s32(v));
  return String(v);
}

export function explainRow(r: TraceRow): string {
  const X = TX.traza;
  const mn = r.mn;
  const op = rowOperand(r.instr);
  const T = (n: number) => (n ? X.si : X.no);
  switch (mn) {
    case 'U': case 'UN': case 'O': case 'ON': case 'X': case 'XN':
      return logicSentence(r, op);
    case 'O0':
      if (!r.er_antes) return X.o0SinCadena;
      return X.o0(r.rlo_antes);
    case 'U(': case 'UN(': case 'O(': case 'ON(': case 'X(': case 'XN(':
      return X.abreParentesis(r.rlo_antes, r.or_antes, r.er_antes);
    case ')': {
      const n = r.nest;
      if (!n) return X.cierraParentesis;
      const k = n.kind;
      const sym = k[0] === 'U' ? '∧' : k[0] === 'O' ? '∨' : '⊕';
      const innerTxt = neg(k) ? `¬(${r.rlo_antes})` : `(${r.rlo_antes})`;
      if (!n.fc) return X.cierraSinCadena(innerTxt, r.rlo);
      return X.cierraCombina(n.rlo, sym, innerTxt, r.rlo);
    }
    case '=':
      return X.asigna(op, r.sta);
    case 'S':
      if (/^Z/i.test(op)) return r.rlo_antes ? X.sContador(op) : X.sNada(op);
      return r.rlo_antes ? X.sPone(op) : X.sNoHace(op, r.sta);
    case 'R':
      return r.rlo_antes ? X.rPone(op) : X.rNoHace;
    case 'NOT': return X.not(r.rlo_antes, r.rlo);
    case 'SET': return X.set;
    case 'CLR': return X.clr;
    case 'SAVE': return X.save(r.br);
    case 'FP':
      return X.fp(r.sta, op, r.opVal ?? '?', r.rlo);
    case 'FN':
      return X.fn(r.sta, op, r.opVal ?? '?', r.rlo);
    case 'L':
      return X.l(r.acu1_antes, op, r.acu1);
    case 'LC':
      return X.lc(op, (r.acu1 & 0xFFFF).toString(16).toUpperCase().padStart(4, '0'));
    case 'T':
      return X.t(op, r.acu1);
    case 'SI': case 'SV': case 'SE': case 'SS': case 'SA': {
      const nm: Record<string, string> = X.temporizadores;
      return X.temporizador(mn, op, nm[mn], r.rlo, mn === 'SA' ? (r.rlo ? X.saS1 : X.saFlanco) : r.rlo ? X.tArranca : mn === 'SI' || mn === 'SE' ? X.tPara : X.tNoPara);
    }
    case 'FR': return X.fr(op);
    case 'ZV': return r.rlo ? X.zv(op) : X.zvNo(op);
    case 'ZR': return r.rlo ? X.zr(op) : X.zrNo(op);
  }
  if (/^(==|<>|>=|<=|>|<)[IDR]$/.test(mn)) {
    const typ = mn[mn.length - 1];
    const rel = mn.slice(0, -1);
    return X.compara(acuVal(r.acu2, typ), CMP_TXT[rel], acuVal(r.acu1, typ), T(r.rlo), r.rlo, !!r.er_antes);
  }
  if (mn === '+I' || mn === '-I' || mn === '*I' || mn === '/I') {
    const a = s16(r.acu2);
    const bb = s16(r.acu1_antes);
    const exact = mn === '+I' ? a + bb : mn === '-I' ? a - bb : mn === '*I' ? a * bb : bb === 0 ? NaN : Math.trunc(a / bb);
    const sym = mn[0] === '*' ? '×' : mn[0] === '/' ? '÷' : mn[0] === '-' ? '−' : '+';
    if (mn === '/I' && bb === 0) return X.divCero;
    if (r.ov) return X.noCabe(a, sym, bb, exact, mn === '*I' ? r.acu1 : r.acu1_int);
    if (mn === '/I') return X.divide(a, bb, r.acu1_int, s16(r.acu1 >>> 16));
    return X.aritmetica(sym, a, bb, mn === '*I' ? r.acu1 : r.acu1_int);
  }
  if (['+D', '-D', '*D', '/D', 'MOD'].includes(mn)) return X.op32(r.acu1, !!r.ov);
  if (['+R', '-R', '*R', '/R', 'SQR', 'SQRT', 'EXP', 'LN', 'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN', 'ABS'].includes(mn)) return X.real(!!r.ov);
  if (mn.startsWith('SP') || mn === 'LOOP') {
    if (mn === 'SPA') return X.spa(op);
    if (mn === 'SPB' || mn === 'SPBB') return r.jumped ? X.spbSalta(op) : X.spbNo(mn);
    if (mn === 'SPBN' || mn === 'SPBNB') return r.jumped ? X.spbnSalta(op) : X.spbnNo(mn);
    if (mn === 'LOOP') return r.jumped ? X.loop(r.acu1_int & 0xFFFF, op) : X.loopFin;
    return r.jumped ? X.saltoSi(op) : X.saltoNo;
  }
  if (mn === 'BEB') return r.rlo_antes ? X.bebSi : X.bebNo;
  if (mn === 'BE' || mn === 'BEA') return X.be;
  if (mn === 'UC' || mn === 'CALL') return X.llama(op);
  if (mn === 'CC') return r.rlo_antes ? X.ccSi(op) : X.ccNo(op);
  if (['ITB', 'BTI', 'ITD', 'DTR', 'RND', 'TRUNC', 'RND+', 'RND-', 'BTD', 'DTB', 'INVI', 'INVD', 'NEGI', 'NEGD', 'NEGR', 'CAW', 'CAD'].includes(mn))
    return X.conversion(mn, r.acu1, !!r.ov);
  if (['UW', 'OW', 'XOW', 'UD', 'OD', 'XOD'].includes(mn)) return X.palabras((r.acu1 >>> 0).toString(16).toUpperCase(), r.cc1);
  if (['SLW', 'SRW', 'SSI', 'SLD', 'SRD', 'SSD', 'RLD', 'RRD', 'RLDA', 'RRDA'].includes(mn)) return X.desplaza(r.acu1, r.cc1);
  if (mn === 'TAK') return X.tak;
  if (mn === 'INC' || mn === 'DEC') return X.incDec(mn, r.acu1 & 0xFF);
  if (mn === '+') return X.suma(r.acu1);
  if (mn === 'AUF') return X.auf(op);
  if (mn === 'NOP' || mn === 'BLD') return X.nada;
  return '';
}
