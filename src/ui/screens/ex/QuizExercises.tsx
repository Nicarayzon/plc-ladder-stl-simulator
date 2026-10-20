// Predice, Traza y Cronograma
import { useEffect, useMemo, useState } from 'react';
import type { Ejercicio } from '../../../content/banco';
import { cutAtDetails, enunciado, solucion, stripAllBlocks, stripYaml } from '../../../content/markdown';
import { compileProgramText } from '../../../core/compiler';
import { CPU, type TraceRow } from '../../../core/cpu';
import { applyStep, runChronoTest, traceOneCycle } from '../../../core/testrunner';
import { splitKey, testRead, testWrite } from '../../../core/testio';
import { parseConstant } from '../../../core/constants';
import { explainRow } from '../../../core/explain';
import { describeStep } from '../../../content/grading';
import { kopModel } from '../../../content/kop/models';
import { useProgress } from '../../../store/progress';
import { Markdown } from '../../common/Markdown';
import { AwlHighlight } from '../../common/AwlHighlight';
import { KopStatic } from '../../../kop/render/KopStatic';
import { ExerciseShell } from './common';
import { Icon } from '../../common/Icon';
import { ProbarButton } from '../Probar';

export function parseAnswer(t: string, tipo: string | null): number | null {
  const s = t.trim().replace(',', '.');
  if (!s) return null;
  if (tipo === 'REAL') {
    const v = parseFloat(s);
    return Number.isNaN(v) ? null : v;
  }
  try {
    const c = parseConstant(s);
    if (c) {
      if (c.ctype === 'INT') return (c.value << 16) >> 16;
      if (c.ctype === 'DINT') return c.value | 0;
      return c.value;
    }
  } catch { /* */ }
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

export function answerOk(actual: number, ans: number | null, tipo: string | null, size: number): boolean {
  if (ans === null) return false;
  if (tipo === 'REAL') return Math.abs(actual - ans) <= 1e-3;
  if (actual === ans) return true;
  const mask = size === 4 ? 0xFFFFFFFF : size === 1 ? 0xFF : 0xFFFF;
  return ((actual >>> 0) & mask) === ((ans >>> 0) & mask);
}

export const keySize = (k: string) => (/^(MD|ED|AD|DB\d+\.DBD|PED)/i.test(k) ? 4 : /^(MB|EB|AB|PEB)/i.test(k) ? 1 : /\d\.\d/.test(k) ? 0 : 2);

export function TraceTable({ rows, cols, expected }: { rows: TraceRow[]; cols?: string[]; expected?: Record<string, number | string>[] }) {
  const cs = cols ?? ['er_antes', 'rlo', 'sta', 'or', 'ov', 'os', 'cc1', 'cc0', 'br', 'acu1', 'acu2'];
  const head: Record<string, string> = { er_antes: '/ER antes', rlo: 'RLO', sta: 'STA', or: 'OR', ov: 'OV', os: 'OS', cc1: 'A1', cc0: 'A0', br: 'RB', acu1: 'ACU1', acu2: 'ACU2', acu1_int: 'ACU1 (INT)', acu2_int: 'ACU2 (INT)' };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tbl trace-tbl">
        <thead><tr><th>Instrucción</th>{cs.map((c) => <th key={c}>{head[c] ?? c}</th>)}<th>Explicación</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.instr.replace(/\s*\/\/.*$/, '').replace(/\s+/g, ' ')}</td>
              {cs.map((c) => <td key={c} style={expected && expected[i]?.[c] !== undefined ? { fontWeight: 700 } : undefined}>{String((r as unknown as Record<string, number>)[c])}</td>)}
              <td className="expl">{explainRow(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Valores reales de cada paso de un ejercicio «predice». */
export function prediceActual(e: Ejercicio): Record<string, number | string>[] {
  const cpu = new CPU(compileProgramText(e.awl ?? ''), { cycleMs: e.prueba?.ciclo_ms ?? 10 });
  for (const [k, v] of Object.entries(e.prueba?.inicial ?? {})) testWrite(cpu, k, v);
  return (e.prueba?.pasos ?? []).map((p) => {
    applyStep(cpu, p);
    const vals: Record<string, number | string> = {};
    for (const k of Object.keys(p.esperar ?? {})) vals[k] = testRead(cpu, k);
    if (p.esperar_estado) vals.__estado = cpu.state;
    return vals;
  });
}

// ───────────── Predice ─────────────
export function PrediceEx({ e, back }: { e: Ejercicio; back: string }) {
  const { registrar, visto } = useProgress();
  useEffect(() => { visto(e.id); }, [e.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const pasos = e.prueba?.pasos ?? [];
  const [ans, setAns] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const actual = useMemo(() => prediceActual(e), [e]);
  const trace = useMemo(() => {
    const ini = { ...(e.prueba?.inicial ?? {}), ...(pasos[0]?.poner ?? {}) };
    try { return traceOneCycle(e.awl ?? '', ini).rows; } catch { return []; }
  }, [e]); // eslint-disable-line react-hooks/exhaustive-deps

  const cells: { i: number; k: string; ok: boolean }[] = [];
  pasos.forEach((p, i) => {
    for (const k of Object.keys(p.esperar ?? {})) {
      const [, tipo] = splitKey(k);
      cells.push({ i, k, ok: answerOk(actual[i][k] as number, parseAnswer(ans[`${i}|${k}`] ?? '', tipo), tipo, keySize(k)) });
    }
    if (p.esperar_estado) cells.push({ i, k: '__estado', ok: (ans[`${i}|__estado`] ?? '') === actual[i].__estado });
  });
  const score = cells.length ? cells.filter((c) => c.ok).length / cells.length : 0;
  const check = () => { setChecked(true); registrar(e.id, score); };

  return (
    <ExerciseShell e={e} back={back}
      actions={(
        <>
          <ProbarButton code={e.awl ?? ''} title={`${e.id} — ${e.titulo}`} />
          <button className="btn" onClick={() => { setAns({}); setChecked(false); }}><Icon name="refresh" size={14} />Borrar</button>
          <button className="btn primary" onClick={check}><Icon name="check" size={14} />Comprobar</button>
        </>
      )}
      left={(
        <>
          <Markdown text={enunciado(e)} />
          {checked && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 14, margin: '0 0 6px' }}>Solución</h3>
              <Markdown text={cutAtDetails(stripYaml(e.markdown)).after.replace(/<\/?details>|<summary>[^<]*<\/summary>/g, '')} />
            </div>
          )}
        </>
      )}
      right={(
        <div style={{ padding: '16px 20px', maxWidth: 980 }}>
          <h3 style={{ fontSize: 15, marginBottom: 4 }}>Tu predicción</h3>
          <p className="muted" style={{ marginTop: 0 }}>Escribe cuánto vale cada operando tras cada paso (decimal, W#16#…, 16#… o REAL).</p>
          {e.prueba?.inicial && <p className="mono" style={{ fontSize: 12.5 }}>Al empezar: {Object.entries(e.prueba.inicial).map(([k, v]) => `${k} = ${v}`).join(', ')}</p>}
          {pasos.map((p, i) => (
            <div key={i} className="card card-pad" style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Paso {i + 1}: {describeStep(p, e.prueba?.ciclo_ms)}</div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 14 }}>
                {Object.keys(p.esperar ?? {}).map((k) => {
                  const c = cells.find((x) => x.i === i && x.k === k)!;
                  return (
                    <label key={k} className="row" style={{ gap: 6 }}>
                      <span className="mono" style={{ fontWeight: 600 }}>{k} =</span>
                      <input className={`input mono ans-input ${checked ? (c.ok ? 'right' : 'wrong') : ''}`} value={ans[`${i}|${k}`] ?? ''} disabled={checked}
                        onChange={(ev) => setAns({ ...ans, [`${i}|${k}`]: ev.target.value })} aria-label={`${k} tras el paso ${i + 1}`} />
                      {checked && !c.ok && <span className="ok-text mono">{String(actual[i][k])}</span>}
                    </label>
                  );
                })}
                {p.esperar_estado && (
                  <label className="row" style={{ gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>CPU en</span>
                    <select className={`input ans-input ${checked ? (cells.find((x) => x.i === i && x.k === '__estado')!.ok ? 'right' : 'wrong') : ''}`} value={ans[`${i}|__estado`] ?? ''} disabled={checked}
                      onChange={(ev) => setAns({ ...ans, [`${i}|__estado`]: ev.target.value })}>
                      <option value="">—</option><option>RUN</option><option>STOP</option>
                    </select>
                    {checked && !cells.find((x) => x.i === i && x.k === '__estado')!.ok && <span className="ok-text">{String(actual[i].__estado)}</span>}
                  </label>
                )}
              </div>
            </div>
          ))}
          {checked && (
            <>
              <div className={`grade ${score === 1 ? 'ok' : 'bad'}`}><span className="grade-big">{score === 1 ? '¡Correcto!' : `${cells.filter((c) => c.ok).length} de ${cells.length} valores correctos`}</span></div>
              {trace.length > 0 && <><h3 style={{ fontSize: 14, margin: '16px 0 6px' }}>Traza del primer ciclo (paso 1)</h3><TraceTable rows={trace} /></>}
            </>
          )}
        </div>
      )} />
  );
}

// ───────────── Traza ─────────────
const BIT_COLS = new Set(['er_antes', 'rlo', 'sta', 'or', 'ov', 'os', 'cc1', 'cc0', 'br']);

export function TrazaEx({ e, back }: { e: Ejercicio; back: string }) {
  const { registrar, visto } = useProgress();
  useEffect(() => { visto(e.id); }, [e.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const filas = e.traza?.filas ?? [];
  const cols = useMemo(() => {
    const order = ['er_antes', 'rlo', 'sta', 'or', 'ov', 'os', 'cc1', 'cc0', 'br', 'acu1', 'acu2', 'acu1_int', 'acu2_int'];
    const set = new Set(filas.flatMap((f) => Object.keys(f)).filter((k) => k !== 'i'));
    return order.filter((c) => set.has(c));
  }, [filas]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const rows = useMemo(() => { try { return traceOneCycle(e.awl ?? '', e.traza?.inicial).rows; } catch { return []; } }, [e]);
  const head: Record<string, string> = { er_antes: '/ER antes', rlo: 'RLO', sta: 'STA', or: 'OR', ov: 'OV', os: 'OS', cc1: 'A1', cc0: 'A0', br: 'RB', acu1: 'ACU1', acu2: 'ACU2', acu1_int: 'ACU1 INT', acu2_int: 'ACU2 INT' };
  let total = 0;
  let good = 0;
  filas.forEach((f, i) => cols.forEach((c) => {
    if (f[c] === undefined) return;
    total++;
    if (String(f[c]) === (vals[`${i}|${c}`] ?? '').trim()) good++;
  }));
  const check = () => { setChecked(true); registrar(e.id, total ? good / total : 0); };
  return (
    <ExerciseShell e={e} back={back}
      actions={(
        <>
          <ProbarButton code={e.awl ?? ''} title={`${e.id} — ${e.titulo}`} />
          <button className="btn" onClick={() => { setVals({}); setChecked(false); }}><Icon name="refresh" size={14} />Borrar</button>
          <button className="btn primary" onClick={check}><Icon name="check" size={14} />Comprobar</button>
        </>
      )}
      left={(
        <>
          <Markdown text={enunciado(e)} />
          {e.traza?.inicial && <p className="mono" style={{ fontSize: 13 }}><b>Estado inicial:</b> {Object.entries(e.traza.inicial).map(([k, v]) => `${k} = ${v}`).join(', ')}</p>}
          <p className="faint" style={{ fontSize: 12 }}>Al empezar el OB1 la palabra de estado y los acumuladores valen 0. «/ER antes» es el valor antes de la instrucción; el resto, después.</p>
        </>
      )}
      right={(
        <div style={{ padding: '16px 20px' }}>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Rellena la traza</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl trace-tbl">
              <thead><tr><th>Instrucción</th>{cols.map((c) => <th key={c}>{head[c]}</th>)}{checked && <th>Explicación</th>}</tr></thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={i}>
                    <td>{String(f.i)}</td>
                    {cols.map((c) => {
                      if (f[c] === undefined) return <td key={c} className="faint">·</td>;
                      const k = `${i}|${c}`;
                      const v = vals[k] ?? '';
                      const ok = String(f[c]) === v.trim();
                      if (BIT_COLS.has(c)) {
                        return (
                          <td key={c}>
                            <button className={`cell01 ${v === '' ? 'unset' : v === '1' ? 'v1' : ''} ${checked ? (ok ? 'right' : 'wrong') : ''}`} disabled={checked}
                              onClick={() => setVals({ ...vals, [k]: v === '' ? '0' : v === '0' ? '1' : '0' })} aria-label={`${head[c]} fila ${i + 1}`}
                              title={checked && !ok ? `Correcto: ${f[c]}` : undefined}>{v === '' ? '?' : v}</button>
                          </td>
                        );
                      }
                      return (
                        <td key={c}>
                          <input className={`input mono ans-input ${checked ? (ok ? 'right' : 'wrong') : ''}`} style={{ width: 80 }} value={v} disabled={checked}
                            onChange={(ev) => setVals({ ...vals, [k]: ev.target.value })} aria-label={`${head[c]} fila ${i + 1}`} title={checked && !ok ? `Correcto: ${f[c]}` : undefined} />
                        </td>
                      );
                    })}
                    {checked && <td className="expl">{rows[i] ? explainRow(rows[i]) : ''}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {checked && <div className={`grade ${good === total ? 'ok' : 'bad'}`}><span className="grade-big">{good === total ? '¡Correcto!' : `${good} de ${total} celdas correctas`}</span> <span className="faint">(pasa el ratón por las celdas rojas para ver el valor correcto)</span></div>}
        </div>
      )} />
  );
}

// ───────────── Cronograma ─────────────
export function CronogramaEx({ e, back }: { e: Ejercicio; back: string }) {
  const { registrar, visto } = useProgress();
  useEffect(() => { visto(e.id); }, [e.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const spec = e.cronograma!;
  const len = Object.values(spec.entradas)[0].length;
  const [out, setOut] = useState<Record<string, string>>(() => Object.fromEntries(Object.keys(spec.salidas).map((k) => [k, '?'.repeat(len)])));
  const [checked, setChecked] = useState(false);
  const got = useMemo(() => runChronoTest(e.awl ?? '', spec).got, [e, spec]);
  const model = kopModel(e.id);
  let total = 0;
  let good = 0;
  for (const [k, exp] of Object.entries(got)) for (let i = 0; i < len; i++) { total++; if (out[k][i] === exp[i]) good++; }
  const toggle = (k: string, i: number) => {
    if (checked) return;
    const cur = out[k][i];
    const nv = cur === '1' ? '0' : '1';
    setOut({ ...out, [k]: out[k].slice(0, i) + nv + out[k].slice(i + 1) });
  };
  const fill = (k: string, i: number) => {
    if (checked) return;
    const s = out[k];
    const v = s[i] === '?' ? '0' : s[i];
    let n = s;
    for (let j = i + 1; j < len && n[j] === '?'; j++) n = n.slice(0, j) + v + n.slice(j + 1);
    setOut({ ...out, [k]: n });
  };
  const md = useMemo(() => stripAllBlocks(stripAllBlocks(stripYaml(e.markdown), 'text'), 'awl'), [e]);
  return (
    <ExerciseShell e={e} back={back}
      actions={(
        <>
          <ProbarButton code={e.awl ?? ''} title={`${e.id} — ${e.titulo}`} />
          <button className="btn" onClick={() => { setOut(Object.fromEntries(Object.keys(spec.salidas).map((k) => [k, '?'.repeat(len)]))); setChecked(false); }}><Icon name="refresh" size={14} />Borrar</button>
          <button className="btn primary" disabled={Object.values(out).some((s) => s.includes('?'))} onClick={() => { setChecked(true); registrar(e.id, good / total); }} title="Rellena todos los intervalos"><Icon name="check" size={14} />Comprobar</button>
        </>
      )}
      left={(
        <>
          <Markdown text={md} />
          <div className="card" style={{ padding: 10, marginTop: 10 }}><AwlHighlight code={e.awl ?? ''} /></div>
          {model && <div style={{ marginTop: 10 }}><KopStatic segs={model} titles={false} /></div>}
        </>
      )}
      right={(
        <div style={{ padding: '16px 20px' }} className="chrono">
          <h3 style={{ fontSize: 15, marginBottom: 4, fontFamily: 'var(--font)' }}>Dibuja la salida</h3>
          <p className="muted" style={{ marginTop: 0, fontFamily: 'var(--font)' }}>Cada casilla es un intervalo de {spec.paso_ms} ms. Clic = cambiar 0/1; doble clic = repetir el valor hasta el siguiente hueco. Las salidas se leen a mitad de cada intervalo.</p>
          <div className="chrono-row"><span className="lbl faint">t (s)</span>{Array.from({ length: len }, (_, i) => <span key={i} style={{ width: 26, fontSize: 10, textAlign: 'center' }} className="faint">{((i * spec.paso_ms) / 1000).toLocaleString('es-ES')}</span>)}</div>
          {Object.entries(spec.entradas).map(([k, w]) => (
            <div key={k} className="chrono-row"><span className="lbl">{k}</span>{[...w].map((c, i) => <span key={i} className={`chrono-cell ro v${c}`}><span className="lvl" /></span>)}</div>
          ))}
          {Object.keys(spec.salidas).map((k) => (
            <div key={k} className="chrono-row">
              <span className="lbl">{k}</span>
              {[...out[k]].map((c, i) => (
                <button key={i} className={`chrono-cell ${c === '?' ? 'unset' : `v${c}`} ${checked ? (c === got[k][i] ? 'right' : 'wrong') : ''}`} onClick={() => toggle(k, i)} onDoubleClick={() => fill(k, i)} aria-label={`${k} intervalo ${i + 1}: ${c}`}><span className="lvl" /></button>
              ))}
            </div>
          ))}
          {checked && (
            <>
              <div className={`grade ${good === total ? 'ok' : 'bad'}`} style={{ fontFamily: 'var(--font)' }}><span className="grade-big">{good === total ? '¡Correcto!' : `${good} de ${total} intervalos correctos`}</span></div>
              <h4 style={{ fontFamily: 'var(--font)', margin: '12px 0 4px' }}>Simulación real</h4>
              {Object.entries(got).map(([k, w]) => (
                <div key={k} className="chrono-row"><span className="lbl">{k}</span>{[...w].map((c, i) => <span key={i} className={`chrono-cell ro v${c}`}><span className="lvl" /></span>)}</div>
              ))}
              <div style={{ marginTop: 14, fontFamily: 'var(--font)' }}><Markdown text={solucion(e).replace(/```(awl|text)\n[\s\S]*?```/g, '')} /></div>
            </>
          )}
        </div>
      )} />
  );
}
