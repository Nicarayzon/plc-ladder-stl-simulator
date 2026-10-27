// Compilador: texto AWL → lista de instrucciones (compile_block de la referencia)
import { CompileError } from './errors';
import { EN2DE, JUMPS, MNEMONICS, NEST_OPEN, NO_OPERAND, BITLOGIC, TSTART, WORDLOG, SHIFTS } from './mnemonics';
import { type Op, type Symbols, parseOperand } from './operands';
import { T } from '../i18n';

export type Lang = 'de' | 'en';

/** De dónde viene una instrucción: bloque, segmento, línea AWL o elemento KOP. */
export interface Origin {
  block?: string;
  seg?: string;
  line?: number;
  elem?: string;
  role?: 'key' | 'q' | 'eno' | 'pin' | 'aux';
}

export interface Instr {
  mn: string;
  op: Op | null;
  line: number;
  src: string;
  target: number;
  splCount: number;
  origin?: Origin;
}

export interface CBlock {
  name: string;
  instrs: Instr[];
  labels: Map<string, number>;
}

export interface SourceLine {
  text: string;
  line: number;
  origin?: Origin;
  /** Nemotécnica de esta línea (las del KOP compilado siempre son 'de'). */
  lang?: Lang;
}

export interface CompileIssue {
  line: number;
  msg: string;
  origin?: Origin;
}

const LABEL_RE = /^([A-Za-z_][A-Za-z0-9_]{0,3})\s*:(?!=)\s*(.*)$/;
const LABEL_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,3}$/;
const SKIP_PREFIX = ['NETWORK', 'SEGMENTO', 'TITLE', 'BEGIN', 'END_'];

export function stripComment(line: string): string {
  let out = '';
  let q: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === q) q = null;
    } else if (ch === '"' || ch === "'") {
      q = ch;
    } else if (line.startsWith('//', i)) {
      break;
    }
    out += ch;
  }
  return out;
}

function pyStrip(s: string): string {
  return s.replace(/^\s+|\s+$/g, '');
}

export function cleanLine(raw: string): string {
  return pyStrip(pyStrip(stripComment(raw)).replace(/;+$/, ''));
}

export function splitMnemonic(line: string): [string, string] {
  const t = pyStrip(line);
  const m = /^(\S+)(?:\s+([\s\S]*))?$/.exec(t)!;
  let mn = m[1].toUpperCase();
  let rest = m[2] ? pyStrip(m[2]) : '';
  if (['U', 'UN', 'O', 'ON', 'X', 'XN', 'A', 'AN', 'MCR'].includes(mn) && rest.startsWith('(')) {
    mn += '(';
    rest = pyStrip(rest.slice(1));
  }
  if (mn === ')' && rest.toUpperCase().startsWith('MCR')) {
    mn = ')MCR';
    rest = pyStrip(rest.slice(3));
  }
  return [mn, rest];
}

export function splitLines(text: string): string[] {
  return text.split(/\r\n|[\r\n\v\f\x1c\x1d\x1e\x85\u2028\u2029]/);
}

export interface CompileOptions {
  symbols?: Symbols;
  lang?: Lang;
  /** true: recoge todos los errores (editor). false: lanza el primero (como la referencia). */
  collect?: boolean;
  name?: string;
}

export interface CompileResult {
  block: CBlock;
  errors: CompileIssue[];
}

class LineErr extends Error {}

