// Operandos AWL (parse_operand de la referencia)
import { CompileError } from './errors';
import { type CType, parseConstant } from './constants';

export type Area = 'E' | 'A' | 'M' | 'L' | 'PE' | 'PA' | 'DB' | 'DI';
export type OpKind = 'const' | 'status' | 'stw' | 'dbreg' | 'ar' | 'timer' | 'counter' | 'block' | 'bit' | 'mem' | 'label';

export type Indirect = { k: 'mem'; ptr: Op } | { k: 'ar'; reg: 1 | 2; off: number };

export interface Op {
  kind: OpKind;
  text: string;
  area?: Area;
  size?: 1 | 2 | 4;
  byte?: number;
  bit?: number;
  db?: number;
  n?: number;
  value?: number;
  ctype?: CType;
  name?: string;
  ind?: Indirect;
}

export const MEM_PREFIX: Record<string, [Area, 1 | 2 | 4]> = {
  EB: ['E', 1], EW: ['E', 2], ED: ['E', 4],
  AB: ['A', 1], AW: ['A', 2], AD: ['A', 4],
  MB: ['M', 1], MW: ['M', 2], MD: ['M', 4],
  LB: ['L', 1], LW: ['L', 2], LD: ['L', 4],
  PEB: ['PE', 1], PEW: ['PE', 2], PED: ['PE', 4],
  PAB: ['PA', 1], PAW: ['PA', 2], PAD: ['PA', 4],
  DBB: ['DB', 1], DBW: ['DB', 2], DBD: ['DB', 4],
  DIB: ['DI', 1], DIW: ['DI', 2], DID: ['DI', 4],
};
export const BIT_AREAS: Record<string, Area> = { E: 'E', A: 'A', M: 'M', L: 'L', DBX: 'DB', DIX: 'DI' };
export const STATUS_OPS = new Set(['OV', 'OS', 'BIE', '==0', '<>0', '>0', '<0', '>=0', '<=0', 'UO']);
const MEMP = Object.keys(MEM_PREFIX).sort((a, b) => b.length - a.length).join('|');

