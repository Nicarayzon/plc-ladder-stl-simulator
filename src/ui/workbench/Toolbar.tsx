import type { ReactNode } from 'react';
import type { SimController } from '../../sim/SimController';
import { Icon } from '../common/Icon';
import { useSimTick } from './useSim';
import { T } from '../../i18n';

export function fmtTimeS(ms: number) {
  return (ms / 1000).toLocaleString(T.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function Toolbar({ sim, title, extra, afterMres, observe, onObserve }: { sim: SimController; title?: ReactNode; extra?: ReactNode; afterMres?: ReactNode; observe: boolean; onObserve: (v: boolean) => void }) {
  useSimTick(sim, 12, () => [sim.rev, sim.cpu.state, sim.playing, sim.speed, sim.cpu.phase, sim.forces.size, sim.lastStop]);
  const cpu = sim.cpu;
  const run = cpu.state === 'RUN';
  const sf = !!sim.lastStop;
  const frce = sim.forces.size > 0;
  const midCycle = cpu.phase === 'CYCLE';
  return (
    <div className="wb-toolbar" role="toolbar" aria-label={T.barra.etiqueta}>
      {title && <span className="title">{title}</span>}
      <div className="run-switch" role="group" aria-label={T.barra.selector}>
        <button className={`run ${run ? 'on' : ''}`} onClick={() => sim.setRun(true)} title={T.barra.runTitulo}>RUN</button>
        <button className={`stop ${!run ? 'on' : ''}`} onClick={() => sim.setRun(false)} title={T.barra.stopTitulo}>STOP</button>
      </div>
      <button className="btn small" onClick={() => { if (confirm(T.barra.confirmarMres)) sim.mres(); }} title={T.barra.mresTitulo}>MRES</button>
      {afterMres}
      <span className="led-label"><span className={`led ${run ? 'on' : ''}`} />RUN</span>
      <span className="led-label"><span className={`led yellow ${!run ? 'on' : ''}`} />STOP</span>
      <span className="led-label" title={sim.lastStop?.reason}><span className={`led red ${sf ? 'on' : ''}`} />SF</span>
      <span className="led-label" title={T.barra.forzados}><span className={`led yellow ${frce ? 'on' : ''}`} />FRCE</span>
      <span className="sep" />
      <div className="btn-group">
        <button className={`btn small icon ${sim.playing ? 'active' : ''}`} disabled={!run} onClick={() => sim.play()} title={T.barra.tiempoReal}><Icon name="play" size={13} /></button>
        <button className={`btn small icon ${!sim.playing && run ? 'active' : ''}`} disabled={!run} onClick={() => sim.pause()} title={T.barra.pausa}><Icon name="pause" size={13} /></button>
        <button className="btn small" disabled={!run} onClick={() => sim.stepCycle()} title={midCycle ? T.barra.terminarCiclo : T.barra.unCiclo}><Icon name="stepc" size={13} />{T.barra.ciclo}</button>
        <button className="btn small" disabled={!run} onClick={() => sim.stepInstr()} title={T.barra.unaInstr}><Icon name="stepi" size={13} />{T.barra.instr}</button>
      </div>
      <div className="btn-group" role="group" aria-label={T.barra.velocidad}>
        {[1, 10, 100].map((s) => (
          <button key={s} className={`btn small ${sim.speed === s ? 'active' : ''}`} onClick={() => sim.setSpeed(s)} title={s === 1 ? T.barra.tiempoRealX1 : T.barra.vecesMasRapido(s)}>×{s}</button>
        ))}
      </div>
      <button className={`btn small ${observe ? 'active' : ''}`} onClick={() => onObserve(!observe)} title={T.barra.observarTitulo}>
        <Icon name="eye" size={14} />{T.barra.observar}
      </button>
      <CycleStatus sim={sim} />
      <span className="spacer" />
      {extra}
    </div>
  );
}

/** Ciclo y tiempo de la CPU: lo único de la barra que cambia en cada ciclo. */
export function CycleStatus({ sim }: { sim: SimController }) {
  const cpu = sim.cpu;
  useSimTick(sim, 5, () => [sim.rev, cpu.cycles, cpu.lastCycleInstr, cpu.cycleMs, sim.limited, sim.playing, cpu.phase]);
  return (
    <span className="wb-status" aria-live="off">
      {T.barra.cicloN} <b>{cpu.cycles.toLocaleString(T.locale)}</b> · t = <b>{fmtTimeS(cpu.timeMs)} s</b> · {cpu.cycleMs} {T.barra.msCiclo} · {cpu.lastCycleInstr} {T.barra.instrN}
      {sim.limited && sim.playing && <span className="warn-text">{T.barra.limitado}</span>}
      {cpu.phase === 'CYCLE' && <span className="warn-text">{T.barra.pausaMitad}</span>}
    </span>
  );
}
