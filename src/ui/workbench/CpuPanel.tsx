import type { SimController } from '../../sim/SimController';
import { useSimTick } from './useSim';
import { bitsF32, s16, s32 } from '../../core/num';
import { fmtReal } from '../../core/format';

const hex8 = (v: number) => (v >>> 0).toString(16).toUpperCase().padStart(8, '0');

function Reg({ name, v }: { name: string; v: number }) {
  return (
    <>
      <span className="r">{name}</span>
      <span title={`DEC ${s32(v)} · INT (bajo) ${s16(v)} · REAL ${fmtReal(bitsF32(v))}`}>
        DW#16#{hex8(v)} <span className="faint">· {s32(v)} · L={s16(v)}</span>
      </span>
    </>
  );
}

export function CpuPanel({ sim }: { sim: SimController }) {
  const cpu = sim.cpu;
  useSimTick(sim, 15, () => [sim.rev, cpu.state, cpu.phase, cpu.fc, cpu.rlo, cpu.sta, cpu.orb, cpu.os, cpu.ov, cpu.cc1, cpu.cc0, cpu.br,
    cpu.acc1, cpu.acc2, cpu.ar1, cpu.ar2, cpu.openDb, cpu.openDi, cpu.mcra, cpu.mcrStack.length, cpu.frames.length, cpu.stopReason]);
  const bits: [string, number, string][] = [
    ['/ER', cpu.fc, 'Primera consulta (0 = la siguiente consulta empieza una cadena nueva)'],
    ['RLO', cpu.rlo, 'Resultado lógico'], ['STA', cpu.sta, 'Estado del último operando consultado'], ['OR', cpu.orb, 'Bit O'],
    ['OS', cpu.os, 'Desbordamiento memorizado'], ['OV', cpu.ov, 'Desbordamiento'], ['A1', cpu.cc1, 'Código de condición 1 (CC1)'],
    ['A0', cpu.cc0, 'Código de condición 0 (CC0)'], ['RB', cpu.br, 'Resultado binario (BIE / BR)'],
  ];
  const loc = cpu.currentLoc();
  return (
    <div>
      <div className="panel-sec">
        <h4>Palabra de estado</h4>
        <div className="stw">
          {bits.map(([n, v, t]) => (
            <div key={n} title={t}><span className={`bit ${v ? 'on' : ''}`}>{v}</span>{n}</div>
          ))}
        </div>
        <div className="faint" style={{ fontSize: 11, marginTop: 8 }}>
          {cpu.phase === 'CYCLE' ? 'Estado en el punto de pausa.' : 'Estado al terminar el último ciclo (al empezar cada OB1 vale 0).'}
        </div>
      </div>
      <div className="panel-sec">
        <h4>Registros</h4>
        <div className="regs">
          <Reg name="ACU1" v={cpu.acc1} />
          <Reg name="ACU2" v={cpu.acc2} />
          <Reg name="AR1" v={cpu.ar1} />
          <Reg name="AR2" v={cpu.ar2} />
          <span className="r">DB</span><span>{cpu.openDb ? `DB ${cpu.openDb}` : '—'} <span className="faint">· DI {cpu.openDi || '—'}</span></span>
          <span className="r">MCR</span><span>{cpu.mcra ? `activo · pila [${cpu.mcrStack.join(', ')}]` : 'inactivo'}</span>
        </div>
      </div>
      <div className="panel-sec">
        <h4>Pila de llamadas y paréntesis</h4>
        {cpu.phase !== 'CYCLE' || !cpu.frames.length ? <div className="muted" style={{ fontSize: 12 }}>Solo se ve en pausa a mitad de ciclo (paso a paso o punto de parada).</div> : (
          <table className="tbl">
            <thead><tr><th>Bloque</th><th>Instrucción siguiente</th><th>Paréntesis</th></tr></thead>
            <tbody>
              {[...cpu.frames].reverse().map((f, i) => {
                const ins = f.blk.instrs[f.pc];
                return (
                  <tr key={i}>
                    <td className="mono">{f.name}</td>
                    <td className="mono" style={{ fontSize: 11.5 }}>{ins ? ins.src.replace(/\s+/g, ' ') : '(fin)'}{f.pendCall && <span className="faint"> (llamando)</span>}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{f.nest.length ? f.nest.map((n) => `${n.kind}( RLO=${n.rlo} OR=${n.orb} /ER=${n.fc}`).join(' · ') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {loc && <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>Siguiente: {loc.block}, {loc.instr.src.replace(/\s+/g, ' ')}</div>}
      </div>
      {cpu.state === 'STOP' && cpu.stopReason && (
        <div className="panel-sec err-text" style={{ fontSize: 12 }}>{cpu.stopReason}</div>
      )}
    </div>
  );
}
