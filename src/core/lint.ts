// Avisos didácticos (análisis estático)
import type { Instr } from './compiler';
import { CMP, JUMPS } from './mnemonics';
import { clockByteOf, segId, segTitulo, type Programa, type ProgramCompile, type ProgramIssue } from './program';
import type { CompiledProgram } from './compiler';
import { analyzeUsage, bitKey } from './usage';
import { normBlockName } from './compiler';
import { T } from '../i18n';

export interface LintOptions { ncInputs?: string[] }

export const LINT_REF: Record<string, string> = {
  B01: '§5.4', B02: '§5.2', B03: '§2.4', L01: '§9.1', L02: '§7.11', L03: '§9.16', L04: '§6.6', L05: '§3.3', L06: '§9.17', L07: '§2.2', L08: '§1.3', L09: '§7.15', L10: '',
};

const opKey = (ins: Instr) => ins.op?.text.replace(/\s+/g, '') ?? '';

export function lintProgram(p: Programa, pc: ProgramCompile, opts: LintOptions = {}): ProgramIssue[] {
  if (!pc.cp) return [];
  const out: ProgramIssue[] = [];
  const where = (ins: Instr) => {
    const o = ins.origin;
    const b = p.bloques.find((x) => normBlockName(x.nombre) === o?.block);
    const si = b ? b.segmentos.findIndex((s) => segId(s) === o?.seg) : -1;
    const s = b && si >= 0 ? b.segmentos[si] : undefined;
    const t = s ? segTitulo(s) : undefined;
    return { block: o?.block ?? '', seg: o?.seg, segIndex: si >= 0 ? si : undefined, txt: T.lint.donde(o?.block ?? '', si >= 0 ? si + 1 : null, t, o?.line && s?.lang === 'AWL' ? o.line : undefined) };
  };
  const add = (id: string, ins: Instr, msg: string) => {
    const w = where(ins);
    out.push({ block: w.block, seg: w.seg, segIndex: w.segIndex, line: ins.origin?.line ?? 0, origin: ins.origin, msg: `${id}: ${msg}`, severity: 'aviso', full: `${id} · ${w.txt}: ${msg}${T.lint.verTeoria(LINT_REF[id])}` });
  };

  const all: { block: string; ins: Instr; pc: number }[] = [];
  for (const [name, b] of pc.cp.blocks) b.instrs.forEach((ins, i) => all.push({ block: name, ins, pc: i }));
  const isTemp = (ins: Instr) => ins.op?.kind === 'bit' && ins.op.area === 'L' && ins.origin?.elem !== undefined;

  // L01: = del mismo bit en dos sitios
  const assigns = new Map<string, Instr[]>();
  for (const { ins } of all) {
    if (ins.mn === '=' && ins.op?.kind === 'bit' && !ins.op.ind && !isTemp(ins)) {
      const k = opKey(ins);
      assigns.set(k, [...(assigns.get(k) ?? []), ins]);
    }
  }
  for (const [k, list] of assigns) if (list.length > 1) add('L01', list[list.length - 1], T.lint.L01(k, list.length));

  // L02: comparación con /ER = 1 (sustituye al RLO)
  for (const [, b] of pc.cp.blocks) {
    const targets = new Set(b.labels.values());
    let fc: 0 | 1 | -1 = 0;
    b.instrs.forEach((ins, i) => {
      if (targets.has(i)) fc = -1;
      const mn = ins.mn;
      if (CMP.has(mn) && fc === 1) add('L02', ins, T.lint.L02);
      if (['U', 'UN', 'O', 'ON', 'X', 'XN', 'FP', 'FN', ')'].includes(mn) || CMP.has(mn)) fc = 1;
      else if (['=', 'S', 'R', 'SET', 'CLR', 'O0', 'SI', 'SV', 'SE', 'SS', 'SA', 'ZV', 'ZR', 'FR', 'BEB', 'MCR(', ')MCR', 'CC', 'UC', 'CALL', 'U(', 'UN(', 'O(', 'ON(', 'X(', 'XN('].includes(mn)) fc = 0;
      else if (JUMPS.has(mn)) fc = mn === 'SPA' || mn === 'SPL' ? -1 : ['SPB', 'SPBN', 'SPBB', 'SPBNB', 'SPBI', 'SPBIN'].includes(mn) ? 0 : fc;
    });
  }

  // L03: misma marca de flanco en dos FP/FN, o escrita en otro sitio
  const edges = new Map<string, Instr[]>();
  for (const { ins } of all) if ((ins.mn === 'FP' || ins.mn === 'FN') && !ins.op?.ind) edges.set(opKey(ins), [...(edges.get(opKey(ins)) ?? []), ins]);
  for (const [k, list] of edges) {
    if (list.length > 1) add('L03', list[1], T.lint.L03(k, list.length));
    const other = all.find(({ ins }) => ['=', 'S', 'R'].includes(ins.mn) && opKey(ins) === k);
    if (other) add('L03', other.ins, T.lint.L03b(k));
  }

  // L04: temporizador arrancado en más de un sitio
  const starts = new Map<string, Instr[]>();
  for (const { ins } of all) if (['SI', 'SV', 'SE', 'SS', 'SA'].includes(ins.mn)) starts.set(opKey(ins), [...(starts.get(opKey(ins)) ?? []), ins]);
  for (const [k, list] of starts) if (list.length > 1) add('L04', list[1], T.lint.L04(k.replace(/^T/, 'T '), list.length));

  // L05: L <entero> justo antes de arrancar un temporizador
  for (const [, b] of pc.cp.blocks) {
    b.instrs.forEach((ins, i) => {
      if (!['SI', 'SV', 'SE', 'SS', 'SA'].includes(ins.mn) || i === 0) return;
      const prev = b.instrs[i - 1];
      if (prev.mn === 'L' && prev.op?.kind === 'const' && (prev.op.ctype === 'INT' || prev.op.ctype === 'DINT'))
        add('L05', prev, T.lint.L05(prev.op.text));
    });
  }

  // L06: lectura de datos locales antes de escribirlos
  for (const [, b] of pc.cp.blocks) {
    const written = new Set<number>();
    for (const ins of b.instrs) {
      const op = ins.op;
      if (!op || op.ind || op.area !== 'L') continue;
      const bytes = op.kind === 'bit' ? [op.byte!] : op.kind === 'mem' ? Array.from({ length: op.size! }, (_, j) => op.byte! + j) : [];
      const reads = ['U', 'UN', 'O', 'ON', 'X', 'XN', 'L', 'FP', 'FN'].includes(ins.mn);
      if (reads && bytes.some((x) => !written.has(x)) && !(ins.mn === 'FP' || ins.mn === 'FN')) {
        add('L06', ins, T.lint.L06(op.text));
        bytes.forEach((x) => written.add(x));
      }
      if (['=', 'S', 'R', 'T', 'FP', 'FN'].includes(ins.mn)) bytes.forEach((x) => written.add(x));
    }
  }

  // L07: palabras solapadas
  const words = new Map<string, { start: number; size: number; ins: Instr }>();
  for (const { ins } of all) {
    const op = ins.op;
    if (op?.kind !== 'mem' || op.ind || op.area !== 'M' || op.size! < 2) continue;
    words.set(`${op.byte}:${op.size}`, { start: op.byte!, size: op.size!, ins });
  }
  const wl = [...words.values()].sort((a, b) => a.start - b.start);
  const reported = new Set<string>();
  for (let i = 0; i < wl.length; i++) {
    for (let j = i + 1; j < wl.length; j++) {
      const a = wl[i];
      const c = wl[j];
      if (c.start >= a.start + a.size) break;
      if (a.start === c.start) continue;
      const key = `${a.start}-${c.start}`;
      if (reported.has(key)) continue;
      reported.add(key);
      const shared = Array.from({ length: a.start + a.size - c.start }, (_, k) => `MB ${c.start + k}`).slice(0, 3).join(', ');
      add('L07', c.ins, T.lint.L07(a.ins.op!.text, c.ins.op!.text, shared));
    }
  }

  // L08: UN sobre una entrada cableada como NC
  const nc = new Set((opts.ncInputs ?? []).map((k) => k.replace(/\s+/g, '')));
  if (nc.size) {
    for (const { ins } of all) {
      if ((ins.mn === 'UN' || ins.mn === 'ON') && ins.op?.kind === 'bit' && nc.has(opKey(ins)))
        add('L08', ins, T.lint.L08(opKey(ins)));
    }
  }

  // L09: LOOP cuyo contador puede valer 0
  for (const [, b] of pc.cp.blocks) {
    b.instrs.forEach((ins, i) => {
      if (ins.mn !== 'LOOP') return;
      const t = ins.target;
      if (t <= 0) return;
      const init = b.instrs[t - 1];
      if (init?.mn !== 'L') return;
      if (init.op?.kind === 'const') {
        if ((init.op.value! & 0xFFFF) === 0) add('L09', init, T.lint.L09);
        return;
      }
      const guard = b.instrs.slice(Math.max(0, t - 8), t).some((x) => ['SPZ', 'SPB', 'SPBN', 'SPMZ', 'SPPZ', 'SPN', 'SPP', 'BEB'].includes(x.mn));
      if (!guard) add('L09', init, T.lint.L09b(init.op?.text ?? ''));
      void i;
    });
  }
  // B01: FC que no se llama desde ningún bloque · B02: asignaciones en el OB100 (solo primer ciclo)
  const called = new Set<string>();
  for (const { ins } of all) if (['UC', 'CC', 'CALL'].includes(ins.mn) && ins.op?.kind === 'block') called.add(`${ins.op.name}${ins.op.n}`);
  for (const [name, b] of pc.cp.blocks) {
    const first = b.instrs.find((i) => i.line > 0 || i.origin?.elem);
    if (!first) continue;
    if (name.startsWith('FC') && !called.has(name)) add('B01', first, T.lint.B01(name, name.replace('FC', 'FC ')));
    if (name === 'OB100' && b.instrs.some((i) => i.mn === '=' || i.mn === 'T')) add('B02', first, T.lint.B02);
  }
  // B03: marcas que se consultan pero que el programa nunca escribe (¿marca de ciclo sin activar?)
  for (const m of marcasNuncaEscritas(pc.cp, clockByteOf(p))) {
    const ins = all.find(({ ins: i }) => i.op?.kind === 'bit' && i.op.area === 'M' && !i.op.ind && bitKey('M', i.op.byte!, i.op.bit!) === m.key)?.ins;
    if (ins) add('B03', ins, T.lint.B03(m.key.replace('M', 'M '), m.byte));
  }
  return out;
}

/** Marcas (bits) que el programa consulta pero no escribe nunca, fuera del byte de la marca de ciclo. */
export function marcasNuncaEscritas(cp: CompiledProgram, clockByte: number | null): { key: string; byte: number }[] {
  const u = analyzeUsage(cp);
  const escritos = new Set<number>();
  let indirecto = false;
  for (const a of u.accesses) {
    if (a.area !== 'M') continue;
    if (a.indirect) { indirecto = true; continue; }
    if (a.mode === 'r') continue;
    const n = a.kind === 'bit' ? 1 : a.size;
    for (let b = a.byte; b < a.byte + n; b++) escritos.add(b);
  }
  if (indirecto) return []; // con direccionamiento indirecto no se puede saber
  const out = new Map<string, { key: string; byte: number }>();
  for (const a of u.accesses) {
    if (a.area !== 'M' || a.kind !== 'bit' || a.indirect || a.mode !== 'r') continue;
    if (escritos.has(a.byte) || a.byte === clockByte) continue;
    const key = bitKey('M', a.byte, a.bit);
    out.set(key, { key, byte: a.byte });
  }
  return [...out.values()];
}
