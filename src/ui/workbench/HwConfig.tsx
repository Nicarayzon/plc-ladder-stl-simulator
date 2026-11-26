// Configuración del hardware del equipo: el bastidor con la fuente, la CPU compacta y sus E/S integradas. Doble clic
// en la CPU abre sus propiedades (General y Ciclo/Marca de ciclo). Los cambios se guardan con «Equipo ▸ Guardar y
// compilar» y solo los usa la CPU después de «Sistema de destino ▸ Cargar en módulo», que pide pasar a STOP.
// La guía «Activar la marca de ciclo» (guiaCicloEstado.ts) lee lo que la ventana tiene abierto y señala sus controles (`data-guia`).
import { useEffect, useRef, useState } from 'react';
import { hwSinCargar, clockByteOf, clockByteGuardado, type HwEstacion, type Programa } from '../../core/program';
import { hwDe, MAX_BYTE_MARCAS } from '../../core/hardware';
import { CLOCK_PERIODS_MS } from '../../core/cpu';
import type { SimController } from '../../sim/SimController';
import { VentanaFlotante } from '../common/VentanaFlotante';
import { ContextMenu, Modal, toast, type MenuItem } from '../common/ui';
import { Icon } from '../common/Icon';
import { Rico } from '../common/Rico';
import { useSimTick } from './useSim';
import { T } from '../../i18n';
import { HW_CERRADA, useGuiaCiclo } from './guiaCicloEstado';

/** Petición de abrir la configuración (`n` distinto en cada petición) */
export interface HwPedido { n: number }

type Pestana = 'general' | 'arranque' | 'ciclo' | 'remanencia' | 'alarmas';
const PESTANAS: Pestana[] = ['general', 'arranque', 'ciclo', 'remanencia', 'alarmas'];
const ACTIVAS = new Set<Pestana>(['general', 'ciclo']);

const fmtS = (ms: number) => `${(ms / 1000).toLocaleString(T.locale)} s`;
const fmtHz = (ms: number) => `${(1000 / ms).toLocaleString(T.locale, { maximumFractionDigits: 3 })} Hz`;
const copia = <X,>(x: X): X => structuredClone(x);