/** compile_block sobre una lista de líneas con origen. */
export function compileLines(lines: SourceLine[], opts: CompileOptions = {}): CompileResult {
  const { symbols, lang = 'de', collect = false, name = 'OB1' } = opts;
  const instrs: Instr[] = [];
  const labels = new Map<string, number>();
  let pending: string[] = [];
  const pendingSet = new Set<string>();
  let depth = 0;
  const errors: CompileIssue[] = [];

  const fail = (sl: SourceLine | null, msg: string): never => {
    const issue: CompileIssue = { line: sl ? sl.line : 0, msg, origin: sl?.origin };
    if (!collect) throw new CompileError(sl ? T.motor.linea(sl.line, msg) : msg);
    errors.push(issue);
    throw new LineErr(msg);
  };

  for (const sl of lines) {
    try {
      let line = cleanLine(sl.text);
      if (!line) continue;
      const up = line.toUpperCase();
      if (SKIP_PREFIX.some((p) => up.startsWith(p))) continue;
      const lm = LABEL_RE.exec(line);
      if (lm) {
        const lname = lm[1].toUpperCase();
        if (labels.has(lname) || pendingSet.has(lname)) fail(sl, T.motor.metaDuplicada(lname));
        pending.push(lname);
        pendingSet.add(lname);
        line = pyStrip(lm[2]);
        if (!line) continue;
      }
      let [mn, rest] = splitMnemonic(line);
      const llang = sl.lang ?? lang;
      if (llang === 'en') mn = EN2DE[mn] ?? mn;
      if (!MNEMONICS.has(mn)) fail(sl, T.motor.desconocida(mn));
      if (mn === 'ENT' || mn === 'LEAVE') fail(sl, T.motor.cuatroAcus(mn));
      let op: Op | null = null;
      if (JUMPS.has(mn)) {
        if (!LABEL_NAME.test(rest)) fail(sl, T.motor.metaValida(mn));
        op = { kind: 'label', name: rest.toUpperCase(), text: rest.toUpperCase() };
      } else if (rest) {
        try {
          op = parseOperand(rest, symbols, llang);
        } catch (e) {
          if (e instanceof CompileError) fail(sl, e.message);
          throw e;
        }
      }
      const k = op ? op.kind : null;
      const need = (...kinds: string[]) => {
        if (!kinds.includes(k as string)) fail(sl, T.motor.operandoNoValidoPara(mn, rest));
      };

      if (BITLOGIC.has(mn)) {
        if (op === null) {
          if (mn === 'O') mn = 'O0';
          else fail(sl, T.motor.necesitaOperando(mn));
        } else need('bit', 'timer', 'counter', 'status');
      } else if (NO_OPERAND.has(mn)) {
        if (op !== null) fail(sl, T.motor.sinOperando(mn));
      } else if (mn === '=') need('bit');
      else if (mn === 'S') need('bit', 'counter');
      else if (mn === 'R') need('bit', 'timer', 'counter');
      else if (mn === 'FP' || mn === 'FN') need('bit');
      else if (TSTART.has(mn)) need('timer');
      else if (mn === 'FR') need('timer', 'counter');
      else if (mn === 'ZV' || mn === 'ZR') need('counter');
      else if (mn === 'L') {
        need('const', 'mem', 'timer', 'counter', 'stw', 'dbreg');
        if (k === 'mem' && op!.area === 'PA') fail(sl, T.motor.paNoLeer);
      } else if (mn === 'LC') need('timer', 'counter');
      else if (mn === 'T') {
        need('mem', 'stw');
        if (k === 'mem' && op!.area === 'PE') fail(sl, T.motor.peNoEscribir);
      } else if (WORDLOG.has(mn) || SHIFTS.has(mn)) {
        if (op !== null) need('const');
      } else if (mn === 'INC' || mn === 'DEC') {
        need('const');
        if (op!.value! > 255) fail(sl, T.motor.constante255(mn));
      } else if (mn === '+') need('const');
      else if (mn === 'NOP' || mn === 'BLD') need('const');
      else if (mn === 'LAR1' || mn === 'LAR2') {
        if (op !== null) need('const', 'mem', 'ar');
      } else if (mn === 'TAR1' || mn === 'TAR2') {
        if (op !== null) need('mem', 'ar');
      } else if (mn === '+AR1' || mn === '+AR2') {
        if (op !== null) need('const');
      } else if (mn === 'AUF') {
        need('block');
        if (op!.name !== 'DB' && op!.name !== 'DI') fail(sl, T.motor.aufDbDi);
      } else if (mn === 'UC' || mn === 'CC' || mn === 'CALL') {
        need('block');
        if (op!.name !== 'FC' && op!.name !== 'SFC') fail(sl, T.motor.soloFc);
      }

      if (NEST_OPEN.has(mn)) depth += 1;
      else if (mn === ')') {
        depth -= 1;
        if (depth < 0) {
          depth = 0;
          fail(sl, T.motor.cierraSinAbrir);
        }
      }
      const ins: Instr = { mn, op, line: sl.line, src: pyStrip(sl.text), target: -1, splCount: 0, origin: sl.origin };
      for (const p of pending) labels.set(p, instrs.length);
      pending = [];
      pendingSet.clear();
      instrs.push(ins);
    } catch (e) {
      if (e instanceof LineErr) continue;
      throw e;
    }
  }

  if (pending.length) {
    for (const p of pending) labels.set(p, instrs.length);
    const last = lines.length ? lines[lines.length - 1].origin : undefined;
    instrs.push({ mn: 'NOP', op: { kind: 'const', value: 0, ctype: 'INT', text: '0' }, line: 0, src: 'NOP 0', target: -1, splCount: 0, origin: last });
  }
  if (depth !== 0) {
    const msg = T.motor.faltaCerrar;
    if (!collect) throw new CompileError(msg);
    errors.push({ line: 0, msg });
  }
  for (let i = 0; i < instrs.length; i++) {
    const ins = instrs[i];
    if (!JUMPS.has(ins.mn)) continue;
    const lname = ins.op!.name!;
    const tgt = labels.get(lname);
    if (tgt === undefined) {
      const msg = T.motor.metaNoExiste(lname);
      if (!collect) throw new CompileError(T.motor.linea(ins.line, msg));
      errors.push({ line: ins.line, msg, origin: ins.origin });
      continue;
    }
    ins.target = tgt;
    if (ins.mn === 'SPL') {
      const count = tgt - (i + 1);
      let bad = count < 0;
      for (let j = i + 1; j < tgt && !bad; j++) if (instrs[j].mn !== 'SPA') bad = true;
      if (bad) {
        const msg = T.motor.spl;
        if (!collect) throw new CompileError(T.motor.linea(ins.line, msg));
        errors.push({ line: ins.line, msg, origin: ins.origin });
        continue;
      }
      ins.splCount = count;
    }
  }
  return { block: { name, instrs, labels }, errors };
}

