import type { SimController } from '../../sim/SimController';
import { useSimTick } from './useSim';
import { S5_BASES_MS } from '../../core/num';
import { fmtDuration } from '../../core/format';
import { T } from '../../i18n';

const TIPO: Record<string, string> = T.tz.tipos;

export function TzPanel({ sim, symByAddr }: { sim: SimController; symByAddr: Map<string, string> }) {
  const u = sim.usage;
  const cpu = sim.cpu;
  const timers = u ? [...u.timers.keys()].sort((a, b) => a - b) : [];
  const counters = u ? [...u.counters].sort((a, b) => a - b) : [];
  useSimTick(sim, 20, () => {
    const f: unknown[] = [sim.rev];
    for (const n of timers) { const t = cpu.timers[n]; f.push(t.value, t.running, t.running ? t.accMs : 0, t.q, t.mode, t.base, t.initValue); }
    for (const n of counters) f.push(cpu.counters[n].value);
    return f;
  });
  if (!timers.length && !counters.length) return <div className="panel-sec muted">{T.tz.ninguno}</div>;
  return (
    <div>
      {timers.length > 0 && (
        <div className="panel-sec">
          <h4>{T.tz.temporizadores}</h4>
          <table className="tbl">
            <thead><tr><th>T</th><th>{T.tz.tipo}</th><th>{T.tz.estado}</th><th className="num">{T.tz.resta}</th><th>{T.tz.base}</th><th>Q</th></tr></thead>
            <tbody>
              {timers.map((n) => {
                const t = cpu.timers[n];
                const base = S5_BASES_MS[t.base];
                const rest = t.value * base - (t.running ? t.accMs : 0);
                const pct = t.initValue ? Math.max(0, Math.min(100, (rest / (t.initValue * base)) * 100)) : 0;
                const estado = t.running ? 'contando' : t.mode === null ? 'parado' : t.q || t.mode === 'SE' || t.mode === 'SS' ? 'terminado' : 'parado';
                const modes = [...(u!.timers.get(n) ?? [])];
                const sym = symByAddr.get(`T${n}`);
                return (
                  <tr key={n}>
                    <td className="mono" title={sym}>T {n}{sym && <div className="faint" style={{ fontSize: 10.5 }}>{sym}</div>}</td>
                    <td style={{ fontSize: 11.5 }}>{(t.mode ?? modes[0]) ? <span title={TIPO[t.mode ?? modes[0]]}>{t.mode ?? modes[0]}</span> : '—'}</td>
                    <td style={{ fontSize: 11.5 }}>
                      <span className={estado === 'contando' ? 'warn-text' : estado === 'terminado' ? 'ok-text' : 'muted'}>{T.tz.estados[estado]}</span>
                      <div className="tz-bar" style={{ marginTop: 3 }}><div style={{ width: `${pct}%` }} /></div>
                    </td>
                    <td className="num">{fmtDuration(Math.max(0, rest)).toLowerCase()}</td>
                    <td className="mono" style={{ fontSize: 11.5 }}>{fmtDuration(base).toLowerCase()}</td>
                    <td><span className={`led ${t.q ? 'on' : ''}`} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {counters.length > 0 && (
        <div className="panel-sec">
          <h4>{T.tz.contadores}</h4>
          <table className="tbl">
            <thead><tr><th>Z</th><th className="num">{T.tz.valor}</th><th>BCD</th><th>Q</th></tr></thead>
            <tbody>
              {counters.map((n) => {
                const c = cpu.counters[n];
                const sym = symByAddr.get(`Z${n}`);
                return (
                  <tr key={n}>
                    <td className="mono">Z {n}{sym && <div className="faint" style={{ fontSize: 10.5 }}>{sym}</div>}</td>
                    <td className="num">{c.value}</td>
                    <td className="mono">C#{c.value}</td>
                    <td><span className={`led ${c.value > 0 ? 'on' : ''}`} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
