// Examen: mezcla de preguntas con tiempo y nota
import { useEffect, useMemo, useState } from 'react';
import { BANCO, catLetter, categorias, type Ejercicio, type Pregunta } from '../../content/banco';
import { enunciado, traduceDireccion } from '../../content/markdown';
import { gradeProgram } from '../../content/grading';
import { describeStep } from '../../content/grading';
import { compileProgramText, compileLines, textToLines } from '../../core/compiler';
import { checkEquivalence } from '../../core/equivalence';
import { runChronoTest, traceOneCycle } from '../../core/testrunner';
import { splitKey } from '../../core/testio';
import { explainRow } from '../../core/explain';
import { useProgress } from '../../store/progress';
import { useSettings } from '../../store/settings';
import { Markdown } from '../common/Markdown';
import { AwlHighlight } from '../common/AwlHighlight';
import { AwlEditor } from '../workbench/AwlEditor';
import { KopStatic } from '../../kop/render/KopStatic';
import { kopModel } from '../../content/kop/models';
import { Icon } from '../common/Icon';
import { PREGUNTAS, shuffle } from './Teoria';
import { answerOk, keySize, parseAnswer, prediceActual } from './ex/QuizExercises';

type Tipo = 'M' | 'Q' | 'T' | 'R' | 'C' | 'P';
const TIPOS: { id: Tipo; label: string; def: boolean }[] = [
  { id: 'M', label: 'Teoría (test)', def: true },
  { id: 'Q', label: 'Predice el resultado', def: true },
  { id: 'T', label: 'Traza', def: true },
  { id: 'R', label: 'Cronograma', def: true },
  { id: 'C', label: 'Pasar KOP → AWL', def: false },
  { id: 'P', label: 'Programa en AWL', def: false },
];

interface Item { key: string; tipo: Tipo; e?: Ejercicio; q?: Pregunta; order?: number[] }
type Answer = Record<string, string>;

function buildExam(n: number, tipos: Set<Tipo>, cats: Set<string>): Item[] {
  const pool: Item[] = [];
  if (tipos.has('M')) for (const q of PREGUNTAS) pool.push({ key: `M:${q.id}`, tipo: 'M', q, order: shuffle(q.opciones.map((_, i) => i)) });
  for (const e of BANCO) {
    const t = e.id[0] as Tipo;
    if (!tipos.has(t) || t === 'M') continue;
    if (!cats.has(catLetter(e.categoria))) continue;
    if (t === 'C' && traduceDireccion(e) !== 'aAWL') continue;
    pool.push({ key: e.id, tipo: t, e });
  }
  return shuffle(pool).slice(0, n);
}

async function gradeItem(it: Item, a: Answer): Promise<number> {
  const e = it.e;
  switch (it.tipo) {
    case 'M': return Number(a.choice) === it.q!.correcta ? 1 : 0;
    case 'Q': {
      const act = prediceActual(e!);
      let tot = 0; let ok = 0;
      (e!.prueba?.pasos ?? []).forEach((p, i) => {
        for (const k of Object.keys(p.esperar ?? {})) { tot++; const [, tipo] = splitKey(k); if (answerOk(act[i][k] as number, parseAnswer(a[`${i}|${k}`] ?? '', tipo), tipo, keySize(k))) ok++; }
        if (p.esperar_estado) { tot++; if (a[`${i}|__estado`] === act[i].__estado) ok++; }
      });
      return tot ? ok / tot : 0;
    }
    case 'T': {
      let tot = 0; let ok = 0;
      (e!.traza?.filas ?? []).forEach((f, i) => Object.entries(f).forEach(([c, v]) => { if (c === 'i') return; tot++; if (String(v) === (a[`${i}|${c}`] ?? '').trim()) ok++; }));
      return tot ? ok / tot : 0;
    }
    case 'R': {
      const got = runChronoTest(e!.awl ?? '', e!.cronograma!).got;
      let tot = 0; let ok = 0;
      for (const [k, w] of Object.entries(got)) for (let i = 0; i < w.length; i++) { tot++; if ((a[k] ?? '')[i] === w[i]) ok++; }
      return tot ? ok / tot : 0;
    }
    case 'C':
    case 'P': {
      const code = a.code ?? '';
      const r = compileLines(textToLines(code), { collect: true, lang: useSettings.getState().nemotecnia });
      if (r.errors.length || !code.trim()) return 0;
      const cp = { blocks: new Map([['OB1', r.block]]) };
      const g = gradeProgram(cp, e!);
      const eq = await checkEquivalence(cp, compileProgramText(e!.awl ?? ''), { inicial: e!.prueba?.inicial, walks: 8, steps: 150 });
      return g.nota * (eq.equivalente ? 1 : 0.8);
    }
  }
}

