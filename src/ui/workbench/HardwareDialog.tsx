// Hardware del proyecto. Primera estación: la CPU, con marca de ciclo.
import { useState } from 'react';
import type { HwEstacion, Programa } from '../../core/program';
import { CLOCK_PERIODS_MS } from '../../core/cpu';
import type { SimController } from '../../sim/SimController';
import { Modal, ContextMenu } from '../common/ui';
import { Icon } from '../common/Icon';
import { useSimTick } from './useSim';

/** Catálogo de estaciones que se pueden añadir. */
const CATALOGO: { tipo: HwEstacion['tipo']; nombre: string; desc: string }[] = [
  { tipo: 'CPU', nombre: 'CPU compacta', desc: 'CPU con 2 acumuladores y E/S integrada (entradas EB124…, salidas AB124…)' },
];

const fmtS = (ms: number) => `${(ms / 1000).toLocaleString('es-ES')} s`;
const fmtHz = (ms: number) => `${(1000 / ms).toLocaleString('es-ES', { maximumFractionDigits: 3 })} Hz`;

export function nuevaEstacion(tipo: HwEstacion['tipo'], n: number): HwEstacion {
  return { id: `hw${Date.now().toString(36)}${n}`, tipo, nombre: `CPU(${n})`, marcaCiclo: { activa: true, byte: 0 } };
}

