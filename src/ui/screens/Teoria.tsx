import { useMemo, useState } from 'react';
import { BANCO, type Pregunta } from '../../content/banco';
import { useProgress } from '../../store/progress';
import { Icon } from '../common/Icon';
import { Markdown } from '../common/Markdown';

export function shuffle<T>(a: T[], rnd = Math.random): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export const PREGUNTAS: Pregunta[] = BANCO.filter((e) => e.preguntas).flatMap((e) => e.preguntas!);

export function QuestionCard({ q, onAnswer, answered, choice }: { q: Pregunta; onAnswer: (ok: boolean, idx: number) => void; answered: boolean; choice: number | null }) {
  const order = useMemo(() => shuffle(q.opciones.map((_, i) => i)), [q]);
  return (
    <div className="card card-pad" style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}><Markdown text={q.pregunta} /></div>
      {order.map((i) => {
        const cls = answered ? (i === q.correcta ? 'right' : i === choice ? 'wrong' : '') : '';
        return (
          <button key={i} className={`quiz-opt ${cls}`} disabled={answered} onClick={() => onAnswer(i === q.correcta, i)}>
            <Markdown text={q.opciones[i]} />
          </button>
        );
      })}
      {answered && (
        <div className={choice === q.correcta ? 'ok-text' : 'err-text'} style={{ marginTop: 8 }}>
          <b>{choice === q.correcta ? '¡Correcto!' : 'No es correcto.'}</b>
          <div style={{ color: 'var(--text)' }}><Markdown text={q.explicacion} /></div>
        </div>
      )}
    </div>
  );
}

export function TeoriaScreen() {
  const { registrar, items } = useProgress();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [orden, setOrden] = useState(() => PREGUNTAS.map((_, k) => k));
  const q = PREGUNTAS[orden[i]];
  const done = Object.keys(answers).length;
  const right = PREGUNTAS.filter((p) => answers[p.id] === p.correcta).length;
  return (
    <div className="page">
      <div className="page-narrow" style={{ maxWidth: 820 }}>
        <h1>Teoría</h1>
        <p className="lead">Preguntas tipo test con explicación. Las opciones se barajan en cada intento.</p>
        <div className="row" style={{ marginBottom: 12 }}>
          <span className="badge accent">Pregunta {i + 1} de {PREGUNTAS.length}</span>
          <span className="badge">{right} correctas de {done} respondidas</span>
          <span className="spacer" />
          <button className="btn small" onClick={() => { setOrden(shuffle(orden)); setI(0); setAnswers({}); }}><Icon name="refresh" size={13} />Barajar y empezar</button>
        </div>
        <QuestionCard key={`${q.id}-${orden.join(',')}`} q={q} answered={answers[q.id] !== undefined} choice={answers[q.id] ?? null}
          onAnswer={(ok, idx) => { setAnswers({ ...answers, [q.id]: idx }); registrar(`M01:${q.id}`, ok ? 1 : 0); }} />
        <div className="row">
          <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}><Icon name="left" size={14} />Anterior</button>
          <span className="spacer" />
          <span className="faint" style={{ fontSize: 12 }}>{PREGUNTAS.filter((p) => items[`M01:${p.id}`]?.estado === 'superado').length} preguntas acertadas alguna vez</span>
          <span className="spacer" />
          <button className="btn primary" disabled={i === PREGUNTAS.length - 1} onClick={() => setI(i + 1)}>Siguiente<Icon name="right" size={14} /></button>
        </div>
      </div>
    </div>
  );
}