export function HwConfig({ sim, programa, onChange, onCerrar }: {
  sim: SimController;
  programa: Programa;
  onChange: (p: Programa) => void;
  onCerrar: () => void;
}) {
  useSimTick(sim, 10, () => [sim.rev, sim.cpu.state]);
  // sin hardware guardado, el bastidor empieza con la CPU (sin marca de ciclo)
  const [porDefecto] = useState(() => hwDe(programa));
  const guardado = programa.hw ?? porDefecto;
  const [borrador, setBorrador] = useState(() => copia(guardado));
  const [sel, setSel] = useState('cpu');
  const [props, setProps] = useState<{ pestana: Pestana } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);

  const cpu = borrador.estaciones.find((e) => e.tipo === 'CPU') ?? borrador.estaciones[0];
  const sucio = JSON.stringify(borrador) !== JSON.stringify(guardado);

  // lo que la guía necesita saber de la ventana
  useEffect(() => {
    useGuiaCiclo.getState().ponerHw({ abierta: true });
    return () => useGuiaCiclo.getState().ponerHw(HW_CERRADA);
  }, []);
  useEffect(() => { useGuiaCiclo.getState().ponerHw({ borradorCiclo: cpu.marcaCiclo.activa, sucio }); }, [cpu.marcaCiclo.activa, sucio]);

  const guardarCompilar = (): Programa => {
    const p = { ...programa, hw: copia(borrador) };
    onChange(p);
    toast(T.hw.guardadoToast);
    return p;
  };

  const cargar = () => {
    let p = programa;
    if (sucio) {
      if (!confirm(T.hw.guardarAntes)) return;
      p = guardarCompilar();
    } else if (!programa.hw) p = { ...programa, hw: copia(borrador) };
    const enRun = sim.cpu.state === 'RUN';
    if (enRun) {
      if (!confirm(T.hw.pasarAStop(cpu.nombre))) {
        if (p !== programa) onChange(p);
        return;
      }
      sim.setRun(false);
    }
    const cargado = { ...p, hwCargado: copia(p.hw) };
    onChange(cargado);
    sim.setProgram(cargado);
    toast(T.hw.cargadoToast);
    if (enRun && confirm(T.hw.arrancar(cpu.nombre))) sim.setRun(true);
  };

  const cerrar = () => {
    if (sucio && !confirm(T.hw.confirmarCerrar)) return;
    onCerrar();
  };

  // Ctrl+S (⌘S) = Guardar y compilar mientras la ventana está abierta, tenga o no el foco (no con las propiedades abiertas)
  const atajo = useRef(guardarCompilar);
  atajo.current = guardarCompilar;
  const conProps = useRef(false);
  conProps.current = !!props;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !conProps.current) { e.preventDefault(); atajo.current(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const ponerCpu = (n: HwEstacion) => setBorrador((b) => ({ estaciones: b.estaciones.map((e) => (e.id === cpu.id ? n : e)) }));

  const abrirMenu = (e: React.MouseEvent, items: MenuItem[]) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ x: r.left, y: r.bottom + 2, items });
  };
  const menuEquipo: MenuItem[] = [
    { label: T.hw.guardarCompilar, hint: 'Ctrl+S', onClick: guardarCompilar },
    { sep: true, label: '' },
    { label: T.hw.cerrar, onClick: cerrar },
  ];
  const menuSistema: MenuItem[] = [{ label: T.hw.cargarModulo, onClick: cargar }];

  const filas: { id: string; slot: string; modulo?: string; nombre?: string; e?: string; a?: string }[] = [
    { id: 'ps', slot: '1', modulo: T.hw.fuente },
    { id: 'cpu', slot: '2', modulo: T.hw.cpuCompacta, nombre: cpu.nombre },
    { id: 'es', slot: '2.2', modulo: T.hw.esIntegradas, e: '124…125', a: '124…125' },
    { id: 's3', slot: '3' },
    { id: 's4', slot: '4' },
    { id: 's5', slot: '5' },
  ];

  const estado = sucio ? T.hw.sinGuardar : !programa.hw ? T.hw.dobleClicCpu : hwSinCargar(programa) ? T.hw.guardadoSinCargar : T.hw.cargado;
  const cls = sucio || hwSinCargar(programa) ? 'warn' : '';
  return (
    <VentanaFlotante titulo={T.hw.titulo(T.hw.equipo)} icono="cpu" clave="automatizacion-hw-ventana" z={41} minW={560} minH={320} className="hwc"
      inicial={() => ({ x: Math.max(240, (window.innerWidth - 780) / 2), y: 80, w: 780, h: 460 })} onCerrar={cerrar}>
      <div className="hwc-cuerpo">
        <div className="hwc-menus" role="menubar">
          <button className="btn small ghost" role="menuitem" onClick={(e) => abrirMenu(e, menuEquipo)}>{T.hw.menuEquipo}</button>
          <button className="btn small ghost" role="menuitem" onClick={(e) => abrirMenu(e, menuSistema)}>{T.hw.menuSistema}</button>
          <span className="sep" />
          <button className="btn small icon" onClick={guardarCompilar} title={`${T.hw.guardarCompilar} (Ctrl+S)`} aria-label={T.hw.guardarCompilar} data-guia="guardar"><Icon name="save" size={14} /></button>
          <button className="btn small icon" onClick={cargar} title={T.hw.cargarModulo} aria-label={T.hw.cargarModulo} data-guia="cargar"><Icon name="download" size={14} /></button>
          <span className="spacer" />
          <span className={`led ${sim.cpu.state === 'RUN' ? 'on' : ''}`} /><span className="faint" style={{ fontSize: 11.5 }}>{cpu.nombre}: {sim.cpu.state}</span>
        </div>
        <div className="hwc-rack">
          <div className="hwc-rack-tit"><Icon name="cpu" size={13} />{T.hw.bastidor}</div>
          <table className="tbl hwc-tabla" role="grid">
            <thead><tr><th>{T.hw.slot}</th><th>{T.hw.modulo}</th><th>{T.hw.dirE}</th><th>{T.hw.dirA}</th><th>{T.hw.comentario}</th></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className={`${sel === f.id ? 'sel' : ''} ${f.modulo ? '' : 'vacio'}`} tabIndex={0} aria-selected={sel === f.id} data-guia={f.id === 'cpu' ? 'cpu-fila' : undefined}
                  onClick={() => setSel(f.id)}
                  onDoubleClick={() => { if (f.id === 'cpu') setProps({ pestana: 'general' }); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && f.id === 'cpu') setProps({ pestana: 'general' }); }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setSel(f.id);
                    if (f.id === 'cpu') setMenu({ x: e.clientX, y: e.clientY, items: [{ label: T.hw.propiedadesObjeto, onClick: () => setProps({ pestana: 'general' }) }] });
                  }}>
                  <td className="mono">{f.slot}</td>
                  <td>{f.id === 'cpu' ? <b>{f.modulo}</b> : f.modulo ?? ''}</td>
                  <td className="mono">{f.e ?? ''}</td>
                  <td className="mono">{f.a ?? ''}</td>
                  <td>{f.nombre ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={`hwc-estado ${cls}`} data-guia="estado-hw">
          <span className="grow"><Rico t={estado} /></span>
          <span className="faint">{T.hw.guardado(clockByteGuardado(programa))} · {T.hw.enCpu(clockByteOf(programa))}</span>
        </div>
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
      {props && (
        <CpuPropiedades sim={sim} cpu={cpu} pestana={props.pestana}
          onAceptar={(n) => { ponerCpu(n); setProps(null); }} onCancelar={() => setProps(null)} />
      )}
    </VentanaFlotante>
  );
}

