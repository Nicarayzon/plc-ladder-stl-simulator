import { memo, useMemo, useRef, useState } from 'react';
import type { SimController } from '../../sim/SimController';
import { originKeyLine, originKeySeg } from '../../sim/SimController';
import { segId, type Segmento } from '../../core/program';
import { AwlEditor, type ObsLine, type EditorDiag, type OperandValue } from './AwlEditor';
import { KopEditor } from '../../kop/editor/KopEditor';
import { Icon } from '../common/Icon';
import { ContextMenu, type MenuItem } from '../common/ui';
import { useSimTick } from './useSim';
import { useSettings } from '../../store/settings';
import { cleanLine, splitLines, splitMnemonic, stripComment } from '../../core/compiler';
import { JUMPS } from '../../core/mnemonics';
import { operandEnToDe } from '../../core/translate';
import { makeReader, readRaw, type Reader } from '../../sim/readers';
import { s16, s32 } from '../../core/num';
import type { Symbols } from '../../core/operands';
import { T } from '../../i18n';

export interface SegOps {
  move: (dir: -1 | 1) => void;
  duplicate: () => void;
  remove: () => void;
  insertAfter: (lang: 'AWL' | 'KOP') => void;
  toAwl?: () => void;
  toKop?: () => void;
}

interface Props {
  sim: SimController;
  block: string;
  seg: Segmento;
  index: number;
  total: number;
  observe: boolean;
  readOnly?: boolean;
  lang: 'de' | 'en';
  symbols: string[];
  symByAddr: Map<string, string>;
  onChange: (s: Segmento) => void;
  ops: SegOps;
  focused: boolean;
  onFocus: () => void;
}

const hex = (v: number) => (v >>> 0).toString(16).toUpperCase().padStart(8, '0');

function obsCells(st: number, a1: number, a2: number, hexMode: boolean, extra: boolean): string[] {
  const rlo = (st >> 1) & 1;
  const sta = (st >> 2) & 1;
  const fa = (v: number) => (hexMode ? hex(v) : String(v | 0));
  const cells = [String(rlo), String(sta), fa(a1), fa(a2)];
  if (extra) cells.push(String((st >> 9) & 1), String((st >> 3) & 1), `${(st >> 7) & 1}${(st >> 6) & 1}`, String((st >> 5) & 1), String((st >> 4) & 1));
  return cells;
}

/** Instrucción (pc) que se observa en cada línea del segmento */
function useLinePcs(sim: SimController, block: string, id: string, text: string) {
  return useMemo(() => {
    const out: { line: number; pc: number }[] = [];
    const n = splitLines(text).length;
    for (let line = 1; line <= n; line++) {
      const locs = sim.index.map.get(originKeyLine(block, id, line));
      if (locs) out.push({ line, pc: locs[locs.length - 1].pc });
    }
    return out;
  }, [sim.index, block, id, text]);
}

function calcObs(sim: SimController, block: string, pcs: { line: number; pc: number }[], hexMode: boolean, extra: boolean): ObsLine[] {
  const cpu = sim.cpu;
  const obs: ObsLine[] = [];
  const ob = cpu.obs.get(block);
  if (!ob) return obs;
  for (const { line, pc } of pcs) {
    if (pc >= ob.stamp.length || ob.stamp[pc] === 0) continue;
    obs.push({ line, cells: obsCells(ob.st[pc], ob.acc1[pc], ob.acc2[pc], hexMode, extra), dim: ob.stamp[pc] !== cpu.stamp, count: ob.stamp[pc] === cpu.stamp ? ob.count[pc] : 0 });
  }
  return obs;
}

/** Firma barata de lo que enseña «Observar» en el segmento: si no cambia, no se toca el editor. */
function obsFirma(sim: SimController, block: string, pcs: { line: number; pc: number }[], operands: { reader: Reader }[]): string {
  const cpu = sim.cpu;
  const ob = cpu.obs.get(block);
  let k = '';
  if (ob) {
    for (const { pc } of pcs) {
      if (pc >= ob.stamp.length || ob.stamp[pc] === 0) { k += '-'; continue; }
      const cur = ob.stamp[pc] === cpu.stamp;
      k += `${ob.st[pc]},${ob.acc1[pc]},${ob.acc2[pc]},${cur ? ob.count[pc] : 'd'};`;
    }
  }
  k += '|';
  for (const { reader } of operands) k += `${readRaw(cpu, reader)},`;
  return k;
}

const LABEL_RE = /^([A-Za-z_][A-Za-z0-9_]{0,3})\s*:(?!=)\s*(.*)$/;

