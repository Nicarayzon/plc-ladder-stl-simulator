import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SimController } from '../../sim/SimController';
import { normBlockName } from '../../core/compiler';
import { segId, type Programa, type Segmento, type ProgramIssue } from '../../core/program';
import { Toolbar } from './Toolbar';
import { SegmentCard } from './SegmentCard';
import { IoPanel, useTeclasEntradas } from './IoPanel';
import { VatPanel, type VatRow } from './VatPanel';
import { TzPanel } from './TzPanel';
import { CpuPanel } from './CpuPanel';
import { SymbolsPanel } from './SymbolsPanel';
import { AnalyzerPanel, anadirSenalesES } from './AnalyzerPanel';
import { GeneratedAwl, MessagesPanel, TracePanel } from './BottomPanels';
import { Icon } from '../common/Icon';
import { ContextMenu, Tabs, toast, useSplit } from '../common/ui';
import { useSimTick } from './useSim';
import { symbolsByAddr } from './symbols';
import * as ops from './programOps';
import type { VatFila, WbState } from './types';
import { kopToAwlText } from '../../kop/compile';
import { askText } from '../common/ask';
import { HardwareDialog, nuevaEstacion } from './HardwareDialog';
import { clockByteOf } from '../../core/program';
import { useSettings } from '../../store/settings';
import { lintProgram, marcasNuncaEscritas } from '../../core/lint';
import { translateAwl } from '../../core/translate';
import { SenalesFuera, type SenalesVentana } from './SenalesVentana';
import { VatFlotante, VatVista, useTablasVat } from './VatVentana';
import type { SignalView } from '../../sim/analyzer';
import { T } from '../../i18n';
import { Rico } from '../common/Rico';

type RightTab = 'io' | 'vat' | 'tz' | 'cpu' | 'sym';
/** `vat:VAT_1`: tabla de variables acoplada abajo */
type BottomTab = 'an' | 'msg' | 'awl' | 'trace' | `vat:${string}`;

export interface WorkbenchProps {
  sim: SimController;
  programa: Programa;
  onChange: (p: Programa) => void;
  title?: ReactNode;
  extraToolbar?: ReactNode;
  wbState: WbState;
  onWbState: (s: WbState) => void;
  readOnly?: boolean;
  /** Entradas configuradas como NC (para el aviso L08) */
  ncInputs?: string[];
  initialRight?: RightTab;
  initialBottom?: BottomTab;
  compact?: boolean;
  /** Clave para recordar el ancho del panel derecho */
  layoutKey?: string;
  /** Panel E/S con interruptores fijos E124/A124 (simulador libre) */
  ioVariant?: 'classic' | 'switches';
  /** Bloque activo controlado desde fuera (explorador de proyectos) */
  block?: string;
  onBlock?: (b: string) => void;
  /** Botón «Hardware» (configuración de la CPU, marca de ciclo) */
  hardware?: boolean;
  /** Botón «Señales E/S»: el panel de abajo se abre a mano y las señales pueden ir a otra ventana */
  senales?: SenalesVentana & { nombre?: string };
  /** Tablas de variables del proyecto (`wbState.vats`) en una ventana flotante dentro de la app o abajo, en lugar de las pestañas «Variables» y «T / Z» */
  vatVentanas?: boolean;
  /** Nombre del proyecto, para el título de las tablas de variables */
  proyecto?: string;
  /** Abrir una tabla de variables desde el explorador (`n` cambia en cada petición) */
  vatPedida?: { nombre: string; n: number } | null;
  onVatAtendida?: () => void;
}

const leerBool = (k: string, def: boolean) => {
  try { const v = localStorage.getItem(k); return v === null ? def : v === '1'; } catch { return def; }
};
const guardarBool = (k: string, v: boolean) => {
  try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* sin almacenamiento */ }
};

