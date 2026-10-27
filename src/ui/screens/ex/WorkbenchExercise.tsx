// Ejercicio resuelto en el banco de trabajo: Ejemplos, Traduce y Programa
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import type { Ejercicio } from '../../../content/banco';
import { inputTypesFor } from '../../../content/banco';
import { gradeProgram, type Grade } from '../../../content/grading';
import { compileProgram, type Programa } from '../../../core/program';
import type { CompiledProgram } from '../../../core/compiler';
import { checkEquivalence, describeCounterexample, type EquivResult, type Counterexample } from '../../../core/equivalence';
import { lintProgram } from '../../../core/lint';
import { applyStep } from '../../../core/testrunner';
import { testWrite } from '../../../core/testio';
import { Workbench } from '../../workbench/Workbench';
import { useWorkbenchSim } from '../../workbench/useWorkbenchSim';
import { emptyWbState, type WbState } from '../../workbench/types';
import { useProgress } from '../../../store/progress';
import { ExerciseShell, GradeReport } from './common';
import { Icon } from '../../common/Icon';
import { toast } from '../../common/ui';
import type { ProgramIssue } from '../../../core/program';
import { T } from '../../../i18n';
import { displayOperand } from '../../../core/translate';
import { useSettings } from '../../../store/settings';

export interface ExResult { g: Grade; eq: EquivResult | null; lints: ProgramIssue[]; nota: number }

interface Props {
  e: Ejercicio;
  back: string;
  initial: () => Programa;
  solution?: CompiledProgram | null;
  withEquivalence?: boolean;
  left: (res: ExResult | null) => ReactNode;
  extraActions?: (ctl: { load: (p: Programa) => void }) => ReactNode;
}

export function WorkbenchExercise({ e, back, initial, solution, withEquivalence, left, extraActions }: Props) {
  const { borradores, guardarBorrador, borrarBorrador, registrar, visto } = useProgress();
  const [gen, setGen] = useState(0);
  const draft = borradores[e.id];
  const [prog, setProg] = useState<Programa>(() => draft?.programa ?? initial());
  const [wb, setWb] = useState<WbState>(() => draft?.wb ?? emptyWbState());
  const [res, setRes] = useState<ExResult | null>(null);
  const [busy, setBusy] = useState(false);
  const inputs = useMemo(() => inputTypesFor(e), [e]);
  const sim = useWorkbenchSim(`ex-${e.id}-${gen}`, prog, wb, { inputs });
  const first = useRef(true);

  useEffect(() => { visto(e.id); }, [e.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => guardarBorrador(e.id, prog, wb), 600);
    return () => clearTimeout(t);
  }, [prog, wb]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = (p: Programa) => {
    setProg(p);
    setWb(emptyWbState());
    setRes(null);
    setGen((g) => g + 1);
  };

  const check = async () => {
    const pc = compileProgram(prog);
    if (!pc.cp) {
      toast(T.ejercicio.conErrores(pc.errors[0]?.full ?? ''));
      return;
    }
    setBusy(true);
    try {
      const g = gradeProgram(pc.cp, e, (k) => displayOperand(k, prog.nemotecnia));
      let eq: EquivResult | null = null;
      if (withEquivalence && solution) {
        const obs = [...new Set((e.prueba?.pasos ?? []).flatMap((p) => Object.keys(p.esperar ?? {})))];
        eq = await checkEquivalence(pc.cp, solution, { observables: obs, inicial: e.prueba?.inicial, cycleMs: e.prueba?.ciclo_ms ?? 10 });
      }
      const nc = [...inputs.entries()].filter(([, t]) => t === 'NC').map(([k]) => k);
      const lints = lintProgram(prog, pc, { ncInputs: nc });
      let nota = g.nota;
      if (eq && !eq.equivalente) nota *= 0.8;
      registrar(e.id, nota);
      setRes({ g, eq, lints, nota });
    } finally {
      setBusy(false);
    }
  };

  const replay = () => {
    if (!res?.g.failStep || !e.prueba) return;
    const cpu = sim.cpu;
    sim.pause();
    cpu.mres();
    cpu.restart();
    sim.lastStop = null;
    sim.analyzer.clear();
    const keys = new Set<string>();
    for (const p of e.prueba.pasos.slice(0, res.g.failStep)) {
      for (const k of [...Object.keys(p.poner ?? {}), ...(p.pulso ? [p.pulso] : []), ...Object.keys(p.esperar ?? {})]) keys.add(displayOperand(k.replace(/:.*/, '').replace(/^([A-Z]+)(\d)/, '$1 $2'), prog.nemotecnia));
    }
    for (const s of [...sim.analyzer.signals]) sim.analyzer.remove(s.id);
    for (const k of keys) { try { sim.analyzer.add(k, sim.compiled.symbols); } catch { /* */ } }
    for (const [k, v] of Object.entries(e.prueba.inicial ?? {})) testWrite(cpu, k, v);
    for (const p of e.prueba.pasos.slice(0, res.g.failStep)) applyStep(cpu, p);
    sim.bump();
    toast(T.ejercicio.reproducida(res.g.failStep));
  };

  return (
    <ExerciseShell e={e} back={back}
      actions={(
        <>
          {extraActions?.({ load })}
          <button className="btn" onClick={() => { if (confirm(T.ejercicio.volverInicial)) { borrarBorrador(e.id); load(initial()); } }}><Icon name="refresh" size={14} />{T.ejercicio.restaurar}</button>
          <button className="btn primary" onClick={check} disabled={busy}><Icon name="check" size={14} />{busy ? T.ejercicio.comprobando : T.ejercicio.comprobar}</button>
        </>
      )}
      left={(
        <>
          {res && (
            <GradeReport g={{ ...res.g, nota: res.nota }} onReplay={replay} extra={(
              <>
                {res.eq && (res.eq.equivalente
                  ? <div className="ok-text" style={{ marginTop: 8 }}>{T.ejercicio.equivalente(res.eq.modo === 'combinacional' ? T.ejercicio.combinaciones(res.eq.probados) : T.ejercicio.pasosAleatorios(res.eq.probados), !!res.eq.aproximado)}</div>
                  : <div style={{ marginTop: 8 }}><b>{T.ejercicio.noEquivalente}</b><CounterexampleView c={res.eq.contraejemplo!} /></div>)}
                {res.lints.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {res.lints.map((l, i) => <div key={i} className="warn-text" style={{ fontSize: 12.5 }}>⚠ {l.full}</div>)}
                  </div>
                )}
              </>
            )} />
          )}
          {left(res)}
        </>
      )}
      right={<Workbench compact layoutKey="ex" sim={sim} programa={prog} onChange={setProg} wbState={wb} onWbState={setWb} ncInputs={[...inputs.entries()].filter(([, t]) => t === 'NC').map(([k]) => k)} />}
    />
  );
}