export function ExamenScreen() {
  const [fase, setFase] = useState<'config' | 'run' | 'fin'>('config');
  const [n, setN] = useState(10);
  const [tipos, setTipos] = useState<Set<Tipo>>(new Set(TIPOS.filter((t) => t.def).map((t) => t.id)));
  const cats = useMemo(() => categorias().filter((c) => !['M', 'J'].includes(catLetter(c)) || true), []);
  const [selCats, setSelCats] = useState<Set<string>>(new Set(cats.map(catLetter)));
  const [minutos, setMinutos] = useState(20);
  const [items, setItems] = useState<Item[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [i, setI] = useState(0);
  const [t0, setT0] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [notas, setNotas] = useState<number[]>([]);
  const [grading, setGrading] = useState(false);
  const { guardarExamen, examenes } = useProgress();

  useEffect(() => {
    if (fase !== 'run') return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [fase]);
  const restante = minutos > 0 ? Math.max(0, minutos * 60000 - (now - t0)) : null;
  useEffect(() => { if (fase === 'run' && restante === 0) void finish(); }, [restante]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    const list = buildExam(n, tipos, selCats);
    if (!list.length) { alert('No hay preguntas con esa configuración'); return; }
    setItems(list); setAnswers({}); setI(0); setT0(Date.now()); setNow(Date.now()); setFase('run');
  };
  const finish = async () => {
    setGrading(true);
    const ns: number[] = [];
    for (const it of items) ns.push(await gradeItem(it, answers[it.key] ?? {}));
    setNotas(ns);
    const nota = (ns.reduce((s, x) => s + x, 0) / ns.length) * 10;
    guardarExamen({ fecha: Date.now(), nota, preguntas: items.length, duracionS: Math.round((Date.now() - t0) / 1000), detalle: items.map((it, k) => ({ id: it.key, titulo: it.q ? it.q.pregunta.slice(0, 80) : `${it.e!.id} — ${it.e!.titulo}`, nota: ns[k] })) });
    setGrading(false);
    setFase('fin');
    setI(0);
  };
  const setA = (key: string, a: Answer) => setAnswers({ ...answers, [key]: a });

  if (fase === 'config') {
    return (
      <div className="page"><div className="page-narrow" style={{ maxWidth: 820 }}>
        <h1>Examen</h1>
        <p className="lead">Preguntas de varios tipos, con tiempo límite. Al final verás la nota sobre 10 y la revisión de cada pregunta.</p>
        <div className="card card-pad col" style={{ gap: 14 }}>
          <label className="row">Número de preguntas <input type="range" min={5} max={20} value={n} onChange={(e) => setN(+e.target.value)} /> <b>{n}</b></label>
          <label className="row">Tiempo límite <select className="input" value={minutos} onChange={(e) => setMinutos(+e.target.value)}>{[0, 10, 15, 20, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m ? `${m} min` : 'sin límite'}</option>)}</select></label>
          <div><div style={{ fontWeight: 600, marginBottom: 6 }}>Tipos de pregunta</div>
            <div className="row" style={{ flexWrap: 'wrap' }}>{TIPOS.map((t) => (
              <label key={t.id} className="check"><input type="checkbox" checked={tipos.has(t.id)} onChange={(e) => { const s = new Set(tipos); if (e.target.checked) s.add(t.id); else s.delete(t.id); setTipos(s); }} />{t.label}</label>
            ))}</div>
          </div>
          <div><div style={{ fontWeight: 600, marginBottom: 6 }}>Temas</div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>{cats.map((c) => {
              const l = catLetter(c);
              const on = selCats.has(l);
              return <button key={c} className={`btn small ${on ? 'active' : ''}`} onClick={() => { const s = new Set(selCats); if (on) s.delete(l); else s.add(l); setSelCats(s); }}>{c}</button>;
            })}</div>
          </div>
          <div className="row"><span className="spacer" /><button className="btn primary" onClick={start}><Icon name="play" size={13} />Empezar el examen</button></div>
        </div>
        {examenes.length > 0 && (
          <>
            <h2>Exámenes anteriores</h2>
            <table className="tbl card"><thead><tr><th>Fecha</th><th className="num">Preguntas</th><th className="num">Duración</th><th className="num">Nota</th></tr></thead>
              <tbody>{examenes.slice(0, 15).map((x, k) => <tr key={k}><td>{new Date(x.fecha).toLocaleString('es-ES')}</td><td className="num">{x.preguntas}</td><td className="num">{Math.round(x.duracionS / 60)} min</td><td className="num"><b>{x.nota.toLocaleString('es-ES', { maximumFractionDigits: 1 })}</b></td></tr>)}</tbody>
            </table>
          </>
        )}
      </div></div>
    );
  }

  const it = items[i];
  const review = fase === 'fin';
  const total = review ? (notas.reduce((s, x) => s + x, 0) / notas.length) * 10 : 0;
  return (
    <div className="col" style={{ height: '100%', gap: 0 }}>
      <div className="ex-head">
        <b>{review ? 'Revisión del examen' : 'Examen'}</b>
        <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
          {items.map((x, k) => {
            const answered = !!answers[x.key] && Object.values(answers[x.key]).some((v) => v !== '');
            const color = review ? (notas[k] >= 0.999 ? 'var(--ok)' : notas[k] > 0 ? 'var(--warn)' : 'var(--err)') : answered ? 'var(--accent)' : undefined;
            return <button key={x.key} className={`btn small ${k === i ? 'active' : ''}`} style={{ minWidth: 30, color, fontWeight: 700 }} onClick={() => setI(k)}>{k + 1}</button>;
          })}
        </div>
        <span className="spacer" />
        {review ? <span className="badge accent" style={{ fontSize: 14, height: 26 }}>Nota: {total.toLocaleString('es-ES', { maximumFractionDigits: 1 })} / 10</span>
          : restante !== null && <span className={`mono ${restante < 60000 ? 'err-text' : ''}`}>⏱ {Math.floor(restante / 60000)}:{String(Math.floor((restante % 60000) / 1000)).padStart(2, '0')}</span>}
        {review ? <button className="btn primary" onClick={() => setFase('config')}>Nuevo examen</button>
          : <button className="btn primary" disabled={grading} onClick={() => { if (confirm('¿Entregar el examen?')) void finish(); }}>{grading ? 'Corrigiendo…' : 'Entregar'}</button>}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 28px 60px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <span className="badge accent">Pregunta {i + 1} de {items.length}</span>
            {it.e && <span className="faint">{it.e.id} · {it.e.titulo}</span>}
            {review && <span className={`badge ${notas[i] >= 0.999 ? 'ok' : notas[i] > 0 ? 'warn' : 'err'}`}>{Math.round(notas[i] * 100)} %</span>}
          </div>
          <ExamItem it={it} a={answers[it.key] ?? {}} setA={(a) => setA(it.key, a)} review={review} />
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}><Icon name="left" size={14} />Anterior</button>
            <span className="spacer" />
            <button className="btn" disabled={i === items.length - 1} onClick={() => setI(i + 1)}>Siguiente<Icon name="right" size={14} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExamItem({ it, a, setA, review }: { it: Item; a: Answer; setA: (a: Answer) => void; review: boolean }) {
  const e = it.e;
  if (it.tipo === 'M') {
    const q = it.q!;
    const choice = a.choice === undefined ? null : Number(a.choice);
    return (
      <div className="card card-pad">
        <div style={{ fontSize: 15, fontWeight: 600 }}><Markdown text={q.pregunta} /></div>
        {it.order!.map((k) => (
          <button key={k} className={`quiz-opt ${review ? (k === q.correcta ? 'right' : k === choice ? 'wrong' : '') : choice === k ? 'right' : ''}`} disabled={review} onClick={() => setA({ choice: String(k) })}
            style={!review && choice === k ? { borderColor: 'var(--accent)', background: 'var(--accent-bg)' } : undefined}>
            <Markdown text={q.opciones[k]} />
          </button>
        ))}
        {review && <Markdown text={q.explicacion} />}
      </div>
    );
  }
  if (it.tipo === 'Q') return <ExamPredice e={e!} a={a} setA={setA} review={review} />;
  if (it.tipo === 'T') return <ExamTraza e={e!} a={a} setA={setA} review={review} />;
  if (it.tipo === 'R') return <ExamCrono e={e!} a={a} setA={setA} review={review} />;
  return <ExamCode e={e!} a={a} setA={setA} review={review} />;
}

function ExamPredice({ e, a, setA, review }: { e: Ejercicio; a: Answer; setA: (a: Answer) => void; review: boolean }) {
  const act = useMemo(() => prediceActual(e), [e]);
  return (
    <div className="col">
      <Markdown text={enunciado(e)} />
      {e.prueba?.pasos.map((p, i) => (
        <div key={i} className="card card-pad">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Paso {i + 1}: {describeStep(p, e.prueba?.ciclo_ms)}</div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 14 }}>
            {Object.keys(p.esperar ?? {}).map((k) => {
              const [, tipo] = splitKey(k);
              const ok = answerOk(act[i][k] as number, parseAnswer(a[`${i}|${k}`] ?? '', tipo), tipo, keySize(k));
              return (
                <label key={k} className="row" style={{ gap: 6 }}>
                  <span className="mono" style={{ fontWeight: 600 }}>{k} =</span>
                  <input className={`input mono ans-input ${review ? (ok ? 'right' : 'wrong') : ''}`} disabled={review} value={a[`${i}|${k}`] ?? ''} onChange={(ev) => setA({ ...a, [`${i}|${k}`]: ev.target.value })} />
                  {review && !ok && <span className="ok-text mono">{String(act[i][k])}</span>}
                </label>
              );
            })}
            {p.esperar_estado && (
              <select className="input" disabled={review} value={a[`${i}|__estado`] ?? ''} onChange={(ev) => setA({ ...a, [`${i}|__estado`]: ev.target.value })}>
                <option value="">CPU en…</option><option>RUN</option><option>STOP</option>
              </select>
            )}
            {review && p.esperar_estado && <span className="ok-text">{String(act[i].__estado)}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ExamTraza({ e, a, setA, review }: { e: Ejercicio; a: Answer; setA: (a: Answer) => void; review: boolean }) {
  const filas = e.traza?.filas ?? [];
  const order = ['er_antes', 'rlo', 'sta', 'or', 'ov', 'os', 'cc1', 'cc0', 'br', 'acu1', 'acu2', 'acu1_int', 'acu2_int'];
  const cols = order.filter((c) => filas.some((f) => f[c] !== undefined));
  const rows = useMemo(() => { try { return traceOneCycle(e.awl ?? '', e.traza?.inicial).rows; } catch { return []; } }, [e]);
  const bit = new Set(order.slice(0, 9));
  return (
    <div className="col">
      <div className="card" style={{ padding: 10 }}><AwlHighlight code={e.awl ?? ''} /></div>
      {e.traza?.inicial && <div className="mono">Estado inicial: {Object.entries(e.traza.inicial).map(([k, v]) => `${k} = ${v}`).join(', ')}</div>}
      <table className="tbl trace-tbl">
        <thead><tr><th>Instrucción</th>{cols.map((c) => <th key={c}>{c}</th>)}{review && <th>Explicación</th>}</tr></thead>
        <tbody>{filas.map((f, i) => (
          <tr key={i}><td>{String(f.i)}</td>
            {cols.map((c) => {
              if (f[c] === undefined) return <td key={c} className="faint">·</td>;
              const k = `${i}|${c}`;
              const v = a[k] ?? '';
              const ok = String(f[c]) === v.trim();
              return <td key={c}>{bit.has(c)
                ? <button className={`cell01 ${v === '' ? 'unset' : v === '1' ? 'v1' : ''} ${review ? (ok ? 'right' : 'wrong') : ''}`} disabled={review} onClick={() => setA({ ...a, [k]: v === '' ? '0' : v === '0' ? '1' : '0' })} title={review && !ok ? `Correcto: ${f[c]}` : undefined}>{v === '' ? '?' : v}</button>
                : <input className={`input mono ans-input ${review ? (ok ? 'right' : 'wrong') : ''}`} style={{ width: 80 }} disabled={review} value={v} onChange={(ev) => setA({ ...a, [k]: ev.target.value })} title={review && !ok ? `Correcto: ${f[c]}` : undefined} />}</td>;
            })}
            {review && <td className="expl">{rows[i] ? explainRow(rows[i]) : ''}</td>}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function ExamCrono({ e, a, setA, review }: { e: Ejercicio; a: Answer; setA: (a: Answer) => void; review: boolean }) {
  const spec = e.cronograma!;
  const len = Object.values(spec.entradas)[0].length;
  const got = useMemo(() => runChronoTest(e.awl ?? '', spec).got, [e, spec]);
  return (
    <div className="col chrono">
      <div className="card" style={{ padding: 10 }}><AwlHighlight code={e.awl ?? ''} /></div>
      <div className="faint" style={{ fontFamily: 'var(--font)' }}>Cada casilla = {spec.paso_ms} ms. Clic para cambiar 0/1.</div>
      {Object.entries(spec.entradas).map(([k, w]) => (
        <div key={k} className="chrono-row"><span className="lbl">{k}</span>{[...w].map((c, i) => <span key={i} className={`chrono-cell ro v${c}`}><span className="lvl" /></span>)}</div>
      ))}
      {Object.keys(spec.salidas).map((k) => {
        const s = (a[k] ?? '').padEnd(len, '?');
        return (
          <div key={k} className="chrono-row"><span className="lbl">{k}</span>
            {[...s].map((c, i) => <button key={i} disabled={review} className={`chrono-cell ${c === '?' ? 'unset' : `v${c}`} ${review ? (c === got[k][i] ? 'right' : 'wrong') : ''}`}
              onClick={() => setA({ ...a, [k]: s.slice(0, i) + (c === '1' ? '0' : '1') + s.slice(i + 1) })}><span className="lvl" /></button>)}
          </div>
        );
      })}
      {review && Object.entries(got).map(([k, w]) => (
        <div key={`g${k}`} className="chrono-row"><span className="lbl ok-text">{k} ✔</span>{[...w].map((c, i) => <span key={i} className={`chrono-cell ro v${c}`}><span className="lvl" /></span>)}</div>
      ))}
    </div>
  );
}

function ExamCode({ e, a, setA, review }: { e: Ejercicio; a: Answer; setA: (a: Answer) => void; review: boolean }) {
  const model = kopModel(e.id);
  const lang = useSettings((s) => s.nemotecnia);
  return (
    <div className="col">
      {e.tipo === 'traduce' ? (model ? <KopStatic segs={model} /> : <pre className="kop-ascii">{e.kop_ascii}</pre>) : <Markdown text={enunciado(e)} />}
      <div style={{ fontWeight: 600 }}>Tu programa (AWL)</div>
      <div className="card" style={{ overflow: 'hidden' }}><AwlEditor value={a.code ?? ''} readOnly={review} lang={lang} minLines={8} onChange={(v) => setA({ code: v })} /></div>
      {review && <><div style={{ fontWeight: 600 }}>Solución</div><div className="card" style={{ padding: 10 }}><AwlHighlight code={e.awl ?? ''} /></div></>}
    </div>
  );
}