/** «Propiedades — CPU(1)»: General y Ciclo/Marca de ciclo. Las demás pestañas se ven, desactivadas. */
function CpuPropiedades({ sim, cpu, pestana: inicial, onAceptar, onCancelar }: {
  sim: SimController;
  cpu: HwEstacion;
  pestana: Pestana;
  onAceptar: (cpu: HwEstacion) => void;
  onCancelar: () => void;
}) {
  useSimTick(sim, 20, () => [sim.rev, sim.cpu.clockByte, sim.cpu.clockByte === null ? 0 : sim.cpu.M[sim.cpu.clockByte]]);
  const [pestana, setPestana] = useState<Pestana>(inicial);
  const [d, setD] = useState<HwEstacion>(() => copia(cpu));
  const mc = d.marcaCiclo;
  useEffect(() => { useGuiaCiclo.getState().ponerHw({ props: { pestana, activa: mc.activa, byte: mc.byte } }); }, [pestana, mc.activa, mc.byte]);
  useEffect(() => () => useGuiaCiclo.getState().ponerHw({ props: null }), []);
  // ¿el programa escribe en el byte de la marca de ciclo? (la CPU lo sobrescribe en cada ciclo)
  const conflicto = (sim.usage?.accesses ?? []).some((a) => a.area === 'M' && !a.indirect && a.mode !== 'r' &&
    (a.kind === 'bit' ? a.byte === mc.byte : a.byte <= mc.byte && mc.byte < a.byte + a.size));
  return (
    <Modal title={T.hw.propiedades(d.nombre || cpu.nombre)} onClose={onCancelar} width={680}
      footer={<>
        <button className="btn primary" onClick={() => onAceptar(d)} data-guia="aceptar">{T.comun.aceptar}</button>
        <button className="btn" onClick={onCancelar}>{T.comun.cancelar}</button>
      </>}>
      <div className="hwp-tabs" role="tablist">
        {PESTANAS.map((p) => (
          <button key={p} role="tab" aria-selected={pestana === p} className={`hwp-tab ${pestana === p ? 'active' : ''}`} disabled={!ACTIVAS.has(p)} data-guia={p === 'ciclo' ? 'tab-ciclo' : undefined}
            title={ACTIVAS.has(p) ? undefined : T.hw.noDisponible} onClick={() => setPestana(p)}>{T.hw.tabs[p]}</button>
        ))}
      </div>
      <div className="hwp-cuerpo">
        {pestana === 'general' && (
          <div className="hwp-general">
            <label className="row" style={{ gap: 8 }}>{T.hw.nombre}
              <input className="input grow" value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} aria-label={T.hw.nombreEstacion} />
            </label>
            <div className="row" style={{ gap: 8 }}><span className="faint">{T.hw.tipo}</span><b>{T.hw.cpuCompacta}</b></div>
            <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}><span className="faint">{T.hw.descripcion}</span><span>{T.hw.cpuCompactaDesc}</span></div>
          </div>
        )}
        {pestana === 'ciclo' && (
          <>
            <div className="hw-sec">
              <div className="hw-sec-title">{T.hw.cicloSec}</div>
              <div className="faint" style={{ fontSize: 12 }}>{T.hw.tiempoCiclo(sim.cpu.cycleMs)}</div>
            </div>
            <div className="hw-sec">
              <div className="hw-sec-title">{T.hw.marcaCiclo}</div>
              <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
                <label className="check" data-guia="check-ciclo"><input type="checkbox" checked={mc.activa} onChange={(e) => setD({ ...d, marcaCiclo: { ...mc, activa: e.target.checked } })} />{T.hw.marcaCiclo}</label>
                <label className="row" style={{ gap: 6 }} data-guia="byte-ciclo">{T.hw.byteMarcas}
                  <input className="input mono" type="number" min={0} max={MAX_BYTE_MARCAS} style={{ width: 80 }} value={mc.byte} disabled={!mc.activa}
                    onChange={(e) => { const n = Math.max(0, Math.min(MAX_BYTE_MARCAS, parseInt(e.target.value, 10) || 0)); setD({ ...d, marcaCiclo: { ...mc, byte: n } }); }} aria-label={T.hw.byteMarcas} />
                </label>
              </div>
              {mc.activa && (
                <>
                  <table className="tbl hw-table">
                    <thead><tr><th>{T.hw.bit}</th><th>{T.hw.marca}</th><th className="num">{T.hw.periodo}</th><th className="num">{T.hw.frecuencia}</th><th>{T.hw.ahora}</th></tr></thead>
                    <tbody>
                      {CLOCK_PERIODS_MS.map((ms, i) => {
                        const v = sim.cpu.clockByte === mc.byte ? (sim.cpu.M[mc.byte] >> i) & 1 : 0;
                        return (
                          <tr key={i}>
                            <td className="mono">{i}</td>
                            <td className="mono"><b>M {mc.byte}.{i}</b></td>
                            <td className="num">{fmtS(ms)}</td>
                            <td className="num">{fmtHz(ms)}</td>
                            <td><span className={`led ${v ? 'on' : ''}`} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {conflicto && <div className="warn-text" style={{ fontSize: 12, marginTop: 8 }}>{T.hw.conflicto(mc.byte)}</div>}
                  <div className="faint simbolos-nota" style={{ fontSize: 11.5, marginTop: 8 }}><Rico t={T.hw.explicacion(mc.byte)} /></div>
                </>
              )}
              <div className="faint" style={{ fontSize: 11.5, marginTop: 8 }}><Rico t={T.hw.pasos} /></div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
