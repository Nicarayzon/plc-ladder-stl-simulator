import { type ReactNode, useState } from 'react';
import { TIPO_LABEL, type Ejercicio } from '../../../content/banco';
import type { Grade } from '../../../content/grading';
import { useProgress } from '../../../store/progress';
import { Icon } from '../../common/Icon';
import { go } from '../../router';
import { useSplit } from '../../common/ui';
import { InlineMd } from '../../common/InlineMd';

export function EstadoBadge({ id }: { id: string }) {
  const it = useProgress((s) => s.items[id]);
  if (!it || it.estado === 'sin_ver') return null;
  return it.estado === 'superado' ? <span className="badge ok">Superado</span> : <span className="badge warn">Intentado · {Math.round(it.mejorNota * 100)} %</span>;
}

export function ExerciseShell({ e, left, right, back, actions }: { e: Ejercicio; left: ReactNode; right: ReactNode; back: string; actions?: ReactNode }) {
  const [w, start] = useSplit('ex-left', 400, 260, 900);
  const [hidden, setHidden] = useState(false);
  return (
    <div className="col" style={{ height: '100%', gap: 0 }}>
      <div className="ex-head">
        <button className="btn ghost small" onClick={() => go(back)}><Icon name="left" size={14} />Volver</button>
        <span className="badge accent">{e.id}</span>
        <h2 style={{ fontSize: 15 }}><InlineMd text={e.titulo} /></h2>
        <span className="faint" style={{ fontSize: 12 }}>{e.categoria} · {TIPO_LABEL[e.tipo]}</span>
        <EstadoBadge id={e.id} />
        <span className="spacer" />
        <button className={`btn ${hidden ? '' : 'active'}`} onClick={() => setHidden(!hidden)} title="Mostrar u ocultar el enunciado"><Icon name="book" size={14} />Enunciado</button>
        {actions}
      </div>
      <div className="ex-body">
        {!hidden && <div className="ex-left" style={{ width: w }}>{left}</div>}
        {!hidden && <div className="splitter-x" onMouseDown={(ev) => start(ev, 'x')} />}
        <div className="ex-right">{right}</div>
      </div>
    </div>
  );
}

export function GradeReport({ g, onReplay, extra }: { g: Grade; onReplay?: () => void; extra?: ReactNode }) {
  const all = g.ok === g.checks && g.checks > 0;
  return (
    <div className={`grade ${all ? 'ok' : 'bad'}`} role="status">
      <div className="row" style={{ gap: 10 }}>
        <span className="grade-big">{all ? '¡Correcto!' : `${g.ok} de ${g.checks} comprobaciones superadas`}</span>
        <span className="badge">{(g.nota * 10).toLocaleString('es-ES', { maximumFractionDigits: 1 })} / 10</span>
        <span className="spacer" />
        {!all && onReplay && g.failStep && <button className="btn small" onClick={onReplay}>Ver en el simulador (hasta el paso {g.failStep})</button>}
      </div>
      {g.fails.length > 0 && <ul>{g.fails.slice(0, 12).map((f, i) => <li key={i}>{f}</li>)}</ul>}
      {extra}
    </div>
  );
}