export function HardwareDialog({ sim, programa, onChange, onClose }: { sim: SimController; programa: Programa; onChange: (p: Programa) => void; onClose: () => void }) {
  useSimTick(sim, 20, () => [sim.rev, sim.cpu.clockByte, sim.cpu.clockByte === null ? 0 : sim.cpu.M[sim.cpu.clockByte]]);
  const estaciones = programa.hw?.estaciones ?? [];
  const [sel, setSel] = useState<string | null>(estaciones[0]?.id ?? null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const actual = estaciones.find((e) => e.id === sel) ?? estaciones[0];

  const setEstaciones = (list: HwEstacion[]) => onChange({ ...programa, hw: { estaciones: list } });
  const upd = (id: string, patch: Partial<HwEstacion>) => setEstaciones(estaciones.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const add = (tipo: HwEstacion['tipo']) => {
    const e = nuevaEstacion(tipo, estaciones.length + 1);
    setEstaciones([...estaciones, e]);
    setSel(e.id);
  };
  const tieneCpu = estaciones.some((e) => e.tipo === 'CPU');

  // ¿el programa escribe en el byte de la marca de ciclo? (la CPU lo sobrescribe en cada ciclo)
  const conflicto = (byte: number) => (sim.usage?.accesses ?? []).some((a) => a.area === 'M' && !a.indirect && a.mode !== 'r' &&
    (a.kind === 'bit' ? a.byte === byte : a.byte <= byte && byte < a.byte + a.size));

  return (
    <Modal title="Hardware del proyecto" onClose={onClose} width={800}
      footer={<button className="btn primary" onClick={onClose}>Cerrar</button>}>
      <div className="hw">
        <div className="hw-list">
          <div className="row" style={{ marginBottom: 8 }}>
            <b style={{ fontSize: 12 }}>Estaciones</b>
            <span className="spacer" />
            <button className="btn small" onClick={(e) => setMenu({ x: e.clientX, y: e.clientY })}><Icon name="plus" size={13} />Añadir</button>
          </div>
          {estaciones.map((e) => (
            <button key={e.id} className={`hw-item ${actual?.id === e.id ? 'cur' : ''}`} onClick={() => setSel(e.id)}>
              <Icon name="cpu" size={15} />
              <span className="grow" style={{ textAlign: 'left' }}>
                <span style={{ display: 'block', fontWeight: 600 }}>{e.nombre}</span>
                <span className="faint" style={{ fontSize: 11 }}>{CATALOGO.find((c) => c.tipo === e.tipo)?.nombre ?? e.tipo}{e.marcaCiclo.activa ? ` · marca de ciclo MB${e.marcaCiclo.byte}` : ''}</span>
              </span>
            </button>
          ))}
          {!estaciones.length && <div className="faint" style={{ fontSize: 12 }}>Sin hardware configurado.</div>}
        </div>
        <div className="hw-props">
          {!actual ? (
            <div className="empty-proj" style={{ padding: '40px 10px' }}>
              <Icon name="cpu" size={28} />
              <h3>El proyecto no tiene hardware</h3>
              <p>Añade una estación para configurar la CPU (por ejemplo, la marca de ciclo).</p>
              {CATALOGO.map((c) => <button key={c.tipo} className="btn primary" onClick={() => add(c.tipo)}><Icon name="plus" size={14} />{c.nombre}</button>)}
            </div>
          ) : (
            <>
              <div className="row" style={{ marginBottom: 12 }}>
                <label className="row grow" style={{ gap: 6 }}>Nombre
                  <input className="input grow" value={actual.nombre} onChange={(e) => upd(actual.id, { nombre: e.target.value })} aria-label="Nombre de la estación" />
                </label>
                <button className="btn small danger" onClick={() => { if (confirm(`¿Quitar «${actual.nombre}» del hardware?`)) setEstaciones(estaciones.filter((x) => x.id !== actual.id)); }}><Icon name="trash" size={13} />Quitar</button>
              </div>
              <div className="hw-sec">
                <div className="hw-sec-title">Ciclo / marca de ciclo</div>
                <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
                  <label className="check"><input type="checkbox" checked={actual.marcaCiclo.activa} onChange={(e) => upd(actual.id, { marcaCiclo: { ...actual.marcaCiclo, activa: e.target.checked } })} />Marca de ciclo</label>
                  <label className="row" style={{ gap: 6 }}>Byte de marcas
                    <input className="input mono" type="number" min={0} max={2047} style={{ width: 80 }} value={actual.marcaCiclo.byte} disabled={!actual.marcaCiclo.activa}
                      onChange={(e) => { const n = Math.max(0, Math.min(2047, parseInt(e.target.value, 10) || 0)); upd(actual.id, { marcaCiclo: { ...actual.marcaCiclo, byte: n } }); }} aria-label="Byte de marcas" />
                  </label>
                </div>
                {actual.marcaCiclo.activa && (
                  <>
                    <table className="tbl hw-table">
                      <thead><tr><th>Bit</th><th>Marca</th><th className="num">Periodo</th><th className="num">Frecuencia</th><th>Ahora</th></tr></thead>
                      <tbody>
                        {CLOCK_PERIODS_MS.map((ms, i) => {
                          const v = sim.cpu.clockByte === actual.marcaCiclo.byte ? (sim.cpu.M[actual.marcaCiclo.byte] >> i) & 1 : 0;
                          return (
                            <tr key={i}>
                              <td className="mono">{i}</td>
                              <td className="mono"><b>M {actual.marcaCiclo.byte}.{i}</b></td>
                              <td className="num">{fmtS(ms)}</td>
                              <td className="num">{fmtHz(ms)}</td>
                              <td><span className={`led ${v ? 'on' : ''}`} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {conflicto(actual.marcaCiclo.byte) && (
                      <div className="warn-text" style={{ fontSize: 12, marginTop: 8 }}>⚠ Tu programa escribe en MB{actual.marcaCiclo.byte}: la CPU sobrescribe ese byte en cada ciclo con la marca de ciclo.</div>
                    )}
                    <div className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>
                      Cada bit oscila solo, con pulso y pausa iguales (la mitad del periodo a 1 y la otra mitad a 0). Úsalos en el programa como cualquier marca, por ejemplo <span className="mono">U M {actual.marcaCiclo.byte}.5</span> para un intermitente de 1 s.
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)}
          items={CATALOGO.map((c) => ({ label: `${c.nombre} — ${c.desc}`, disabled: c.tipo === 'CPU' && tieneCpu, onClick: () => add(c.tipo) }))} />
      )}
    </Modal>
  );
}