/** Operandos de cada línea que se pueden observar (bits, palabras, T, Z) y dónde poner su valor. */
function parseOperands(text: string, symbols: Symbols, lang: 'de' | 'en'): { line: number; pos: number; reader: Reader }[] {
  const out: { line: number; pos: number; reader: Reader }[] = [];
  splitLines(text).forEach((raw, i) => {
    let line = cleanLine(raw);
    if (!line) return;
    const m = LABEL_RE.exec(line);
    if (m) line = m[2].trim();
    if (!line) return;
    let mn: string;
    let rest: string;
    try { [mn, rest] = splitMnemonic(line); } catch { return; }
    if (!rest || JUMPS.has(mn)) return;
    let op = lang === 'en' ? operandEnToDe(rest) : rest;
    if ((mn === 'L' || mn === 'LC') && /^\s*[TZC]\s*\d+\s*$/i.test(op)) op = `${op}:VALOR`;
    try {
      const reader = makeReader(op, symbols);
      if (reader.op.area === 'L') return;
      out.push({ line: i + 1, pos: stripComment(raw).replace(/[\s;]+$/, '').length, reader });
    } catch { /* constante, meta u operando no observable */ }
  });
  return out;
}

function calcValues(sim: SimController, operands: { line: number; pos: number; reader: Reader }[]): OperandValue[] {
  return operands.map(({ line, pos, reader }) => {
    const raw = readRaw(sim.cpu, reader);
    if (Number.isNaN(raw)) return { line, pos, text: '—', cls: 'num' as const };
    if (reader.size === 0) return { line, pos, text: String(raw), cls: raw ? 'on' as const : 'off' as const };
    const v = reader.kind === 'mem' ? (reader.size === 2 ? s16(raw) : reader.size === 4 ? s32(raw) : raw) : raw;
    return { line, pos, text: String(v), cls: 'num' as const };
  });
}

function AwlBody({ sim, block, seg, observe, readOnly, lang, symbols, onChange, onFocus }: Props & { seg: Extract<Segmento, { lang: 'AWL' }> }) {
  const id = seg.id;
  const observeHex = useSettings((s) => s.observeHex);
  const observeExtra = useSettings((s) => s.observeExtra);
  const symbolsMap = sim.compiled.symbols;
  const operands = useMemo(() => parseOperands(seg.awl, symbolsMap, lang), [seg.awl, symbolsMap, lang]);
  const pcs = useLinePcs(sim, block, id, seg.awl);
  const firma = () => (observe ? obsFirma(sim, block, pcs, operands) : null);
  useSimTick(sim, observe ? 10 : 2, () => [sim.rev, firma()]);
  // los datos de «Observar» solo se rehacen (y el editor solo se actualiza) si cambia la firma
  const vista = useRef<{ key: unknown[]; obs: ObsLine[] | null; values: OperandValue[] | null } | null>(null);
  const key = [firma(), observeHex, observeExtra, pcs, operands];
  if (!vista.current || key.some((v, i) => !Object.is(v, vista.current!.key[i]))) {
    vista.current = observe
      ? { key, obs: calcObs(sim, block, pcs, observeHex, observeExtra), values: calcValues(sim, operands) }
      : { key, obs: null, values: null };
  }
  const { obs, values } = vista.current;
  const diags: EditorDiag[] = useMemo(() => sim.compiled.errors.filter((e) => e.seg === id && e.line > 0).map((e) => ({ line: e.line, msg: e.msg, severity: 'error' as const })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sim.compiled, id]);
  const bps = useMemo(() => {
    const set = new Set<number>();
    const pre = `${block}|${id}|L`;
    for (const k of sim.bpKeys) if (k.startsWith(pre)) set.add(parseInt(k.slice(pre.length), 10));
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.bpKeys.size, sim.version, block, id]);
  const curKeys = sim.currentOriginKeys();
  const pre = `${block}|${id}|L`;
  const cur = curKeys.find((k) => k.startsWith(pre));
  const stopLoc = sim.lastStop?.loc;
  const stopLine = stopLoc && stopLoc.block === block && stopLoc.origin?.seg === id ? stopLoc.origin.line ?? null : null;
  const w = observeExtra ? 240 + 34 * 5 + 12 : 250;
  return (
    <>
      {observe && (
        <div className="obs-head" style={{ paddingRight: 12 }}>
          <span title={T.seg.rloTitulo}>{T.reg.rlo}</span><span title={T.seg.staTitulo}>{T.reg.sta}</span><span className="w" title={T.seg.acu1Titulo}>{T.reg.acu1}</span><span className="w" title={T.seg.acu2Titulo}>{T.reg.acu2}</span>
          {observeExtra && <><span>{T.reg.er}</span><span>{T.reg.or}</span><span>{T.reg.a1a0}</span><span>{T.reg.ov}</span><span>{T.reg.os}</span></>}
        </div>
      )}
      <AwlEditor value={seg.awl} readOnly={readOnly} lang={lang} symbols={symbols} diagnostics={diags} observe={obs} observeWidth={w} values={values}
        breakpoints={bps} onToggleBreakpoint={(line) => sim.toggleBreakpoint(originKeyLine(block, id, line))}
        currentLine={cur ? parseInt(cur.slice(pre.length), 10) : null} stopLine={stopLine}
        onChange={(v) => onChange({ ...seg, awl: v })} onFocus={onFocus} />
    </>
  );
}

