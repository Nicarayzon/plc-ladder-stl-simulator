import { BANCO, byId, TIPO_LABEL, type TipoEj } from '../../content/banco';
import { kopModel } from '../../content/kop/models';
import { useProgress } from '../../store/progress';
import { go } from '../router';
import { Icon } from '../common/Icon';
import { InlineMd } from '../common/InlineMd';
import { EjemploEx, ProgramaEx, TraduceEx } from './ex/WbExercises';
import { CronogramaEx, PrediceEx, TrazaEx } from './ex/QuizExercises';
import { TeoriaScreen } from './Teoria';
import { T } from '../../i18n';

const INTRO: Record<TipoEj, string> = T.lista.intro;

export function ListaScreen({ tipo }: { tipo: TipoEj }) {
  const items = useProgress((s) => s.items);
  const list = BANCO.filter((e) => e.tipo === tipo);
  const cats = [...new Set(list.map((e) => e.categoria))];
  const back = tipo === 'ejemplo' ? 'ejemplos' : tipo;
  return (
    <div className="page">
      <div className="page-narrow">
        <h1>{tipo === 'ejemplo' ? T.lista.ejemplos : TIPO_LABEL[tipo]}</h1>
        <p className="lead">{INTRO[tipo]}</p>
        {cats.map((c) => (
          <div key={c} className="card" style={{ marginBottom: 14 }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{c}</div>
            {list.filter((e) => e.categoria === c).map((e) => {
              const it = items[e.id];
              return (
                <div key={e.id} className="list-row" role="link" tabIndex={0} onClick={() => go(`ejercicio/${e.id}/${back}`)} onKeyDown={(ev) => ev.key === 'Enter' && go(`ejercicio/${e.id}/${back}`)}>
                  <span className="id">{e.id}</span>
                  <span className="grow"><InlineMd text={e.titulo} /></span>
                  {kopModel(e.id) && <span className="lang-badge kop">{T.lenguaje.KOP}</span>}
                  {it?.estado === 'superado' && <span className="badge ok">✔ {Math.round(it.mejorNota * 100)} %</span>}
                  {it?.estado === 'intentado' && <span className="badge warn">{Math.round(it.mejorNota * 100)} %</span>}
                  <Icon name="right" size={14} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function EjercicioScreen({ id, back }: { id: string; back?: string }) {
  const e = byId(id);
  if (!e) return <div className="page"><h1>{T.lista.noExiste(id)}</h1></div>;
  const b = back ?? (e.tipo === 'ejemplo' ? 'ejemplos' : e.tipo);
  switch (e.tipo) {
    case 'ejemplo': return <EjemploEx key={e.id} e={e} back={b} />;
    case 'predice': return <PrediceEx key={e.id} e={e} back={b} />;
    case 'traza': return <TrazaEx key={e.id} e={e} back={b} />;
    case 'traduce': return <TraduceEx key={e.id} e={e} back={b} />;
    case 'programa': return <ProgramaEx key={e.id} e={e} back={b} />;
    case 'cronograma': return <CronogramaEx key={e.id} e={e} back={b} />;
    default: return <TeoriaScreen />;
  }
}