export function Workbench(props: WorkbenchProps) {
  const { sim, programa, onChange, wbState, onWbState, readOnly } = props;
  const [blockLocal, setBlockLocal] = useState('OB1');
  const block = props.block ?? blockLocal;
  const setBlock = (b: string) => { setBlockLocal(b); props.onBlock?.(b); };
  const vatEnVentana = !!props.vatVentanas;
  const [rightSel, setRight] = useState<RightTab>(props.initialRight ?? 'io');
  const right: RightTab = vatEnVentana && (rightSel === 'vat' || rightSel === 'tz') ? 'io' : rightSel;
  const [bottomSel, setBottom] = useState<BottomTab>(props.initialBottom ?? 'an');
  const vats = vatEnVentana ? wbState.vats ?? [] : [];
  const setFilas = (nombre: string, filas: VatFila[]) => onWbState({ ...wbState, vats: vats.map((v) => (v.nombre === nombre ? { ...v, filas } : v)) });
  // con «Señales E/S» el panel de abajo empieza cerrado (solo las pestañas) y se recuerda
  const senales = props.senales;
  const openKey = `${props.layoutKey ?? 'wb'}-panel-abajo`;
  const [bottomOpen, setBottomOpenState] = useState(() => (senales ? leerBool(openKey, false) : true));
  const setBottomOpen = (v: boolean) => { setBottomOpenState(v); if (senales) guardarBool(openKey, v); };
  const showBottom = (t: BottomTab) => { setBottom(t); setBottomOpen(true); };
  const tablas = useTablasVat(sim, vats.map((v) => v.nombre), (nombre) => showBottom(`vat:${nombre}`));
  const vatsAbajo = tablas.abiertas.filter((a) => a.modo === 'abajo');
  // una tabla que ya no está abajo (cerrada o pasada a ventana): vuelven las señales
  const bottom: BottomTab = bottomSel.startsWith('vat:') && !vatsAbajo.some((a) => `vat:${a.nombre}` === bottomSel) ? 'an' : bottomSel;
  const pedida = props.vatPedida;
  useEffect(() => {
    if (!pedida) return;
    tablas.abrir(pedida.nombre);
    props.onVatAtendida?.();
  }, [pedida?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  useTeclasEntradas(sim, props.ioVariant === 'switches');
  const senalesFuera = senales?.win ?? null;
  const senalesVisibles = !!senalesFuera || (bottomOpen && bottom === 'an');
  const onSignals = (signals: { text: string; view: SignalView }[]) => onWbState({ ...wbState, signals });
  /** Al enseñar las señales sin ninguna elegida: las entradas y salidas del programa */
  const senalesPorDefecto = () => {
    if (anadirSenalesES(sim)) onSignals(sim.analyzer.signals.map((x) => ({ text: x.text, view: x.view })));
  };
  const botonSenales = () => {
    if (senalesFuera) senalesFuera.focus();
    else if (bottomOpen && bottom === 'an') setBottomOpen(false);
    else { senalesPorDefecto(); showBottom('an'); }
  };
  const sacarSenales = () => {
    if (!senales) return;
    if (senalesFuera) { senales.cerrar(); showBottom('an'); return; }
    senalesPorDefecto();
    senales.abrir();
    if (bottom === 'an') setBottomOpen(false); // el sitio de abajo queda para el código
  };
  const [observe, setObserve] = useState(true);
  const [focusSeg, setFocusSeg] = useState<string | null>(null);
  const [blockMenu, setBlockMenu] = useState<{ x: number; y: number; name?: string } | null>(null);
  const [hwOpen, setHwOpen] = useState(false);
  const clockByte = clockByteOf(programa);
  /** Marcas consultadas que nunca se escriben: probable marca de ciclo sin activar */
  const pistaCiclo = useMemo(() => (props.hardware && sim.compiled.cp ? marcasNuncaEscritas(sim.compiled.cp, clockByte) : []), [sim.compiled, clockByte, props.hardware]);
  const activarCiclo = (byte: number) => {
    const est = programa.hw?.estaciones ?? [];
    const cpu = est.find((e) => e.tipo === 'CPU');
    const list = cpu ? est.map((e) => (e === cpu ? { ...e, marcaCiclo: { activa: true, byte } } : e)) : [...est, { ...nuevaEstacion('CPU', est.length + 1), marcaCiclo: { activa: true, byte } }];
    change({ ...programa, hw: { estaciones: list } });
  };
  const [rightW, startRight] = useSplit(`${props.layoutKey ?? 'wb'}-right`, props.compact ? 290 : 360, 220, 720);
  const [bottomH, startBottom] = useSplit(`${props.layoutKey ?? 'wb'}-bottom`, props.compact ? 200 : 230, 90, 700);
  const nemo = programa.nemotecnia;
  // solo cambios de programa, RUN/STOP, errores…: los valores en vivo los repinta cada panel
  useSimTick(sim, 4, () => [sim.rev, sim.cpu.state]);

  // historial para deshacer cambios estructurales y del KOP
  const past = useRef<Programa[]>([]);
  const future = useRef<Programa[]>([]);
  const lastPush = useRef(0);
  const change = useCallback((p: Programa, structural = true) => {
    const now = Date.now();
    if (structural || now - lastPush.current > 1200) {
      past.current.push(programa);
      if (past.current.length > 200) past.current.shift();
      future.current = [];
      lastPush.current = now;
    }
    onChange(p);
  }, [programa, onChange]);

  useEffect(() => {
    const w = window as unknown as { __kopUndo?: () => void; __kopRedo?: () => void };
    w.__kopUndo = () => {
      const p = past.current.pop();
      if (p) { future.current.push(programa); onChange(p); }
    };
    w.__kopRedo = () => {
      const p = future.current.pop();
      if (p) { past.current.push(programa); onChange(p); }
    };
    return () => { delete w.__kopUndo; delete w.__kopRedo; };
  }, [programa, onChange]);

  // compilación diferida
  useEffect(() => {
    const t = setTimeout(() => sim.setProgram(programa), 400);
    return () => clearTimeout(t);
  }, [programa, sim]);

  // bloque activo válido
  const blocks = programa.bloques.map((b) => normBlockName(b.nombre));
  useEffect(() => {
    if (!blocks.includes(block)) setBlock(blocks[0] ?? 'OB1');
  }, [blocks.join(','), block]); // eslint-disable-line react-hooks/exhaustive-deps

  const blk = programa.bloques.find((b) => normBlockName(b.nombre) === block);
  const symByAddr = useMemo(() => symbolsByAddr(programa), [programa.simbolos]); // eslint-disable-line react-hooks/exhaustive-deps
  const symbolNames = useMemo(() => programa.simbolos.map((s) => s.nombre).filter(Boolean), [programa.simbolos]);
  const warnings: ProgramIssue[] = useMemo(() => [...sim.compiled.warnings, ...(sim.compiled.cp ? lintProgram(programa, sim.compiled, { ncInputs: props.ncInputs }) : [])], [sim.compiled, programa, props.ncInputs]);

  const segOps = (s: Segmento) => {
    const id = segId(s);
    return {
      move: (d: -1 | 1) => change(ops.moveSegment(programa, block, id, d)),
      duplicate: () => change(ops.duplicateSegment(programa, block, id)),
      remove: () => { if (confirm(T.wb.confirmarBorrarSegmento)) change(ops.deleteSegment(programa, block, id)); },
      insertAfter: (lang: 'AWL' | 'KOP') => { const n = ops.newSegment(lang); change(ops.insertSegment(programa, block, id, n)); setFocusSeg(segId(n)); },
      toAwl: s.lang === 'KOP' ? () => {
        let txt = kopToAwlText(s.kop, block);
        // metas internas _nnn → metas libres de 4 caracteres
        let k = 0;
        txt = txt.replace(/_(\d{3})/g, () => `K${String(++k).padStart(3, '0')}`.slice(0, 4));
        if (nemo === 'en') txt = translateAwl(txt, 'en');
        change(ops.updateSegment(programa, block, id, () => ({ lang: 'AWL', id, titulo: s.kop.titulo, comentario: s.kop.comentario, awl: txt })));
      } : undefined,
      toKop: s.lang === 'AWL' ? () => {
        if (s.awl.trim()) { toast(T.wb.sinKop); return; }
        const k = ops.newKopSegment();
        change(ops.updateSegment(programa, block, id, () => ({ lang: 'KOP', kop: { ...k, id, titulo: s.titulo, comentario: s.comentario } })));
      } : undefined,
    };
  };

  const gotoSeg = (b: string, seg?: string) => {
    if (blocks.includes(b)) setBlock(b);
    if (seg) setTimeout(() => document.getElementById(`seg-${seg}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const stop = sim.lastStop;
  const blockErr = (b: string) => sim.compiled.errors.some((e) => e.block === b);

  const blockItems = (name?: string) => {
    const items = [
      ...(blocks.includes('OB1') ? [] : [{ label: T.wb.crearOb1, disabled: false, onClick: () => { change(ops.addBlock(programa, 'OB1')); setBlock('OB1'); } }]),
      { label: T.wb.anadir(ops.nextFc(programa)), onClick: () => { const n = ops.nextFc(programa); change(ops.addBlock(programa, n)); setBlock(n); } },
      { label: T.wb.anadirOb100, disabled: blocks.includes('OB100'), onClick: () => { change(ops.addBlock(programa, 'OB100')); setBlock('OB100'); } },
    ];
    if (name && name !== 'OB1') {
      items.push({ label: T.libre.borrarX(name), disabled: false, onClick: () => { if (confirm(T.wb.confirmarBorrarBloque(name))) change(ops.removeBlock(programa, name)); } });
      if (name.startsWith('FC')) items.push({ label: T.libre.renombrarX(name), disabled: false, onClick: async () => {
        const to = (await askText({ title: T.libre.renombrarTitulo(name), label: T.libre.nuevoNombreFc, value: name, validate: (v) => {
          const t = v.toUpperCase().replace(/\s+/g, '');
          return !/^FC\d+$/.test(t) ? T.libre.fcInvalida : blocks.includes(t) && t !== name ? T.libre.yaExiste(t) : null;
        } }))?.toUpperCase().replace(/\s+/g, '');
        if (to && to !== name) { change(ops.renameBlock(programa, name, to)); setBlock(to); }
      } });
    }
    return items;
  };

  const setNemo = (n: 'de' | 'en') => {
    if (n === nemo) return;
    const conv = confirm(T.wb.convertirNemotecnia(n));
    const p: Programa = { ...programa, nemotecnia: n, bloques: conv ? programa.bloques.map((b) => ({ ...b, segmentos: b.segmentos.map((s) => (s.lang === 'AWL' ? { ...s, awl: translateAwl(s.awl, n) } : s)) })) : programa.bloques };
    change(p);
    useSettings.getState().set({ nemotecnia: n });
  };

  return (
    <div className="wb">
      <Toolbar sim={sim} title={props.title} observe={observe} onObserve={setObserve}
        afterMres={props.hardware || senales ? (
          <>
            {props.hardware && (
              <button className={`btn small ${programa.hw?.estaciones.length ? 'active' : ''}`} onClick={() => setHwOpen(true)}
                title={programa.hw?.estaciones.length ? T.wb.hardwareTitulo(programa.hw.estaciones.map((e) => e.nombre).join(', '), clockByte) : T.wb.hardwareConfigurar}>
                <Icon name="cpu" size={13} />{T.wb.hardware}
              </button>
            )}
            {senales && (
              <div className="btn-group">
                <button className={`btn small ${senalesVisibles ? 'active' : ''}`} onClick={botonSenales} aria-pressed={senalesVisibles}
                  title={senalesFuera ? T.wb.senalesFueraTitulo : senalesVisibles ? T.wb.senalesOcultar : T.wb.senalesVer}>
                  <Icon name="wave" size={13} />{T.wb.senales}
                </button>
                <button className={`btn small icon ${senalesFuera ? 'active' : ''}`} onClick={sacarSenales} aria-label={senalesFuera ? T.wb.traerSenales : T.wb.abrirSenalesFuera}
                  title={senalesFuera ? T.wb.traerSenales : T.wb.abrirSenalesFueraTitulo}>
                  <Icon name="popout" size={13} />
                </button>
              </div>
            )}
          </>
        ) : undefined}
        extra={(
        <>
          <div className="btn-group" title={T.wb.nemotecnia}>
            <button className={`btn small ${nemo === 'de' ? 'active' : ''}`} onClick={() => setNemo('de')}>DE</button>
            <button className={`btn small ${nemo === 'en' ? 'active' : ''}`} onClick={() => setNemo('en')}>EN</button>
          </div>
          {props.extraToolbar}
        </>
      )} />
      <div className="wb-main">
        <div className="wb-center">
          <div className="block-tabs" role="tablist" aria-label={T.wb.bloques}>
            {blocks.map((b) => (
              <button key={b} role="tab" aria-selected={b === block} className={`block-tab ${b === block ? 'active' : ''}`} onClick={() => setBlock(b)}
                onContextMenu={(e) => { if (readOnly) return; e.preventDefault(); setBlockMenu({ x: e.clientX, y: e.clientY, name: b }); }}>
                {b}{blockErr(b) && <span className="err-dot" />}
              </button>
            ))}
            {!readOnly && <button className="btn small ghost icon" onClick={(e) => setBlockMenu({ x: e.clientX, y: e.clientY })} title={T.wb.anadirBloque} aria-label={T.wb.anadirBloque}><Icon name="plus" size={14} /></button>}
            <span className="spacer" />
            <span className="faint" style={{ fontSize: 11.5, paddingBottom: 4 }}>
              {block === 'OB1' ? T.wb.descOb1 : block === 'OB100' ? T.wb.descOb100 : T.wb.descFc}
            </span>
          </div>
          <LoadStatus sim={sim} onErrors={() => showBottom('msg')} onGoto={gotoSeg} pistaCiclo={pistaCiclo} onActivarCiclo={activarCiclo} />
          {stop && (
            <div className="stop-banner" role="alert">
              <Icon name="alert" />
              <span className="grow">{stop.reason}{stop.loc && <>{T.wb.stopEn(stop.loc.block)}{stop.loc.src ? `: ${stop.loc.src.replace(/\s+/g, ' ')}` : ''}</>}</span>
              {stop.loc?.origin?.seg && <button className="btn small" onClick={() => gotoSeg(stop.loc!.block, stop.loc!.origin!.seg)}>{T.wb.irALinea}</button>}
              <button className="btn small" onClick={() => sim.setRun(true)}>{T.wb.rearrancar}</button>
            </div>
          )}
          <div className="seg-list">
            {!blocks.length && (
              <div className="empty-proj">
                <Icon name="folder" size={28} />
                <h3>{T.wb.proyectoVacio}</h3>
                <p><Rico t={T.wb.proyectoVacioTexto} /></p>
                {!readOnly && <button className="btn primary" onClick={() => { change(ops.addBlock(programa, 'OB1')); setBlock('OB1'); }}><Icon name="plus" size={14} />{T.wb.crearOb1Boton}</button>}
              </div>
            )}
            {blk?.segmentos.map((s, i) => (
              <SegmentCard key={segId(s)} sim={sim} block={block} seg={s} index={i} total={blk.segmentos.length} observe={observe && sim.cpu.state === 'RUN'}
                readOnly={readOnly} lang={nemo} symbols={symbolNames} symByAddr={symByAddr} focused={focusSeg === segId(s)} onFocus={() => setFocusSeg(segId(s))}
                onChange={(ns) => change(ops.updateSegment(programa, block, segId(s), () => ns), ns.lang === 'KOP')} ops={segOps(s)} />
            ))}
            {!readOnly && blk && (
              <div className="add-seg">
                <button className="btn" onClick={() => { const n = ops.newSegment('AWL'); change(ops.insertSegment(programa, block, null, n)); setFocusSeg(segId(n)); }}><Icon name="plus" size={14} />{T.wb.segmentoAwl}</button>
                <button className="btn" onClick={() => { const n = ops.newSegment('KOP'); change(ops.insertSegment(programa, block, null, n)); setFocusSeg(segId(n)); }}><Icon name="ladder" size={14} />{T.wb.segmentoKop}</button>
              </div>
            )}
          </div>
        </div>
        <div className="splitter-x" onMouseDown={(e) => startRight(e, '-x')} role="separator" aria-orientation="vertical" />
        <aside className="wb-right" style={{ width: rightW }}>
          <Tabs<RightTab> value={right} onChange={setRight} tabs={[
            { id: 'io', label: T.wb.tabs.io },
            ...(vatEnVentana ? [] : [{ id: 'vat' as const, label: T.wb.tabs.vat }, { id: 'tz' as const, label: T.wb.tabs.tz }]),
            { id: 'cpu', label: T.wb.tabs.cpu }, { id: 'sym', label: T.wb.tabs.sym },
          ]} />
          <div className="wb-right-body">
            {right === 'io' && <IoPanel sim={sim} symByAddr={symByAddr} variant={props.ioVariant} clockByte={clockByte} lang={nemo} hidden={wbState.hidden} extra={wbState.extra}
              onIoState={(p) => onWbState({ ...wbState, ...p, inputs: [...sim.inputs.entries()] })}
              onInputsChanged={() => onWbState({ ...wbState, inputs: [...sim.inputs.entries()] })} />}
            {right === 'vat' && <VatPanel sim={sim} rows={wbState.vat as VatRow[]} onRows={(vat) => onWbState({ ...wbState, vat })} symbols={sim.compiled.symbols} symByAddr={symByAddr} />}
            {right === 'tz' && <TzPanel sim={sim} symByAddr={symByAddr} />}
            {right === 'cpu' && <CpuPanel sim={sim} />}
            {right === 'sym' && <SymbolsPanel simbolos={programa.simbolos} readOnly={readOnly} onChange={(s) => change({ ...programa, simbolos: s }, false)} errors={sim.compiled.errors.filter((e) => e.block === 'Símbolos').map((e) => e.full)} />}
          </div>
        </aside>
      </div>
      {bottomOpen && <div className="splitter-y" onMouseDown={(e) => startBottom(e, '-y')} role="separator" aria-orientation="horizontal" />}
      <div className={`wb-bottom ${bottomOpen ? '' : 'collapsed'}`} style={bottomOpen ? { height: bottomH } : undefined}>
        <Tabs<BottomTab> value={bottom} onChange={(t) => { if (t === 'an' && senales && !senalesFuera) senalesPorDefecto(); showBottom(t); }} tabs={[
          { id: 'an', label: senales ? <><Icon name="wave" size={13} />{T.wb.senales}{senalesFuera ? <span className="faint">{T.wb.enOtraVentana}</span> : null}</> : T.wb.analizador },
          ...vatsAbajo.map((a) => ({ id: `vat:${a.nombre}` as const, label: <><Icon name="table" size={13} />{a.nombre}</> })),
          { id: 'msg', label: <>{T.wb.mensajes} {sim.compiled.errors.length > 0 ? <span className="badge err">{sim.compiled.errors.length}</span> : warnings.length > 0 ? <span className="badge warn">{warnings.length}</span> : null}</> },
          { id: 'awl', label: T.wb.awlGenerado },
          { id: 'trace', label: T.wb.trazaCiclo },
        ]} right={senales ? (
          <button className="btn small ghost" onClick={() => setBottomOpen(!bottomOpen)} title={bottomOpen ? T.wb.ocultarAbajo : T.wb.mostrarAbajo}>
            <Icon name={bottomOpen ? 'down' : 'up'} size={13} />{bottomOpen ? T.wb.ocultar : T.wb.mostrar}
          </button>
        ) : undefined} />
        {bottomOpen && (
          <div className="wb-bottom-body">
            {bottom === 'an' && (senalesFuera ? (
              <div className="senales-aparte">
                <Icon name="popout" size={22} />
                <div>{T.wb.senalesAbiertasFuera}</div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn small" onClick={() => senalesFuera.focus()}>{T.wb.irAVentana}</button>
                  <button className="btn small" onClick={sacarSenales}>{T.wb.traerAqui}</button>
                </div>
              </div>
            ) : <AnalyzerPanel sim={sim} onSignalsChange={onSignals} />)}
            {bottom === 'msg' && <MessagesPanel sim={sim} warnings={warnings} onGoto={gotoSeg} />}
            {bottom === 'awl' && <GeneratedAwl sim={sim} programa={programa} block={block} />}
            {bottom === 'trace' && <TracePanel sim={sim} />}
            {vatsAbajo.map((a) => {
              const t = vats.find((v) => v.nombre === a.nombre);
              return t && bottom === `vat:${a.nombre}` && (
                <VatVista key={a.nombre} sim={sim} ses={tablas.sesion(a.nombre)} modo="abajo" lang={nemo} nombre={a.nombre} proyecto={props.proyecto ?? ''} filas={t.filas} onFilas={(f) => setFilas(a.nombre, f)}
                  symbols={sim.compiled.symbols} symByAddr={symByAddr} onCerrar={() => tablas.cerrar(a.nombre)} onFlotante={() => tablas.cambiarModo(a.nombre, 'flotante')} />
              );
            })}
          </div>
        )}
      </div>
      {senalesFuera && senales && <SenalesFuera sim={sim} win={senalesFuera} nombre={senales.nombre} onSignalsChange={onSignals} onTraer={sacarSenales} />}
      {tablas.abiertas.filter((a) => a.modo === 'flotante').map((a) => {
        const t = vats.find((v) => v.nombre === a.nombre);
        const ses = tablas.sesion(a.nombre);
        return t && (
          <VatFlotante key={a.nombre} nombre={a.nombre} ses={ses} z={30 + Math.max(0, tablas.orden.indexOf(a.nombre))}
            onFrente={() => tablas.frente(a.nombre)} onAcoplar={() => tablas.cambiarModo(a.nombre, 'abajo')} onCerrar={() => tablas.cerrar(a.nombre)}>
            <VatVista sim={sim} ses={ses} modo="flotante" lang={nemo} nombre={a.nombre} proyecto={props.proyecto ?? ''} filas={t.filas} onFilas={(f) => setFilas(a.nombre, f)}
              symbols={sim.compiled.symbols} symByAddr={symByAddr} onCerrar={() => tablas.cerrar(a.nombre)} />
          </VatFlotante>
        );
      })}
      {hwOpen && <HardwareDialog sim={sim} programa={programa} onChange={(p) => change(p)} onClose={() => setHwOpen(false)} />}
      {blockMenu && <ContextMenu x={blockMenu.x} y={blockMenu.y} items={blockItems(blockMenu.name)} onClose={() => setBlockMenu(null)} />}
    </div>
  );
}

/** Franja de estado siempre visible: ¿lo que ves está cargado y ejecutándose en la CPU? */
function LoadStatus({ sim, onErrors, onGoto, pistaCiclo = [], onActivarCiclo }: { sim: SimController; onErrors: () => void; onGoto: (b: string, seg?: string) => void; pistaCiclo?: { key: string; byte: number }[]; onActivarCiclo?: (byte: number) => void }) {
  useSimTick(sim, 8, () => [sim.rev, sim.cpu.state, sim.playing, sim.cpu.phase]);
  const cpu = sim.cpu;
  const errs = sim.compiled.errors;
  let cls = 'ok';
  let body: ReactNode;
  if (!sim.programa.bloques.some((b) => normBlockName(b.nombre) === 'OB1')) {
    cls = 'warn';
    body = <><Icon name="folder" size={13} /><span className="grow"><Rico t={T.wb.estado.faltaOb1} /></span></>;
  } else if (errs.length) {
    cls = 'err';
    const e0 = errs[0];
    body = (
      <>
        <Icon name="alert" size={14} />
        <span className="grow" title={errs.map((x) => x.full).join('\n')}><Rico t={T.wb.estado.errores(errs.length)} />{e0.full}</span>
        {e0.seg && <button className="btn small" onClick={() => onGoto(e0.block, e0.seg)}>{T.wb.estado.irAlError}</button>}
        {errs.length > 1 && <button className="btn small ghost" onClick={onErrors}>{T.wb.estado.verTodos}</button>}
      </>
    );
  } else if (pistaCiclo.length && onActivarCiclo) {
    cls = 'warn';
    const byte = pistaCiclo[0].byte;
    const nombres = pistaCiclo.slice(0, 3).map((m) => m.key.replace('M', 'M ')).join(', ');
    body = (
      <>
        <Icon name="clock" size={13} />
        <span className="grow" title={T.wb.estado.cicloTitulo}><Rico t={T.wb.estado.cicloTexto(nombres + (pistaCiclo.length > 3 ? '…' : ''))} /></span>
        <button className="btn small" onClick={() => onActivarCiclo(byte)}>{T.wb.estado.activarCiclo(byte)}</button>
      </>
    );
  } else if (cpu.state === 'STOP') {
    cls = 'warn';
    body = <><Icon name="stop" size={12} /><span className="grow"><Rico t={T.wb.estado.stop(!!sim.lastStop)} /></span></>;
  } else if (!sim.playing) {
    cls = 'warn';
    body = cpu.phase === 'CYCLE'
      ? <><Icon name="pause" size={12} /><span className="grow"><Rico t={T.wb.estado.pausaCiclo} /></span></>
      : <><Icon name="pause" size={12} /><span className="grow"><Rico t={T.wb.estado.pausa} /></span></>;
  } else {
    body = <><Icon name="check" size={14} /><span className="grow">{T.wb.estado.run}</span></>;
  }
  return <div className={`load-status ${cls}`} role="status">{body}</div>;
}
