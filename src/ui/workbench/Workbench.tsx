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
import type { SignalView } from '../../sim/analyzer';

type RightTab = 'io' | 'vat' | 'tz' | 'cpu' | 'sym';
/** `vat:VAT_1`: una pestaña por cada tabla de variables del proyecto */
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
  /** Tablas de variables del proyecto (`wbState.vats`) en el panel de abajo, en lugar de las pestañas «Variables» y «T / Z» */
  vatAbajo?: boolean;
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
  const vatAbajo = !!props.vatAbajo;
  const [rightSel, setRight] = useState<RightTab>(props.initialRight ?? 'io');
  const right: RightTab = vatAbajo && (rightSel === 'vat' || rightSel === 'tz') ? 'io' : rightSel;
  const [bottomSel, setBottom] = useState<BottomTab>(props.initialBottom ?? 'an');
  const vats = vatAbajo ? wbState.vats ?? [] : [];
  const vatSel = bottomSel.startsWith('vat:') ? vats.find((v) => `vat:${v.nombre}` === bottomSel) : undefined;
  // si se borra o se renombra la tabla abierta, vuelve a las señales
  const bottom: BottomTab = bottomSel.startsWith('vat:') && !vatSel ? 'an' : bottomSel;
  const setFilas = (nombre: string, filas: VatFila[]) => onWbState({ ...wbState, vats: vats.map((v) => (v.nombre === nombre ? { ...v, filas } : v)) });
  // con «Señales E/S» el panel de abajo empieza cerrado (solo las pestañas) y se recuerda
  const senales = props.senales;
  const openKey = `${props.layoutKey ?? 'wb'}-panel-abajo`;
  const [bottomOpen, setBottomOpenState] = useState(() => (senales ? leerBool(openKey, false) : true));
  const setBottomOpen = (v: boolean) => { setBottomOpenState(v); if (senales) guardarBool(openKey, v); };
  const showBottom = (t: BottomTab) => { setBottom(t); setBottomOpen(true); };
  const pedida = props.vatPedida;
  useEffect(() => {
    if (!pedida) return;
    showBottom(`vat:${pedida.nombre}`);
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
      remove: () => { if (confirm('¿Borrar este segmento?')) change(ops.deleteSegment(programa, block, id)); },
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
        if (s.awl.trim()) { toast('Este segmento no tiene representación en KOP (solo se convierten segmentos vacíos)'); return; }
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
      ...(blocks.includes('OB1') ? [] : [{ label: 'Crear OB1 (programa cíclico)', disabled: false, onClick: () => { change(ops.addBlock(programa, 'OB1')); setBlock('OB1'); } }]),
      { label: `Añadir ${ops.nextFc(programa)}`, onClick: () => { const n = ops.nextFc(programa); change(ops.addBlock(programa, n)); setBlock(n); } },
      { label: 'Añadir OB100 (arranque)', disabled: blocks.includes('OB100'), onClick: () => { change(ops.addBlock(programa, 'OB100')); setBlock('OB100'); } },
    ];
    if (name && name !== 'OB1') {
      items.push({ label: `Borrar ${name}`, disabled: false, onClick: () => { if (confirm(`¿Borrar el bloque ${name}?`)) change(ops.removeBlock(programa, name)); } });
      if (name.startsWith('FC')) items.push({ label: `Renombrar ${name}…`, disabled: false, onClick: async () => {
        const to = (await askText({ title: `Renombrar ${name}`, label: 'Nuevo nombre (FC n):', value: name, validate: (v) => {
          const t = v.toUpperCase().replace(/\s+/g, '');
          return !/^FC\d+$/.test(t) ? 'Escribe FC seguido de un número (FC2, FC10…)' : blocks.includes(t) && t !== name ? `Ya existe ${t}` : null;
        } }))?.toUpperCase().replace(/\s+/g, '');
        if (to && to !== name) { change(ops.renameBlock(programa, name, to)); setBlock(to); }
      } });
    }
    return items;
  };

  const setNemo = (n: 'de' | 'en') => {
    if (n === nemo) return;
    const conv = confirm(`¿Convertir también el código AWL a la nemotécnica ${n === 'en' ? 'inglesa (A, I, Q…)' : 'alemana (U, E, A…)'}?`);
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
                title={programa.hw?.estaciones.length ? `Hardware: ${programa.hw.estaciones.map((e) => e.nombre).join(', ')}${clockByte !== null ? ` · marca de ciclo MB${clockByte}` : ''}` : 'Configurar el hardware (CPU, marca de ciclo)'}>
                <Icon name="cpu" size={13} />Hardware
              </button>
            )}
            {senales && (
              <div className="btn-group">
                <button className={`btn small ${senalesVisibles ? 'active' : ''}`} onClick={botonSenales} aria-pressed={senalesVisibles}
                  title={senalesFuera ? 'Las señales están en otra ventana: clic para traerla delante' : senalesVisibles ? 'Ocultar las señales de entradas y salidas' : 'Ver las señales de entradas y salidas (cronograma de 0 y 1)'}>
                  <Icon name="wave" size={13} />Señales E/S
                </button>
                <button className={`btn small icon ${senalesFuera ? 'active' : ''}`} onClick={sacarSenales} aria-label={senalesFuera ? 'Traer las señales a esta ventana' : 'Abrir las señales en otra ventana'}
                  title={senalesFuera ? 'Traer las señales a esta ventana' : 'Abrir las señales en otra ventana (por ejemplo, en otro monitor)'}>
                  <Icon name="popout" size={13} />
                </button>
              </div>
            )}
          </>
        ) : undefined}
        extra={(
        <>
          <div className="btn-group" title="Nemotécnica">
            <button className={`btn small ${nemo === 'de' ? 'active' : ''}`} onClick={() => setNemo('de')}>DE</button>
            <button className={`btn small ${nemo === 'en' ? 'active' : ''}`} onClick={() => setNemo('en')}>EN</button>
          </div>
          {props.extraToolbar}
        </>
      )} />
      <div className="wb-main">
        <div className="wb-center">
          <div className="block-tabs" role="tablist" aria-label="Bloques">
            {blocks.map((b) => (
              <button key={b} role="tab" aria-selected={b === block} className={`block-tab ${b === block ? 'active' : ''}`} onClick={() => setBlock(b)}
                onContextMenu={(e) => { if (readOnly) return; e.preventDefault(); setBlockMenu({ x: e.clientX, y: e.clientY, name: b }); }}>
                {b}{blockErr(b) && <span className="err-dot" />}
              </button>
            ))}
            {!readOnly && <button className="btn small ghost icon" onClick={(e) => setBlockMenu({ x: e.clientX, y: e.clientY })} title="Añadir bloque" aria-label="Añadir bloque"><Icon name="plus" size={14} /></button>}
            <span className="spacer" />
            <span className="faint" style={{ fontSize: 11.5, paddingBottom: 4 }}>
              {block === 'OB1' ? 'Programa cíclico' : block === 'OB100' ? 'Arranque (solo el primer ciclo)' : 'Función: se ejecuta cuando se llama (UC/CC/CALL)'}
            </span>
          </div>
          <LoadStatus sim={sim} onErrors={() => showBottom('msg')} onGoto={gotoSeg} pistaCiclo={pistaCiclo} onActivarCiclo={activarCiclo} />
          {stop && (
            <div className="stop-banner" role="alert">
              <Icon name="alert" />
              <span className="grow">{stop.reason}{stop.loc && <> — en {stop.loc.block}{stop.loc.src ? `: ${stop.loc.src.replace(/\s+/g, ' ')}` : ''}</>}</span>
              {stop.loc?.origin?.seg && <button className="btn small" onClick={() => gotoSeg(stop.loc!.block, stop.loc!.origin!.seg)}>Ir a la línea</button>}
              <button className="btn small" onClick={() => sim.setRun(true)}>Rearrancar</button>
            </div>
          )}
          <div className="seg-list">
            {!blocks.length && (
              <div className="empty-proj">
                <Icon name="folder" size={28} />
                <h3>Proyecto vacío</h3>
                <p>Crea el <b>OB1</b>: es el bloque que la CPU ejecuta en cada ciclo. Después podrás añadir FC y OB100.</p>
                {!readOnly && <button className="btn primary" onClick={() => { change(ops.addBlock(programa, 'OB1')); setBlock('OB1'); }}><Icon name="plus" size={14} />Crear OB1</button>}
              </div>
            )}
            {blk?.segmentos.map((s, i) => (
              <SegmentCard key={segId(s)} sim={sim} block={block} seg={s} index={i} total={blk.segmentos.length} observe={observe && sim.cpu.state === 'RUN'}
                readOnly={readOnly} lang={nemo} symbols={symbolNames} symByAddr={symByAddr} focused={focusSeg === segId(s)} onFocus={() => setFocusSeg(segId(s))}
                onChange={(ns) => change(ops.updateSegment(programa, block, segId(s), () => ns), ns.lang === 'KOP')} ops={segOps(s)} />
            ))}
            {!readOnly && blk && (
              <div className="add-seg">
                <button className="btn" onClick={() => { const n = ops.newSegment('AWL'); change(ops.insertSegment(programa, block, null, n)); setFocusSeg(segId(n)); }}><Icon name="plus" size={14} />Segmento AWL</button>
                <button className="btn" onClick={() => { const n = ops.newSegment('KOP'); change(ops.insertSegment(programa, block, null, n)); setFocusSeg(segId(n)); }}><Icon name="ladder" size={14} />Segmento KOP</button>
              </div>
            )}
          </div>
        </div>
        <div className="splitter-x" onMouseDown={(e) => startRight(e, '-x')} role="separator" aria-orientation="vertical" />
        <aside className="wb-right" style={{ width: rightW }}>
          <Tabs<RightTab> value={right} onChange={setRight} tabs={[
            { id: 'io', label: 'E/S' },
            ...(vatAbajo ? [] : [{ id: 'vat' as const, label: 'Variables' }, { id: 'tz' as const, label: 'T / Z' }]),
            { id: 'cpu', label: 'CPU' }, { id: 'sym', label: 'Símbolos' },
          ]} />
          <div className="wb-right-body">
            {right === 'io' && <IoPanel sim={sim} symByAddr={symByAddr} variant={props.ioVariant} clockByte={clockByte} hidden={wbState.hidden} extra={wbState.extra}
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
          { id: 'an', label: senales ? <><Icon name="wave" size={13} />Señales E/S{senalesFuera ? <span className="faint"> (en otra ventana)</span> : null}</> : 'Analizador lógico' },
          ...vats.map((v) => ({ id: `vat:${v.nombre}` as const, label: <><Icon name="table" size={13} />{v.nombre}</> })),
          { id: 'msg', label: <>Mensajes {sim.compiled.errors.length > 0 ? <span className="badge err">{sim.compiled.errors.length}</span> : warnings.length > 0 ? <span className="badge warn">{warnings.length}</span> : null}</> },
          { id: 'awl', label: 'AWL generado' },
          { id: 'trace', label: 'Traza del ciclo' },
        ]} right={senales ? (
          <button className="btn small ghost" onClick={() => setBottomOpen(!bottomOpen)} title={bottomOpen ? 'Ocultar el panel de abajo' : 'Mostrar el panel de abajo'}>
            <Icon name={bottomOpen ? 'down' : 'up'} size={13} />{bottomOpen ? 'Ocultar' : 'Mostrar'}
          </button>
        ) : undefined} />
        {bottomOpen && (
          <div className="wb-bottom-body">
            {bottom === 'an' && (senalesFuera ? (
              <div className="senales-aparte">
                <Icon name="popout" size={22} />
                <div>Las señales E/S están abiertas en otra ventana.</div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn small" onClick={() => senalesFuera.focus()}>Ir a la ventana</button>
                  <button className="btn small" onClick={sacarSenales}>Traer aquí</button>
                </div>
              </div>
            ) : <AnalyzerPanel sim={sim} onSignalsChange={onSignals} />)}
            {bottom === 'msg' && <MessagesPanel sim={sim} warnings={warnings} onGoto={gotoSeg} />}
            {bottom === 'awl' && <GeneratedAwl sim={sim} programa={programa} block={block} />}
            {bottom === 'trace' && <TracePanel sim={sim} />}
            {vatSel && bottom === `vat:${vatSel.nombre}` && (
              <div className="vat-abajo">
                <VatPanel key={vatSel.nombre} sim={sim} rows={vatSel.filas} onRows={(f) => setFilas(vatSel.nombre, f)} symbols={sim.compiled.symbols} symByAddr={symByAddr} valorTZ />
              </div>
            )}
          </div>
        )}
      </div>
      {senalesFuera && senales && <SenalesFuera sim={sim} win={senalesFuera} nombre={senales.nombre} onSignalsChange={onSignals} onTraer={sacarSenales} />}
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
    body = <><Icon name="folder" size={13} /><span className="grow"><b>Falta el OB1</b>: crea el OB1 (programa cíclico) para que la CPU ejecute algo.</span></>;
  } else if (errs.length) {
    cls = 'err';
    const e0 = errs[0];
    body = (
      <>
        <Icon name="alert" size={14} />
        <span className="grow" title={errs.map((x) => x.full).join('\n')}><b>{errs.length} error{errs.length > 1 ? 'es' : ''}: lo que ves NO está cargado en la CPU</b> (sigue ejecutando la versión anterior). {e0.full}</span>
        {e0.seg && <button className="btn small" onClick={() => onGoto(e0.block, e0.seg)}>Ir al error</button>}
        {errs.length > 1 && <button className="btn small ghost" onClick={onErrors}>Ver todos</button>}
      </>
    );
  } else if (pistaCiclo.length && onActivarCiclo) {
    cls = 'warn';
    const byte = pistaCiclo[0].byte;
    const nombres = pistaCiclo.slice(0, 3).map((m) => m.key.replace('M', 'M ')).join(', ');
    body = (
      <>
        <Icon name="clock" size={13} />
        <span className="grow" title="Una marca que nadie escribe vale siempre 0. Las marcas de ciclo las escribe la CPU solo si se activan en la configuración del hardware."><b>{nombres}{pistaCiclo.length > 3 ? '…' : ''} siempre vale 0</b>: tu programa la consulta pero no la escribe nunca. ¿Es una marca de ciclo? Actívala en Hardware.</span>
        <button className="btn small" onClick={() => onActivarCiclo(byte)}>Activar marca de ciclo en MB{byte}</button>
      </>
    );
  } else if (cpu.state === 'STOP') {
    cls = 'warn';
    body = <><Icon name="stop" size={12} /><span className="grow"><b>CPU en STOP</b>{sim.lastStop ? ' por un error de ejecución' : ''}: el programa no se ejecuta. Pulsa <b>RUN</b>.</span></>;
  } else if (!sim.playing) {
    cls = 'warn';
    body = cpu.phase === 'CYCLE'
      ? <><Icon name="pause" size={12} /><span className="grow"><b>En pausa a mitad de ciclo</b> (paso a paso): «Instr.» ejecuta la siguiente instrucción, «Ciclo» termina el ciclo y ▶ sigue en tiempo real.</span></>
      : <><Icon name="pause" size={12} /><span className="grow"><b>Simulación en pausa</b>: no se ejecutan ciclos, así que las entradas que cambies no llegan al programa. Pulsa ▶.</span></>;
  } else {
    body = <><Icon name="check" size={14} /><span className="grow">Programa cargado en la CPU y ejecutándose (RUN).</span></>;
  }
  return <div className={`load-status ${cls}`} role="status">{body}</div>;
}