const RE_TZ = /^(T|Z) ?(\d+)$/;
const RE_BLOCK = /^(FC|FB|SFC|SFB|DB|DI) ?(\d+)$/;
const RE_IND = new RegExp(`^(DBX|DIX|E|A|M|L|${MEMP}) ?\\[(.+)\\]$`);
const RE_IND_AR = /^(AR1|AR2) ?, ?(P#.+)$/;
const RE_DBFULL = /^DB ?(\d+)\.(DBX|DBB|DBW|DBD) ?(\d+)(?:\.([0-7]))?$/;
const RE_BIT = /^(DBX|DIX|E|A|M|L) ?(\d+)\.(\d+)$/;
const RE_MEM = new RegExp(`^(${MEMP}) ?(\\d+)$`);

const EN_RULES: [RegExp, string][] = [
  [/^PIB/i, 'PEB'], [/^PIW/i, 'PEW'], [/^PID/i, 'PED'],
  [/^PQB/i, 'PAB'], [/^PQW/i, 'PAW'], [/^PQD/i, 'PAD'],
  [/^IB/i, 'EB'], [/^IW/i, 'EW'], [/^ID/i, 'ED'],
  [/^QB/i, 'AB'], [/^QW/i, 'AW'], [/^QD/i, 'AD'],
  [/^I(?=\s*[\d[])/i, 'E'], [/^Q(?=\s*[\d[])/i, 'A'],
  [/^C(?=\s*\d+$)/i, 'Z'], [/^BR$/i, 'BIE'],
];

export function translateEnOperand(s: string): string {
  const S = s.trim();
  for (const [pat, rep] of EN_RULES) {
    if (pat.test(S)) return S.replace(pat, rep);
  }
  return S;
}

export type Symbols = Record<string, string> | Map<string, string> | null | undefined;

function lookupSymbol(symbols: Symbols, name: string): string | undefined {
  if (!symbols) return undefined;
  if (symbols instanceof Map) return symbols.get(name);
  return Object.prototype.hasOwnProperty.call(symbols, name) ? symbols[name] : undefined;
}

/** Equivale a str.strip('"') de Python. */
function stripQuotes(s: string): string {
  return s.replace(/^"+/, '').replace(/"+$/, '');
}

export function parseOperand(text: string, symbols?: Symbols, lang: 'de' | 'en' = 'de'): Op | null {
  let s = text.trim();
  if (!s) return null;
  if (s.startsWith('"')) {
    const name = stripQuotes(s);
    const addr = lookupSymbol(symbols, name);
    if (addr === undefined) throw new CompileError(`Símbolo no definido: "${name}"`);
    s = addr;
  }
  if (s.startsWith('#')) throw new CompileError(`Variable local ${s}: el intérprete de referencia no admite interfaces de bloque`);
  if (lang === 'en') s = translateEnOperand(s);
  const S = s.toUpperCase().replace(/\s+/g, ' ').trim();
  const c = parseConstant(s);
  if (c !== null) return { kind: 'const', value: c.value, ctype: c.ctype, text: S };
  if (STATUS_OPS.has(S)) return { kind: 'status', name: S, text: S };
  if (S === 'STW') return { kind: 'stw', text: S };
  if (S === 'DBNO' || S === 'DBLG' || S === 'DINO' || S === 'DILG') return { kind: 'dbreg', name: S, text: S };
  if (S === 'AR1' || S === 'AR2') return { kind: 'ar', n: S === 'AR1' ? 1 : 2, text: S };
  let m = RE_TZ.exec(S);
  if (m) {
    const n = parseInt(m[2], 10);
    if (n > 255) throw new CompileError(`${S}: solo existen T0..T255 / Z0..Z255`);
    return { kind: m[1] === 'T' ? 'timer' : 'counter', n, text: S };
  }
  m = RE_BLOCK.exec(S);
  if (m) return { kind: 'block', name: m[1], n: parseInt(m[2], 10), text: S };
  // Direccionamiento indirecto: MW [MD 30]  ·  E [MD 2]  ·  MW [AR1, P#2.0]
  m = RE_IND.exec(S);
  if (m) {
    const areaTok = m[1];
    const inner = m[2].trim();
    const mi = RE_IND_AR.exec(inner);
    let ind: Indirect;
    if (mi) {
      const off = parseConstant(mi[2])!.value;
      ind = { k: 'ar', reg: mi[1] === 'AR1' ? 1 : 2, off };
    } else {
      const iop = parseOperand(inner);
      if (!iop || iop.kind !== 'mem' || iop.size !== 4 || !['M', 'L', 'DB', 'DI'].includes(iop.area!))
        throw new CompileError(`Puntero indirecto no válido: [${inner}] (usa MD, LD, DBD o DID)`);
      ind = { k: 'mem', ptr: iop };
    }
    if (areaTok in BIT_AREAS) return { kind: 'bit', area: BIT_AREAS[areaTok], ind, text: S };
    const [area, size] = MEM_PREFIX[areaTok];
    return { kind: 'mem', area, size, ind, text: S };
  }
  // Dirección completa de DB: DB1.DBX 2.0 · DB1.DBW 0
  m = RE_DBFULL.exec(S);
  if (m) {
    const db = parseInt(m[1], 10);
    if (m[2] === 'DBX') {
      if (m[4] === undefined) throw new CompileError(`${S}: falta el número de bit`);
      return { kind: 'bit', area: 'DB', db, byte: parseInt(m[3], 10), bit: parseInt(m[4], 10), text: S };
    }
    if (m[4] !== undefined) throw new CompileError(`${S}: un byte/palabra no lleva número de bit`);
    const [area, size] = MEM_PREFIX[m[2]];
    return { kind: 'mem', area, size, db, byte: parseInt(m[3], 10), text: S };
  }
  m = RE_BIT.exec(S);
  if (m) {
    const bit = parseInt(m[3], 10);
    if (bit > 7) throw new CompileError(`${S}: el número de bit va de 0 a 7`);
    return { kind: 'bit', area: BIT_AREAS[m[1]], byte: parseInt(m[2], 10), bit, text: S };
  }
  m = RE_MEM.exec(S);
  if (m) {
    const [area, size] = MEM_PREFIX[m[1]];
    return { kind: 'mem', area, size, byte: parseInt(m[2], 10), text: S };
  }
  throw new CompileError(`Operando no válido: ${text.trim()}`);
}
