import type { ReactNode } from 'react';
import type { SimController } from '../../sim/SimController';
import { Icon } from '../common/Icon';
import { useSimTick } from './useSim';

export function fmtTimeS(ms: number) {
  return (ms / 1000).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function Toolbar({ sim, title, extra, afterMres, observe, onObserve }: { sim: SimController; title?: ReactNode; extra?: ReactNode; afterMres?: ReactNode; observe: boolean; onObserve: (v: boolean) => void }) {
  useSimTick(sim, 12, () => [sim.rev, sim.cpu.state, sim.playing, sim.speed, sim.cpu.phase, sim.forces.size, sim.lastStop]);
  const cpu = sim.cpu;
  const run = cpu.state === 'RUN';
  const sf = !!sim.lastStop;
  const frce = sim.forces.size > 0;
  const midCycle = cpu.phase === 'CYCLE';
  return (
    <div className="wb-toolbar" role="toolbar" aria-label="CPU y simulación">
      {title && <span className="title">{title}</span>}
      <div className="run-switch" role="group" aria-label="Selector de modo de la CPU">
        <button className={`run ${run ? 'on' : ''}`} onClick={() => sim.setRun(true)} title="RUN: rearranque completo (OB100) desde STOP">RUN</button>
        <button className={`stop ${!run ? 'on' : ''}`} onClick={() => sim.setRun(false)} title="Pasar la CPU a STOP">STOP</button>
      </div>
      <button className="btn small" onClick={() => { if (confirm('Borrado total (MRES): se borra toda la memoria, incluida la remanente y los DB. ¿Continuar?')) sim.mres(); }} title="Borrado total de la memoria">MRES</button>
      {afterMres}
      <span className="led-label"><span className={`led ${run ? 'on' : ''}`} />RUN</span>
      <span className="led-label"><span className={`led yellow ${!run ? 'on' : ''}`} />STOP</span>
      <span className="led-label" title={sim.lastStop?.reason}><span className={`led red ${sf ? 'on' : ''}`} />SF</span>
      <span className="led-label" title="Hay operandos forzados"><span className={`led yellow ${frce ? 'on' : ''}`} />FRCE</span>
      <span className="sep" />
      <div className="btn-group">
        <button className={`btn small icon ${sim.playing ? 'active' : ''}`} disabled={!run} onClick={() => sim.play()} title="Ejecutar en tiempo real"><Icon name="play" size={13} /></button>
        <button className={`btn small icon ${!sim.playing && run ? 'active' : ''}`} disabled={!run} onClick={() => sim.pause()} title="Pausa"><Icon name="pause" size={13} /></button>
        <button className="btn small" disabled={!run} onClick={() => sim.stepCycle()} title={midCycle ? 'Terminar el ciclo en curso' : 'Ejecutar un ciclo'}><Icon name="stepc" size={13} />Ciclo</button>
        <button className="btn small" disabled={!run} onClick={() => sim.stepInstr()} title="Ejecutar una instrucción"><Icon name="stepi" size={13} />Instr.</button>
      </div>
      <div className="btn-group" role="group" aria-label="Velocidad">
        {[1, 10, 100].map((s) => (
          <button key={s} className={`btn small ${sim.speed === s ? 'active' : ''}`} onClick={() => sim.setSpeed(s)} title={s === 1 ? 'Tiempo real' : `${s} veces más rápido`}>×{s}</button>
        ))}
      </div>
      <button className={`btn small ${observe ? 'active' : ''}`} onClick={() => onObserve(!observe)} title="Observar: RLO, STA y acumuladores por línea, y flujo de corriente en KOP">
        <Icon name="eye" size={14} />Observar
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
      ciclo <b>{cpu.cycles.toLocaleString('es-ES')}</b> · t = <b>{fmtTimeS(cpu.timeMs)} s</b> · {cpu.cycleMs} ms/ciclo · {cpu.lastCycleInstr} instr.
      {sim.limited && sim.playing && <span className="warn-text"> (limitado)</span>}
      {cpu.phase === 'CYCLE' && <span className="warn-text"> · pausa a mitad de ciclo</span>}
    </span>
  );
}
