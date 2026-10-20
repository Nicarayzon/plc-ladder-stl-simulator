import type { SimController } from '../../sim/SimController';
import type { ProgramIssue, Programa } from '../../core/program';
import { normBlockName } from '../../core/compiler';
import { segId } from '../../core/program';
import { useSimTick } from './useSim';
import { explainRow } from '../../core/explain';
import { AwlHighlight } from '../common/AwlHighlight';

export function MessagesPanel({ sim, warnings, onGoto }: { sim: SimController; warnings: ProgramIssue[]; onGoto: (block: string, seg?: string) => void }) {
  useSimTick(sim, 5, () => sim.rev);
  const errs = sim.compiled.errors;
  return (
    <div style={{ padding: '6px 10px', fontSize: 12.5 }}>
      {!errs.length && !warnings.length && !sim.lastStop && <div className="ok-text">✔ Compilado sin errores.</div>}
      {sim.lastStop && <div className="err-text" style={{ marginBottom: 6 }}>■ {sim.lastStop.reason}</div>}
      {errs.map((e, i) => (
        <div key={i} className="row" style={{ alignItems: 'flex-start', padding: '2px 0' }}>
          <span className="err-text">✖</span>
          <button className="btn ghost small" style={{ height: 'auto', padding: '0 4px', textAlign: 'left', whiteSpace: 'normal' }} onClick={() => onGoto(e.block, e.seg)}>{e.full}</button>
        </div>
      ))}
      {warnings.map((e, i) => (
        <div key={`w${i}`} className="row" style={{ alignItems: 'flex-start', padding: '2px 0' }}>
          <span className="warn-text">⚠</span>
          <button className="btn ghost small" style={{ height: 'auto', padding: '0 4px', textAlign: 'left', whiteSpace: 'normal' }} onClick={() => onGoto(e.block, e.seg)}>{e.full}</button>
        </div>
      ))}
      {sim.hasErrors && <div className="warn-text" style={{ marginTop: 6 }}>El programa tiene errores: la CPU sigue ejecutando la última versión correcta.</div>}
    </div>
  );
}

export function GeneratedAwl({ sim, programa, block }: { sim: SimController; programa: Programa; block: string }) {
  useSimTick(sim, 3, () => sim.rev);
  const b = programa.bloques.find((x) => normBlockName(x.nombre) === block);
  if (!b) return null;
  const parts = b.segmentos.map((s, i) => {
    const id = segId(s);
    const title = `// Segmento ${i + 1}${(s.lang === 'KOP' ? s.kop.titulo : s.titulo) ? `: ${s.lang === 'KOP' ? s.kop.titulo : s.titulo}` : ''}${s.lang === 'KOP' ? '  (KOP)' : ''}`;
    const body = s.lang === 'AWL' ? s.awl : (sim.compiled.kopLines.get(id) ?? []).map((l) => l.text).join('\n');
    return `${title}\n${body}`;
  });
  return (
    <div style={{ padding: '6px 12px' }}>
      <div className="faint" style={{ fontSize: 11.5, marginBottom: 6 }}>Así queda el bloque {block} en AWL. Los segmentos KOP se traducen a un AWL equivalente.</div>
      <AwlHighlight code={parts.join('\n\n')} />
    </div>
  );
}

export function TracePanel({ sim }: { sim: SimController }) {
  useSimTick(sim, 5, () => [sim.rev, sim.trace, sim.cpu.state]);
  const rows = sim.trace;
  return (
    <div>
      <div className="row" style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
        <button className="btn small" onClick={() => sim.captureNextCycle()} disabled={sim.cpu.state !== 'RUN'}>Capturar el próximo ciclo</button>
        <span className="faint" style={{ fontSize: 11.5 }}>{rows.length ? `${rows.length} instrucciones${sim.traceCycle ? ` · ciclo ${sim.traceCycle}` : ''}` : 'Captura un ciclo o avanza instrucción a instrucción para ver la traza.'}</span>
      </div>
      {rows.length > 0 && (
        <table className="tbl trace-tbl">
          <thead>
            <tr><th>Bloque</th><th>Instrucción</th><th>/ER antes</th><th>RLO</th><th>STA</th><th>OR</th><th>OV</th><th>OS</th><th>A1A0</th><th>RB</th><th className="num">ACU1</th><th className="num">ACU2</th><th>Explicación</th></tr>
          </thead>
          <tbody>
            {rows.slice(0, 3000).map((r, i) => (
              <tr key={i} className={r.bloque !== 'OB1' ? 'fc' : ''}>
                <td>{r.bloque}</td>
                <td>{r.instr.replace(/\s+/g, ' ').replace(/\s*\/\/.*$/, '')}</td>
                <td>{r.er_antes}</td><td><b>{r.rlo}</b></td><td>{r.sta}</td><td>{r.or}</td><td>{r.ov}</td><td>{r.os}</td><td>{r.cc1}{r.cc0}</td><td>{r.br}</td>
                <td className="num">{r.acu1}</td><td className="num">{r.acu2}</td>
                <td className="expl">{explainRow(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
