// Equivalencia de dos programas (alumno frente a solución)
import type { CompiledProgram } from './compiler';
import { CPU } from './cpu';
import { analyzeUsage, inputBits, outputBits, outputWords, analogInputs, bitKey, type Usage } from './usage';
import { Rng } from './rng';
import { testRead, testWrite, type TestValue } from './testio';

export interface EquivOptions {
  /** Entradas adicionales (por ejemplo, marcas que el ejercicio usa como entrada): «M0.0», «MW10» */
  extraInputs?: string[];
  /** Observables adicionales (claves de `esperar` de las pruebas) */
  observables?: string[];
  inicial?: Record<string, TestValue>;
  cycleMs?: number;
  seed?: number;
  walks?: number;
  steps?: number;
  onProgress?: (p: number) => void;
}

export interface EqStep { inputs: Record<string, number>; ciclos: number }

export interface Counterexample {
  steps: EqStep[];
  inputs: string[];
  outputs: string[];
  alumno: Record<string, number[]>;
  solucion: Record<string, number[]>;
  stateAlumno: string[];
  stateSolucion: string[];
  diff: { step: number; key: string; alumno: number | string; solucion: number | string };
  cycleMs: number;
}

export interface EquivResult {
  equivalente: boolean;
  modo: 'combinacional' | 'secuencial';
  probados: number;
  aproximado: boolean;
  contraejemplo?: Counterexample;
  inputs: string[];
  outputs: string[];
}

function isCombinational(u: Usage): boolean {
  if (u.usesTimersOrCounters || u.usesEdges || u.usesSetReset) return false;
  const written = new Set<string>();
  for (const a of u.accesses) if (a.mode !== 'r') written.add(a.kind === 'bit' ? bitKey(a.area, a.byte, a.bit) : `${a.area}${a.byte}:${a.size}`);
  for (const a of u.accesses) {
    if (a.mode === 'w') continue;
    if (a.area === 'E' || a.area === 'PE') continue;
    if (a.indirect) return false;
    if (a.kind === 'bit' && written.has(bitKey(a.area, a.byte, a.bit))) return false;
    if (a.kind === 'mem') {
      // lectura de algo que también se escribe (memoria entre ciclos)
      for (const w of u.accesses) if (w.mode !== 'r' && w.area === a.area && w.kind !== 'timer' && w.kind !== 'counter' && w.byte < a.byte + a.size && a.byte < w.byte + Math.max(1, w.size)) return false;
    }
  }
  return true;
}

function constants(cp: CompiledProgram): number[] {
  const out = new Set<number>([0]);
  for (const [, b] of cp.blocks) for (const ins of b.instrs) {
    const op = ins.op;
    if (op?.kind === 'const' && (op.ctype === 'INT' || op.ctype === 'DINT')) {
      const v = op.ctype === 'INT' ? ((op.value! << 16) >> 16) : op.value! | 0;
      out.add(v); out.add(v - 1); out.add(v + 1);
    }
  }
  return [...out];
}

const keyOfBit = (k: string) => k; // «E0.0»

