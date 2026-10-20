import { BANCO, byId, TIPO_LABEL } from '../../content/banco';
import { pendientes, useProgress } from '../../store/progress';
import { go } from '../router';
import { Icon } from '../common/Icon';
import { InlineMd } from '../common/InlineMd';
import { PREGUNTAS } from './Teoria';
import { PRACTICA_ACTIVA } from '../../features';

const TILES = [
  { to: 'simulador', icon: 'cpu', t: 'Simulador libre', d: 'Programa en KOP y AWL con varios bloques, E/S, tabla de variables, paso a paso y analizador lógico.' },
  { to: 'aprender/1', icon: 'book', t: 'Aprender', d: 'Teoría completa de KOP y AWL: ciclo de scan, memoria, instrucciones y trampas de examen.' },
  { to: 'ejemplos', icon: 'list', t: 'Ejemplos', d: '31 ejemplos resueltos para ejecutar y modificar, con pruebas automáticas.' },
  { to: 'predice', icon: 'target', t: 'Predice el resultado', d: '¿Qué vale A4.0? Preguntas de examen con la traza explicada.' },
  { to: 'traza', icon: 'table', t: 'Traza', d: 'Rellena /ER, RLO, STA, OR y los acumuladores instrucción a instrucción.' },
  { to: 'traduce', icon: 'swap', t: 'Traduce KOP ↔ AWL', d: 'Corrección con equivalencia automática frente a la solución.' },
  { to: 'programa', icon: 'code', t: 'Programa', d: 'Ejercicios desde el enunciado: pruebas, equivalencia y avisos.' },
  { to: 'cronograma', icon: 'wave', t: 'Cronograma', d: 'Dibuja la salida de los temporizadores intervalo a intervalo.' },
  { to: 'teoria', icon: 'help', t: 'Teoría (test)', d: `${PREGUNTAS.length} preguntas con explicación.` },
  { to: 'examen', icon: 'graduation', t: 'Examen', d: 'Mezcla de preguntas con tiempo límite y nota sobre 10.' },
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
      <p className="lead">Práctica de programación de autómatas en KOP y AWL, con un simulador de PLC que reproduce el ciclo de scan, la palabra de estado, los temporizadores y contadores y las trampas de examen.</p>
      {PRACTICA_ACTIVA && <div className="row" style={{ gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="card card-pad" style={{ minWidth: 180 }}><div className="faint">Ejercicios superados</div><div className="stat">{sup} <span className="faint" style={{ fontSize: 15 }}>/ {ej.length}</span></div></div>
        <div className="card card-pad" style={{ minWidth: 180 }}><div className="faint">Repaso pendiente</div><div className="stat">{pend.length}</div></div>
        <div className="card card-pad" style={{ minWidth: 180 }}><div className="faint">Último examen</div><div className="stat">{examenes[0] ? examenes[0].nota.toLocaleString('es-ES', { maximumFractionDigits: 1 }) : '—'}</div></div>
        {last && (
          <button className="tile" style={{ minWidth: 240 }} onClick={() => go(`ejercicio/${last.id}`)}>
            <span className="faint">Continuar</span><h3>{last.id} — <InlineMd text={last.titulo} /></h3><p>{TIPO_LABEL[last.tipo]}</p>
          </button>
        )}
      </div>}
      {PRACTICA_ACTIVA && pend.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 18 }}>
          <b>Para repasar hoy:</b>{' '}
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