export function textToLines(text: string, origin?: Origin): SourceLine[] {
  return splitLines(text).map((t, i) => ({ text: t, line: i + 1, origin: origin ? { ...origin, line: i + 1 } : undefined }));
}

/** compile_block(text) de la referencia: lanza CompileError con «Línea n: …» en el primer error. */
export function compileBlockText(text: string, symbols?: Symbols, lang: Lang = 'de', name = 'OB1'): CBlock {
  return compileLines(textToLines(text), { symbols, lang, name }).block;
}

export interface CompiledProgram {
  blocks: Map<string, CBlock>;
}

export function normBlockName(k: string): string {
  return k.toUpperCase().replace(/\s+/g, '');
}

/** Igual que el constructor de CPU de la referencia: texto (OB1) o {'OB1': ..., 'FC1': ...}. */
export function compileProgramText(blocks: string | Record<string, string>, symbols?: Symbols, lang: Lang = 'de'): CompiledProgram {
  const dict = typeof blocks === 'string' ? { OB1: blocks } : blocks;
  const out = new Map<string, CBlock>();
  for (const [k, v] of Object.entries(dict)) {
    const n = normBlockName(k);
    out.set(n, compileBlockText(v, symbols, lang, n));
  }
  if (!out.has('OB1')) throw new CompileError(T.motor.faltaOb1);
  return { blocks: out };
}