export const SegmentCard = memo(function SegmentCard(props: Props) {
  const { sim, block, seg, index, total, readOnly, onChange, ops, focused, onFocus } = props;
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [showComment, setShowComment] = useState(false);
  const id = segId(seg);
  const titulo = seg.lang === 'KOP' ? seg.kop.titulo : seg.titulo;
  const comentario = seg.lang === 'KOP' ? seg.kop.comentario : seg.comentario;
  const errs = sim.compiled.errors.filter((e) => e.seg === id);
  const segBp = sim.bpKeys.has(originKeySeg(block, id));
  const setTitle = (t: string) => onChange(seg.lang === 'KOP' ? { ...seg, kop: { ...seg.kop, titulo: t } } : { ...seg, titulo: t });
  const setComment = (t: string) => onChange(seg.lang === 'KOP' ? { ...seg, kop: { ...seg.kop, comentario: t } } : { ...seg, comentario: t });
  const items: MenuItem[] = [
    { label: T.seg.insertarAwl, onClick: () => ops.insertAfter('AWL') },
    { label: T.seg.insertarKop, onClick: () => ops.insertAfter('KOP') },
    { sep: true, label: '' },
    { label: T.seg.subir, onClick: () => ops.move(-1), disabled: index === 0 },
    { label: T.seg.bajar, onClick: () => ops.move(1), disabled: index === total - 1 },
    { label: T.seg.duplicar, onClick: ops.duplicate },
    { label: showComment || comentario ? T.seg.ocultarComentario : T.seg.anadirComentario, onClick: () => setShowComment(!showComment) },
    { sep: true, label: '' },
    ...(seg.lang === 'KOP' && ops.toAwl ? [{ label: T.seg.aAwl, onClick: ops.toAwl }] : []),
    ...(seg.lang === 'AWL' && ops.toKop ? [{ label: T.seg.aKop, onClick: ops.toKop }] : []),
    { label: T.seg.borrar, onClick: ops.remove, disabled: total <= 1 },
  ];
  return (
    <section className={`seg ${errs.length ? 'has-error' : ''} ${focused ? 'focused' : ''}`} id={`seg-${id}`} onMouseDown={onFocus} aria-label={T.seg.segmento(index + 1)}>
      <div className="seg-head">
        <span className="num">{T.seg.segmento(index + 1)}</span>
        <span className={`lang-badge ${seg.lang === 'KOP' ? 'kop' : 'awl'}`}>{T.lenguaje[seg.lang]}</span>
        <input className="title-input" placeholder={T.seg.titulo} value={titulo ?? ''} readOnly={readOnly} onChange={(e) => setTitle(e.target.value)} aria-label={T.seg.titulo} />
        <button className={`btn small ghost ${segBp ? 'active' : ''}`} title={T.seg.puntoParada} onClick={() => sim.toggleBreakpoint(originKeySeg(block, id))}>
          <span className="cm-bp" style={{ visibility: segBp ? 'visible' : 'visible', opacity: segBp ? 1 : 0.25 }} />
        </button>
        {!readOnly && <button className="btn small ghost icon" onClick={(e) => setMenu({ x: e.clientX, y: e.clientY })} aria-label={T.seg.opciones}><Icon name="dots" /></button>}
      </div>
      {(showComment || comentario) && (
        <textarea className="seg-comment" rows={1} placeholder={T.seg.comentario} value={comentario ?? ''} readOnly={readOnly} onChange={(e) => setComment(e.target.value)} aria-label={T.seg.comentario} />
      )}
      <div className="seg-body">
        {seg.lang === 'AWL'
          ? <AwlBody {...props} seg={seg} />
          : <KopEditor seg={seg.kop} onChange={(k) => onChange({ ...seg, kop: k })} sim={sim} block={block} observe={props.observe} readOnly={readOnly} lang={props.lang} symByAddr={props.symByAddr} symbols={props.symbols} onFocus={onFocus} />}
      </div>
      {errs.length > 0 && (
        <div className="seg-errors">
          {errs.slice(0, 8).map((e, i) => <div key={i}><Icon name="alert" size={13} />{e.line > 0 && seg.lang === 'AWL' ? T.seg.linea(e.line) : ''}{e.msg}</div>)}
        </div>
      )}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={items} onClose={() => setMenu(null)} />}
    </section>
  );
});