/** Cronograma estático del contraejemplo de la equivalencia. */
export function CounterexampleView({ c }: { c: Counterexample }) {
  // las entradas y salidas, con la nemotecnia elegida (E0.0 → I0.0 con la inglesa)
  const nemotecnia = useSettings((s) => s.nemotecnia);
  const ver = (k: string) => displayOperand(k, nemotecnia);
  const outs = c.outputs.filter((k) => c.alumno[k].some((v, i) => v !== c.solucion[k][i]) || c.outputs.length <= 3);
  const n = c.steps.length;
  const cell = (v: number) => (Number.isNaN(v) ? '—' : String(v));
  let t = 0;
  const times = c.steps.map((s) => { const r = t; t += s.ciclos * c.cycleMs; return r; });
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12.5, marginBottom: 6 }}>{describeCounterexample(c, ver)}</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl" style={{ width: 'auto', fontFamily: 'var(--mono)', fontSize: 11.5 }}>
          <thead>
            <tr><th>{T.ejercicio.paso}</th>{c.steps.map((_, i) => <th key={i} className="num">{i + 1}</th>)}</tr>
            <tr><th>t (ms)</th>{times.map((x, i) => <th key={i} className="num" style={{ fontWeight: 400 }}>{x}</th>)}</tr>
          </thead>
          <tbody>
            {c.inputs.map((k) => (
              <tr key={k}><td><b>{ver(k)}</b></td>{c.steps.map((s, i) => <td key={i} className="num">{cell(s.inputs[k] ?? 0)}</td>)}</tr>
            ))}
            {outs.map((k) => (
              <tr key={`o${k}`}>
                <td><b>{ver(k)}</b><div className="faint" style={{ fontSize: 10 }}>{T.ejercicio.tuyoSolucion}</div></td>
                {c.alumno[k].map((v, i) => {
                  const bad = v !== c.solucion[k][i] && !(Number.isNaN(v) && Number.isNaN(c.solucion[k][i]));
                  return <td key={i} className="num" style={bad ? { background: 'var(--err-bg)', color: 'var(--err)' } : undefined}>{cell(v)} / {cell(c.solucion[k][i])}</td>;
                })}
              </tr>
            ))}
            {c.stateAlumno.some((s, i) => s !== c.stateSolucion[i]) && (
              <tr><td><b>CPU</b></td>{c.stateAlumno.map((s, i) => <td key={i} className="num">{s}/{c.stateSolucion[i]}</td>)}</tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>{T.ejercicio.cadaPaso(c.steps.map((s) => s.ciclos).join(', '), c.cycleMs)}</div>
      <span style={{ display: 'none' }}>{n}</span>
    </div>
  );
}