export async function checkEquivalence(alumno: CompiledProgram, solucion: CompiledProgram, opts: EquivOptions = {}): Promise<EquivResult> {
  const cycleMs = opts.cycleMs ?? 10;
  const ua = analyzeUsage(alumno);
  const us = analyzeUsage(solucion);
  const aproximado = ua.hasIndirect || us.hasIndirect;
  // entradas
  const bits = new Set<string>([...inputBits(ua), ...inputBits(us)]);
  const words = new Set<string>([...analogInputs(ua), ...analogInputs(us)].map((w) => w.replace(' ', '')));
  for (const x of opts.extraInputs ?? []) {
    const k = x.replace(/\s+/g, '');
    if (/^[EAM]\d+\.\d$/.test(k)) bits.add(k);
    else words.add(k);
  }
  const inputs = [...bits].map(keyOfBit);
  const wordInputs = [...words];
  // observables
  const outs = new Set<string>([...outputBits(us)]);
  for (const w of outputWords(us)) outs.add(w.replace(' ', ''));
  for (const o of opts.observables ?? []) outs.add(o.replace(/\s+/g, ''));
  const outputs = [...outs];
  const cands = [...new Set([...constants(alumno), ...constants(solucion)])];
  const analogCands = [0, 13824, 27648, ...cands.filter((c) => c >= 0 && c <= 32767)];

  const mkCpus = () => {
    const a = new CPU(alumno, { cycleMs });
    const s = new CPU(solucion, { cycleMs });
    for (const [k, v] of Object.entries(opts.inicial ?? {})) { testWrite(a, k, v); testWrite(s, k, v); }
    return [a, s] as const;
  };
  const read = (c: CPU, k: string): number => {
    try { return testRead(c, k); } catch { return NaN; }
  };
  const compare = (a: CPU, s: CPU): { key: string; a: number | string; s: number | string } | null => {
    if (a.state !== s.state) return { key: 'estado', a: a.state, s: s.state };
    for (const k of outputs) {
      const va = read(a, k);
      const vs = read(s, k);
      if (!(va === vs || (Number.isNaN(va) && Number.isNaN(vs)) || (k.endsWith(':REAL') && Math.abs(va - vs) <= 1e-3))) return { key: k, a: va, s: vs };
    }
    return null;
  };
  const apply = (c: CPU, inp: Record<string, number>) => { for (const [k, v] of Object.entries(inp)) testWrite(c, k, v); };

  /** Ejecuta una secuencia y devuelve el primer paso que difiere (o -1). */
  const runSeq = (steps: EqStep[]): number => {
    const [a, s] = mkCpus();
    for (let i = 0; i < steps.length; i++) {
      apply(a, steps[i].inputs); apply(s, steps[i].inputs);
      for (let j = 0; j < steps[i].ciclos; j++) { a.scan(); s.scan(); }
      if (compare(a, s)) return i;
    }
    return -1;
  };

  const shrink = (steps: EqStep[]): EqStep[] => {
    let cur = steps.slice(0, runSeq(steps) + 1);
    const t0 = performance.now();
    const ok = () => performance.now() - t0 < 2500;
    const tryCand = (cand: EqStep[]): boolean => {
      const d = runSeq(cand);
      if (d >= 0) { cur = cand.slice(0, d + 1); return true; }
      return false;
    };
    let improved = true;
    while (improved && ok()) {
      improved = false;
      // 1) quitar bloques de pasos (delta debugging)
      let chunk = Math.max(1, Math.ceil(cur.length / 2));
      while (chunk >= 1 && ok()) {
        let removed = false;
        for (let i = 0; i < cur.length && ok();) {
          const cand = [...cur.slice(0, i), ...cur.slice(i + chunk)];
          if (cand.length && tryCand(cand)) { removed = true; improved = true; } else i += chunk;
        }
        if (!removed) chunk = Math.floor(chunk / 2);
      }
      // 2) menos ciclos por paso
      for (let i = 0; i < cur.length && ok(); i++) {
        while (cur[i] && cur[i].ciclos > 1 && ok()) {
          const cand = cur.map((s, j) => (j === i ? { ...s, ciclos: Math.max(1, Math.floor(s.ciclos / 2)) } : s));
          if (!tryCand(cand)) break;
          improved = true;
        }
      }
      // 3) deshacer cambios de entradas (valor del paso anterior o 0 en el primero)
      for (let i = 0; i < cur.length && ok(); i++) {
        for (const k of Object.keys(cur[i].inputs)) {
          const prev = i === 0 ? 0 : cur[i - 1].inputs[k];
          if (cur[i].inputs[k] === prev) continue;
          const cand = cur.map((s, j) => (j === i ? { ...s, inputs: { ...s.inputs, [k]: prev } } : s));
          if (tryCand(cand)) improved = true;
        }
      }
      // 4) fusionar pasos consecutivos con las mismas entradas
      const merged: EqStep[] = [];
      for (const st of cur) {
        const last = merged[merged.length - 1];
        if (last && Object.keys(st.inputs).every((k) => st.inputs[k] === last.inputs[k])) last.ciclos += st.ciclos;
        else merged.push({ inputs: { ...st.inputs }, ciclos: st.ciclos });
      }
      if (merged.length < cur.length && runSeq(merged) >= 0) { cur = merged; improved = true; }
    }
    return cur;
  };

  const explain = (steps: EqStep[]): Counterexample => {
    const [a, s] = mkCpus();
    const al: Record<string, number[]> = {};
    const so: Record<string, number[]> = {};
    for (const k of outputs) { al[k] = []; so[k] = []; }
    const sa: string[] = [];
    const ss: string[] = [];
    let diff: Counterexample['diff'] = { step: steps.length - 1, key: '', alumno: 0, solucion: 0 };
    steps.forEach((st, i) => {
      apply(a, st.inputs); apply(s, st.inputs);
      for (let j = 0; j < st.ciclos; j++) { a.scan(); s.scan(); }
      for (const k of outputs) { al[k].push(read(a, k)); so[k].push(read(s, k)); }
      sa.push(a.state); ss.push(s.state);
      const d = compare(a, s);
      if (d && !diff.key) diff = { step: i, key: d.key, alumno: d.a, solucion: d.s };
    });
    const changing = [...inputs, ...wordInputs].filter((k) => new Set(steps.map((x) => x.inputs[k])).size > 1 || steps.some((x) => x.inputs[k]));
    return { steps, inputs: changing, outputs, alumno: al, solucion: so, stateAlumno: sa, stateSolucion: ss, diff, cycleMs };
  };

  const allInputs = [...inputs, ...wordInputs];
  const base = (): Record<string, number> => {
    const r: Record<string, number> = {};
    for (const k of allInputs) {
      const v = opts.inicial?.[k] ?? opts.inicial?.[k.replace(/^([A-Z]+)/, '$1 ')];
      r[k] = typeof v === 'number' ? v : 0;
    }
    return r;
  };

  // ───── combinacional ─────
  if (isCombinational(ua) && isCombinational(us) && !wordInputs.length) {
    const n = inputs.length;
    const total = n <= 12 ? 2 ** n : 4096;
    const rng = new Rng(opts.seed ?? 0x5EED);
    const [a, s] = mkCpus();
    for (let i = 0; i < total; i++) {
      const inp: Record<string, number> = {};
      inputs.forEach((k, j) => { inp[k] = n <= 12 ? (i >> j) & 1 : rng.int(0, 1); });
      apply(a, inp); apply(s, inp);
      a.scan(); s.scan();
      if (compare(a, s)) {
        const steps = [{ inputs: inp, ciclos: 1 }];
        return { equivalente: false, modo: 'combinacional', probados: i + 1, aproximado, contraejemplo: explain(steps), inputs, outputs };
      }
      if (i % 512 === 511) { opts.onProgress?.(i / total); await new Promise((r) => setTimeout(r)); }
    }
    return { equivalente: true, modo: 'combinacional', probados: total, aproximado, inputs, outputs };
  }

  // ───── secuencial ─────
  const walks = opts.walks ?? 20;
  const nSteps = opts.steps ?? 300;
  const rng = new Rng(opts.seed ?? 0x5EED);
  let probados = 0;
  for (let w = 0; w < walks; w++) {
    const steps: EqStep[] = [];
    let cur = base();
    const [a, s] = mkCpus();
    for (let i = 0; i < nSteps; i++) {
      const next = { ...cur };
      for (const k of inputs) if (rng.chance(0.1)) next[k] = next[k] ? 0 : 1;
      for (const k of wordInputs) if (rng.chance(0.1)) next[k] = k.startsWith('PE') ? rng.pick(analogCands) : rng.pick(cands);
      const r = rng.next();
      const ciclos = r < 0.7 ? 1 : r < 0.9 ? 10 : Math.ceil(rng.int(50, 500) / cycleMs);
      steps.push({ inputs: next, ciclos });
      cur = next;
      apply(a, next); apply(s, next);
      for (let j = 0; j < ciclos; j++) { a.scan(); s.scan(); }
      probados++;
      if (compare(a, s)) {
        const small = shrink(steps);
        return { equivalente: false, modo: 'secuencial', probados, aproximado, contraejemplo: explain(small), inputs: allInputs, outputs };
      }
    }
    opts.onProgress?.((w + 1) / walks);
    await new Promise((r) => setTimeout(r));
  }
  return { equivalente: true, modo: 'secuencial', probados, aproximado, inputs: allInputs, outputs };
}

/** Frase para el alumno a partir del contraejemplo. */
export function describeCounterexample(c: Counterexample): string {
  const d = c.diff;
  if (d.key === 'estado') return `Con esta secuencia tu CPU queda en ${d.alumno} y la de la solución en ${d.solucion}.`;
  const v = (x: number | string) => (typeof x === 'number' && Number.isNaN(x) ? '—' : String(x));
  if (/^\w+\d+\.\d$/.test(d.key)) {
    return `Con esta secuencia tu ${d.key} ${d.alumno === 1 ? 'se enciende' : 'se apaga'} y el de la solución ${d.solucion === 1 ? 'se enciende' : 'no'} (paso ${d.step + 1}).`;
  }
  return `Con esta secuencia tu ${d.key} vale ${v(d.alumno)} y el de la solución ${v(d.solucion)} (paso ${d.step + 1}).`;
}
