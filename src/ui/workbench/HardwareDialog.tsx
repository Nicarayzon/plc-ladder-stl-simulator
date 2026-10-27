// Hardware del proyecto. Primera estación: la CPU, con marca de ciclo.
import { useState } from 'react';
import type { HwEstacion, Programa } from '../../core/program';
import { CLOCK_PERIODS_MS } from '../../core/cpu';
import type { SimController } from '../../sim/SimController';
import { Modal, ContextMenu } from '../common/ui';
import { Icon } from '../common/Icon';
import { useSimTick } from './useSim';
import { T } from '../../i18n';
import { Rico } from '../common/Rico';

/** Catálogo de estaciones que se pueden añadir. */
const CATALOGO: { tipo: HwEstacion['tipo']; nombre: string; desc: string }[] = [
  { tipo: 'CPU', nombre: T.hw.cpuCompacta, desc: T.hw.cpuCompactaDesc },
];

const fmtS = (ms: number) => `${(ms / 1000).toLocaleString(T.locale)} s`;
const fmtHz = (ms: number) => `${(1000 / ms).toLocaleString(T.locale, { maximumFractionDigits: 3 })} Hz`;

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
    <Modal title={T.hw.titulo} onClose={onClose} width={800}
      footer={<button className="btn primary" onClick={onClose}>{T.comun.cerrar}</button>}>
      <div className="hw">
        <div className="hw-list">
          <div className="row" style={{ marginBottom: 8 }}>
            <b style={{ fontSize: 12 }}>{T.hw.estaciones}</b>
            <span className="spacer" />
            <button className="btn small" onClick={(e) => setMenu({ x: e.clientX, y: e.clientY })}><Icon name="plus" size={13} />{T.hw.anadir}</button>
          </div>
          {estaciones.map((e) => (
            <button key={e.id} className={`hw-item ${actual?.id === e.id ? 'cur' : ''}`} onClick={() => setSel(e.id)}>
              <Icon name="cpu" size={15} />
              <span className="grow" style={{ textAlign: 'left' }}>
                <span style={{ display: 'block', fontWeight: 600 }}>{e.nombre}</span>
                <span className="faint" style={{ fontSize: 11 }}>{CATALOGO.find((c) => c.tipo === e.tipo)?.nombre ?? e.tipo}{e.marcaCiclo.activa ? T.hw.marcaCicloMb(e.marcaCiclo.byte) : ''}</span>
              </span>
            </button>
          ))}
          {!estaciones.length && <div className="faint" style={{ fontSize: 12 }}>{T.hw.sinHardware}</div>}
        </div>
        <div className="hw-props">
          {!actual ? (
            <div className="empty-proj" style={{ padding: '40px 10px' }}>
              <Icon name="cpu" size={28} />
              <h3>{T.hw.noTiene}</h3>
              <p>{T.hw.anadeEstacion}</p>
              {CATALOGO.map((c) => <button key={c.tipo} className="btn primary" onClick={() => add(c.tipo)}><Icon name="plus" size={14} />{c.nombre}</button>)}
            </div>
          ) : (
            <>
              <div className="row" style={{ marginBottom: 12 }}>
                <label className="row grow" style={{ gap: 6 }}>{T.hw.nombre}
                  <input className="input grow" value={actual.nombre} onChange={(e) => upd(actual.id, { nombre: e.target.value })} aria-label={T.hw.nombreEstacion} />
                </label>
                <button className="btn small danger" onClick={() => { if (confirm(T.hw.confirmarQuitar(actual.nombre))) setEstaciones(estaciones.filter((x) => x.id !== actual.id)); }}><Icon name="trash" size={13} />{T.hw.quitar}</button>
              </div>
              <div className="hw-sec">
                <div className="hw-sec-title">{T.hw.cicloSec}</div>
                <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
                  <label className="check"><input type="checkbox" checked={actual.marcaCiclo.activa} onChange={(e) => upd(actual.id, { marcaCiclo: { ...actual.marcaCiclo, activa: e.target.checked } })} />{T.hw.marcaCiclo}</label>
                  <label className="row" style={{ gap: 6 }}>{T.hw.byteMarcas}
                    <input className="input mono" type="number" min={0} max={2047} style={{ width: 80 }} value={actual.marcaCiclo.byte} disabled={!actual.marcaCiclo.activa}
                      onChange={(e) => { const n = Math.max(0, Math.min(2047, parseInt(e.target.value, 10) || 0)); upd(actual.id, { marcaCiclo: { ...actual.marcaCiclo, byte: n } }); }} aria-label={T.hw.byteMarcas} />
                  </label>
                </div>
                {actual.marcaCiclo.activa && (
                  <>
                    <table className="tbl hw-table">
                      <thead><tr><th>{T.hw.bit}</th><th>{T.hw.marca}</th><th className="num">{T.hw.periodo}</th><th className="num">{T.hw.frecuencia}</th><th>{T.hw.ahora}</th></tr></thead>
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
                      <div className="warn-text" style={{ fontSize: 12, marginTop: 8 }}>{T.hw.conflicto(actual.marcaCiclo.byte)}</div>
                    )}
                    <div className="faint simbolos-nota" style={{ fontSize: 11.5, marginTop: 8 }}>
                      <Rico t={T.hw.explicacion(actual.marcaCiclo.byte)} />
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
