import { BANCO, byId, TIPO_LABEL } from '../../content/banco';
import { pendientes, useProgress } from '../../store/progress';
import { go } from '../router';
import { Icon } from '../common/Icon';
import { InlineMd } from '../common/InlineMd';
import { PREGUNTAS } from './Teoria';
import { PRACTICA_ACTIVA } from '../../features';
import { T } from '../../i18n';

const X = T.inicio.tiles;
const TILES = [
  { to: 'simulador', icon: 'cpu', ...X.simulador },
  { to: 'aprender/1', icon: 'book', ...X.aprender },
  { to: 'ejemplos', icon: 'list', ...X.ejemplos },
  { to: 'predice', icon: 'target', ...X.predice },
  { to: 'traza', icon: 'table', ...X.traza },
  { to: 'traduce', icon: 'swap', ...X.traduce },
  { to: 'programa', icon: 'code', ...X.programa },
  { to: 'cronograma', icon: 'wave', ...X.cronograma },
  { to: 'teoria', icon: 'help', t: X.teoria.t, d: X.teoria.d(PREGUNTAS.length) },
  { to: 'examen', icon: 'graduation', ...X.examen },
];

const TILES_SIN_PRACTICA = ['simulador', 'aprender/1', 'ejemplos'];

export function InicioScreen() {
  const { items, ultimo, examenes } = useProgress();
  const ej = BANCO.filter((e) => e.tipo !== 'teoria');
  const sup = ej.filter((e) => items[e.id]?.estado === 'superado').length;
  const pend = pendientes(items).filter((k) => byId(k));
  const last = ultimo ? byId(ultimo) : null;
  return (
    <div className="page"><div className="page-narrow">
      <h1>Automatizacion</h1>
      <p className="lead">{T.inicio.lead}</p>
      {PRACTICA_ACTIVA && <div className="row" style={{ gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="card card-pad" style={{ minWidth: 180 }}><div className="faint">{T.inicio.superados}</div><div className="stat">{sup} <span className="faint" style={{ fontSize: 15 }}>/ {ej.length}</span></div></div>
        <div className="card card-pad" style={{ minWidth: 180 }}><div className="faint">{T.inicio.repasoPendiente}</div><div className="stat">{pend.length}</div></div>
        <div className="card card-pad" style={{ minWidth: 180 }}><div className="faint">{T.inicio.ultimoExamen}</div><div className="stat">{examenes[0] ? examenes[0].nota.toLocaleString(T.locale, { maximumFractionDigits: 1 }) : '—'}</div></div>
        {last && (
          <button className="tile" style={{ minWidth: 240 }} onClick={() => go(`ejercicio/${last.id}`)}>
            <span className="faint">{T.inicio.continuar}</span><h3>{last.id} — <InlineMd text={last.titulo} /></h3><p>{TIPO_LABEL[last.tipo]}</p>
          </button>
        )}
      </div>}
      {PRACTICA_ACTIVA && pend.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 18 }}>
          <b>{T.inicio.paraRepasar}</b>{' '}
          {pend.slice(0, 12).map((k) => <button key={k} className="btn small" style={{ margin: 3 }} onClick={() => go(`ejercicio/${k}`)}>{k}</button>)}
        </div>
      )}
      <div className="grid-cards">
        {TILES.filter((t) => PRACTICA_ACTIVA || TILES_SIN_PRACTICA.includes(t.to)).map((t) => (
          <button key={t.to} className="tile" onClick={() => go(t.to)}>
            <span style={{ color: 'var(--accent)' }}><Icon name={t.icon} size={20} /></span>
            <h3>{t.t}</h3><p>{t.d}</p>
          </button>
        ))}
      </div>
    </div></div>
  );
}
