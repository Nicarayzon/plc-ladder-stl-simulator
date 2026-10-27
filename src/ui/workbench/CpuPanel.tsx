import type { SimController } from '../../sim/SimController';
import { useSimTick } from './useSim';
import { bitsF32, s16, s32 } from '../../core/num';
import { fmtReal } from '../../core/format';
import { T } from '../../i18n';

const hex8 = (v: number) => (v >>> 0).toString(16).toUpperCase().padStart(8, '0');

function Reg({ name, v }: { name: string; v: number }) {
  return (
    <>
      <span className="r">{name}</span>
      <span title={T.cpu.regTitulo(s32(v), s16(v), fmtReal(bitsF32(v)))}>
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
    [T.reg.er, cpu.fc, T.cpu.bits.er],
    [T.reg.rlo, cpu.rlo, T.cpu.bits.rlo], [T.reg.sta, cpu.sta, T.cpu.bits.sta], [T.reg.or, cpu.orb, T.cpu.bits.or],
    [T.reg.os, cpu.os, T.cpu.bits.os], [T.reg.ov, cpu.ov, T.cpu.bits.ov], [T.reg.a1, cpu.cc1, T.cpu.bits.a1],
    [T.reg.a0, cpu.cc0, T.cpu.bits.a0], [T.reg.rb, cpu.br, T.cpu.bits.rb],
  ];
  const loc = cpu.currentLoc();
  return (
    <div>
      <div className="panel-sec">
        <h4>{T.cpu.palabraEstado}</h4>
        <div className="stw">
          {bits.map(([n, v, t]) => (
            <div key={n} title={t}><span className={`bit ${v ? 'on' : ''}`}>{v}</span>{n}</div>
          ))}
        </div>
        <div className="faint" style={{ fontSize: 11, marginTop: 8 }}>
          {cpu.phase === 'CYCLE' ? T.cpu.enPausa : T.cpu.alTerminar}
        </div>
      </div>
      <div className="panel-sec">
        <h4>{T.cpu.registros}</h4>
        <div className="regs">
          <Reg name={T.reg.acu1} v={cpu.acc1} />
          <Reg name={T.reg.acu2} v={cpu.acc2} />
          <Reg name="AR1" v={cpu.ar1} />
          <Reg name="AR2" v={cpu.ar2} />
          <span className="r">DB</span><span>{cpu.openDb ? `DB ${cpu.openDb}` : '—'} <span className="faint">· DI {cpu.openDi || '—'}</span></span>
          <span className="r">MCR</span><span>{cpu.mcra ? T.cpu.mcrActivo(cpu.mcrStack.join(', ')) : T.cpu.mcrInactivo}</span>
        </div>
      </div>
      <div className="panel-sec">
        <h4>{T.cpu.pila}</h4>
        {cpu.phase !== 'CYCLE' || !cpu.frames.length ? <div className="muted" style={{ fontSize: 12 }}>{T.cpu.pilaSoloPausa}</div> : (
          <table className="tbl">
            <thead><tr><th>{T.cpu.bloque}</th><th>{T.cpu.siguienteInstr}</th><th>{T.cpu.parentesis}</th></tr></thead>
            <tbody>
              {[...cpu.frames].reverse().map((f, i) => {
                const ins = f.blk.instrs[f.pc];
                return (
                  <tr key={i}>
                    <td className="mono">{f.name}</td>
                    <td className="mono" style={{ fontSize: 11.5 }}>{ins ? ins.src.replace(/\s+/g, ' ') : T.cpu.fin}{f.pendCall && <span className="faint">{T.cpu.llamando}</span>}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{f.nest.length ? f.nest.map((n) => `${n.kind}( ${T.reg.rlo}=${n.rlo} ${T.reg.or}=${n.orb} ${T.reg.er}=${n.fc}`).join(' · ') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {loc && <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>{T.cpu.siguiente(loc.block, loc.instr.src.replace(/\s+/g, ' '))}</div>}
      </div>
      {cpu.state === 'STOP' && cpu.stopReason && (
        <div className="panel-sec err-text" style={{ fontSize: 12 }}>{cpu.stopReason}</div>
      )}
    </div>
  );
}
