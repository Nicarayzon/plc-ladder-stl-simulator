// Dibujo SVG de un segmento KOP (a partir de la maquetación) con estados de corriente
import { Fragment, type ReactNode } from 'react';
import type { Elem, Salida } from '../model';
import { CONT_EN, TEMP_EN } from '../model';
import type { LBox, LItem, Layout, PowerRef } from '../layout';
import type { Flow, Pw } from '../flow';
import type { KopIssue } from '../validate';
import { T } from '../../i18n';

export const CW = 84;
export const RH = 64;
export const X0 = 14;
export const WY = 40;
export const PADT = 6;

export const px = (x: number) => X0 + x * CW;
export const py = (y: number) => PADT + y * RH + WY;

export interface OperandHit { id: string; field: string; x: number; y: number; w: number; anchor: 'middle' | 'start' | 'end'; value: string }

export interface RenderOpts {
  layout: Layout;
  flow: Flow | null;
  selected: string | null;
  issues: Map<string, KopIssue[]>;
  /** Texto a mostrar de un operando (dirección o símbolo según preferencia) */
  showOp: (op: string) => { main: string; sub?: string };
  /** Valor en vivo de un operando (palabras) cuando se observa */
  live?: (op: string) => string | null;
  lang: 'de' | 'en';
  onSelect: (id: string, e: React.MouseEvent) => void;
  onEdit: (hit: OperandHit) => void;
  onPin: (boxId: string, field: string) => void;
  onContext: (id: string, e: React.MouseEvent) => void;
  /** Escalar para caber en el contenedor (vistas de solo lectura) */
  fit?: boolean;
}

function pwClass(flow: Flow | null, ref: PowerRef | undefined): string {
  if (!flow || ref === undefined) return 'w';
  const v: Pw | undefined = ref === 'rail' ? flow.get('rail') : flow.get(`${ref.id}:${ref.side}`);
  return v === 1 ? 'w on' : v === 0 ? 'w off' : v === -1 ? 'w skip' : 'w';
}

const empty = (s: string | undefined) => !s || !s.trim();

function OpText({ o, id, field, x, y, value, anchor = 'middle', required = true, noSub = false, noLive = false }: { o: RenderOpts; id: string; field: string; x: number; y: number; value: string | undefined; anchor?: 'middle' | 'start' | 'end'; required?: boolean; noSub?: boolean; noLive?: boolean }) {
  const isEmpty = empty(value);
  const shown = isEmpty ? (required ? '??.?' : '…') : o.showOp(value!);
  const err = o.issues.get(id)?.some((i) => i.field === field);
  const live = !isEmpty && o.live && !noLive ? o.live(value!) : null;
  const main = typeof shown === 'string' ? shown : shown.main;
  const sub = typeof shown === 'string' || noSub ? undefined : shown.sub;
  return (
    <g className="op-hit" onMouseDown={(e) => { e.stopPropagation(); o.onSelect(id, e); }}
      onDoubleClick={(e) => { e.stopPropagation(); o.onEdit({ id, field, x, y, w: 96, anchor, value: value ?? '' }); }}>
      <rect x={anchor === 'middle' ? x - 44 : anchor === 'start' ? x - 2 : x - 88} y={y - 12} width={90} height={16} fill="transparent" />
      <text x={x} y={y} textAnchor={anchor} className={`op ${isEmpty ? (required ? 'missing' : 'optional') : ''} ${err ? 'bad' : ''}`}>{main}</text>
      {sub && <text x={x} y={y + 11} textAnchor={anchor} className="sym">{sub}</text>}
      {live && <text x={x} y={y + (sub ? 22 : 11)} textAnchor={anchor} className="live">{live}</text>}
    </g>
  );
}

export function KopSvg(o: RenderOpts) {
  const { layout: L, flow, selected } = o;
  const W = px(L.width) + 40;
  const H = PADT + L.height * RH + 6;
  const out: ReactNode[] = [];

  // cables
  L.wires.forEach((w, i) => {
    out.push(<line key={`w${i}`} x1={px(w.x1)} y1={py(w.y1)} x2={px(w.x2)} y2={py(w.y2)} className={pwClass(flow, w.pw)} />);
  });
  L.dots.forEach((d, i) => out.push(<circle key={`d${i}`} cx={px(d.x)} cy={py(d.y)} r={3} className={`dot ${pwClass(flow, d.pw)}`} />));

  // elementos simples
  for (const it of L.items) out.push(<Fragment key={it.id}>{renderItem(it)}</Fragment>);
  for (const b of L.boxes) out.push(<Fragment key={b.id}>{renderBox(b)}</Fragment>);

  function sel(it: { id: string; x: number; y: number; w: number; h: number }, extraTop = 0) {
    const isSel = selected === it.id;
    const err = o.issues.has(it.id) && o.issues.get(it.id)!.some((x) => x.severity === 'error');
    return (
      <rect x={px(it.x) + 2} y={py(it.y) - WY + 2 - extraTop} width={it.w * CW - 4} height={it.h * RH - 4 + extraTop} rx={6}
        className={`hit ${isSel ? 'sel' : ''} ${err ? 'err' : ''}`} />
    );
  }

  function renderItem(it: LItem) {
    const n = it.node as Elem | Salida;
    const x0 = px(it.x);
    const x1 = px(it.x + it.w);
    const cx = (x0 + x1) / 2;
    const wy = py(it.y);
    const inC = pwClass(flow, it.inRef);
    const outC = pwClass(flow, { id: it.id, side: 'out' });
    const common = {
      onMouseDown: (e: React.MouseEvent) => { e.stopPropagation(); o.onSelect(it.id, e); },
      onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); o.onContext(it.id, e); },
      className: 'el',
    };
    const leads = (half = 8) => (
      <>
        <line x1={x0} y1={wy} x2={cx - half} y2={wy} className={inC} />
        <line x1={cx + half} y1={wy} x2={x1} y2={wy} className={outC} />
      </>
    );
    const cond = flow ? flow.get(`${it.id}:cond`) : undefined;
    const condCls = cond === 1 ? 'c-on' : cond === 0 ? 'c-off' : '';
    switch (n.k) {
      case 'NA':
      case 'NC':
        return (
          <g {...common} onDoubleClick={(e) => { e.stopPropagation(); o.onEdit({ id: it.id, field: 'op', x: cx, y: wy - 27, w: 96, anchor: 'middle', value: n.op }); }}>
            {sel(it)}
            {leads(7)}
            <line x1={cx - 7} y1={wy - 11} x2={cx - 7} y2={wy + 11} className={`sym-line ${condCls}`} />
            <line x1={cx + 7} y1={wy - 11} x2={cx + 7} y2={wy + 11} className={`sym-line ${condCls}`} />
            {n.k === 'NC' && <line x1={cx - 9} y1={wy + 9} x2={cx + 9} y2={wy - 9} className={`sym-line ${condCls}`} />}
            <OpText o={o} id={it.id} field="op" x={cx} y={wy - 27} value={n.op} />
          </g>
        );
      case 'NOT':
        return (
          <g {...common}>
            {sel(it)}
            {leads(15)}
            <rect x={cx - 15} y={wy - 9} width={30} height={18} rx={3} className="sym-box" />
            <text x={cx} y={wy + 4} textAnchor="middle" className="boxtxt">NOT</text>
          </g>
        );
      case 'P':
      case 'N':
      case 'CON':
        return (
          <g {...common} onDoubleClick={(e) => { e.stopPropagation(); o.onEdit({ id: it.id, field: n.k === 'CON' ? 'op' : 'mem', x: cx, y: wy - 27, w: 96, anchor: 'middle', value: n.k === 'CON' ? n.op : n.mem }); }}>
            {sel(it)}
            {leads(11)}
            <path d={`M ${cx - 6} ${wy - 11} Q ${cx - 13} ${wy} ${cx - 6} ${wy + 11}`} className="sym-line" fill="none" />
            <path d={`M ${cx + 6} ${wy - 11} Q ${cx + 13} ${wy} ${cx + 6} ${wy + 11}`} className="sym-line" fill="none" />
            <text x={cx} y={wy + 4} textAnchor="middle" className="boxtxt">{n.k === 'CON' ? '#' : n.k}</text>
            <OpText o={o} id={it.id} field={n.k === 'CON' ? 'op' : 'mem'} x={cx} y={wy - 27} value={n.k === 'CON' ? n.op : n.mem} />
          </g>
        );
      case 'POS':
      case 'NEG':
        return (
          <g {...common}>
            {sel(it)}
            {leads(18)}
            <rect x={cx - 18} y={wy - 10} width={36} height={20} rx={3} className="sym-box" />
            <text x={cx} y={wy + 4} textAnchor="middle" className="boxtxt">{n.k}</text>
            <OpText o={o} id={it.id} field="op" x={cx} y={wy - 27} value={n.op} />
            <OpText o={o} id={it.id} field="mem" x={cx} y={wy + 24} value={n.mem} noSub />
          </g>
        );
      case 'CMP': {
        const top = wy - 14;
        const bot = py(it.y + 1) + 16;
        return (
          <g {...common}>
            {sel(it)}
            <line x1={x0} y1={wy} x2={x0 + 10} y2={wy} className={inC} />
            <line x1={x1 - 10} y1={wy} x2={x1} y2={wy} className={outC} />
            <rect x={x0 + 10} y={top} width={x1 - x0 - 20} height={bot - top} rx={3} className={`sym-box ${condCls}`} />
            <text x={cx} y={top + 13} textAnchor="middle" className="boxtxt">CMP {n.fn}</text>
            <text x={x0 + 16} y={wy + 20} className="pin">IN1</text>
            <text x={x0 + 16} y={py(it.y + 1) + 6} className="pin">IN2</text>
            <OpText o={o} id={it.id} field="in1" x={x0 + 44} y={wy + 20} value={n.in1} anchor="start" />
            <OpText o={o} id={it.id} field="in2" x={x0 + 44} y={py(it.y + 1) + 6} value={n.in2} anchor="start" />
          </g>
        );
      }
    }
    // salidas tipo bobina
    const s = n as Salida;
    const label: Record<string, string> = { BOB: '', S: 'S', R: 'R', SAVE: 'SAVE', SI: 'SI', SV: 'SV', SE: 'SE', SS: 'SS', SA: 'SA', ZV: 'ZV', ZR: 'ZR', SZ: 'SZ', JMP: 'JMP', JMPN: 'JMPN', RET: 'RET', CALL: 'CALL' };
    const enLabel: Record<string, string> = { SI: 'SP', SV: 'SE', SE: 'SD', SA: 'SF', ZV: 'CU', ZR: 'CD', SZ: 'SC' };
    const t = o.lang === 'en' ? enLabel[s.k] ?? label[s.k] : label[s.k];
    const wide = t.length > 2 ? 4 * (t.length - 2) : 0;
    const inPw = pwClass(flow, it.inRef);
    const coilCls = flow ? (inPw.includes('on') ? 'c-on' : inPw.includes('off') ? 'c-off' : '') : '';
    let opField: string | null = null;
    let opVal: string | undefined;
    let subField: string | null = null;
    let subVal: string | undefined;
    if (s.k === 'BOB' || s.k === 'S' || s.k === 'R') { opField = 'op'; opVal = s.op; }
    if (s.k === 'SI' || s.k === 'SV' || s.k === 'SE' || s.k === 'SS' || s.k === 'SA') { opField = 't'; opVal = s.t; subField = 'tw'; subVal = s.tw; }
    if (s.k === 'ZV' || s.k === 'ZR') { opField = 'z'; opVal = s.z; }
    if (s.k === 'SZ') { opField = 'z'; opVal = s.z; subField = 'zw'; subVal = s.zw; }
    if (s.k === 'JMP' || s.k === 'JMPN') { opField = 'meta'; opVal = s.meta; }
    if (s.k === 'CALL') { opField = 'bloque'; opVal = s.bloque; }
    return (
      <g {...common} onDoubleClick={(e) => { e.stopPropagation(); if (opField) o.onEdit({ id: it.id, field: opField, x: cx, y: wy - 27, w: 96, anchor: 'middle', value: opVal ?? '' }); }}>
        {sel(it)}
        <line x1={x0} y1={wy} x2={cx - 12 - wide} y2={wy} className={inPw} />
        <path d={`M ${cx - 7 - wide} ${wy - 11} Q ${cx - 14 - wide} ${wy} ${cx - 7 - wide} ${wy + 11}`} className={`sym-line ${coilCls}`} fill="none" />
        <path d={`M ${cx + 7 + wide} ${wy - 11} Q ${cx + 14 + wide} ${wy} ${cx + 7 + wide} ${wy + 11}`} className={`sym-line ${coilCls}`} fill="none" />
        {t && <text x={cx} y={wy + 4} textAnchor="middle" className="boxtxt">{t}</text>}
        {opField && <OpText o={o} id={it.id} field={opField} x={cx} y={wy - 27} value={opVal} />}
        {subField && <OpText o={o} id={it.id} field={subField} x={cx} y={wy + 25} value={subVal} noSub />}
      </g>
    );
  }

  function renderBox(b: LBox) {
    const s = b.node as Salida;
    const x0 = px(b.x);
    const x1 = px(b.x + b.w);
    const cx = (x0 + x1) / 2;
    const wy = py(b.y);
    const top = wy - 30;
    const bot = py(b.y + b.h - 1) + 16;
    let title = '';
    let opField = '';
    let opVal: string | undefined;
    if (s.k === 'TEMP') { title = o.lang === 'en' ? TEMP_EN[s.tipo] : s.tipo; opField = 't'; opVal = s.t; }
    if (s.k === 'CONT') { title = o.lang === 'en' ? CONT_EN[s.tipo] : s.tipo; opField = 'z'; opVal = s.z; }
    if (s.k === 'BIEST') { title = s.tipo; opField = 'op'; opVal = s.op; }
    if (s.k === 'BOX') title = s.fn;
    const qCls = pwClass(flow, { id: b.id, side: 'q' });
    const qOn = qCls.includes('on');
    return (
      <g className="el" onMouseDown={(e) => { e.stopPropagation(); o.onSelect(b.id, e); }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); o.onContext(b.id, e); }}
        onDoubleClick={(e) => { e.stopPropagation(); if (opField) o.onEdit({ id: b.id, field: opField, x: cx, y: top - 6, w: 96, anchor: 'middle', value: opVal ?? '' }); }}>
        <rect x={x0 - 2} y={top - 20} width={x1 - x0 + 4} height={bot - top + 24} rx={6} className={`hit ${selected === b.id ? 'sel' : ''} ${o.issues.get(b.id)?.length ? 'err' : ''}`} />
        <rect x={x0 + 4} y={top} width={x1 - x0 - 8} height={bot - top} rx={3} className={`sym-box box ${flow ? (qOn ? 'c-on' : 'c-off') : ''}`} />
        <text x={cx} y={top + 13} textAnchor="middle" className="boxtxt">{title}</text>
        {opField && opVal && (() => { const sh = o.showOp(opVal); return sh.sub ? <text x={cx} y={top + 24} textAnchor="middle" className="sym">{sh.sub}</text> : null; })()}
        {opField && <OpText o={o} id={b.id} field={opField} x={cx} y={top - 6} value={opVal} noSub noLive />}
        {b.pins.map((p, i) => {
          const y = py(p.y);
          if (p.side === 'L') {
            const isMain = i === 0;
            return (
              <g key={`L${p.name}`}>
                {p.kind === 'bool' && !isMain && !p.connected && (
                  <g className="pin-stub" onMouseDown={(e) => { e.stopPropagation(); o.onPin(b.id, p.field!); }}>
                    <line x1={x0 - 14} y1={y} x2={x0 + 4} y2={y} className="w" />
                    <circle cx={x0 - 16} cy={y} r={4} className="stub" />
                  </g>
                )}
                {p.kind === 'bool' && (p.connected || isMain) && <line x1={x0} y1={y} x2={x0 + 4} y2={y} className={pwClass(flow, p.power)} />}
                {p.kind === 'val' && <line x1={x0 - 4} y1={y} x2={x0 + 4} y2={y} className="w" />}
                <text x={x0 + 9} y={y + 4} className="pin">{p.name}</text>
                {p.kind === 'val' && <OpText o={o} id={b.id} field={p.field!} x={x0 - 6} y={y + 4} value={p.value} anchor="end" required={!p.optional} />}
              </g>
            );
          }
          return (
            <g key={`R${p.name}`}>
              <text x={x1 - 9} y={y + 4} textAnchor="end" className="pin">{p.name}</text>
              {p.kind === 'bool' && !p.connected && (
                <g className="pin-stub" onMouseDown={(e) => { e.stopPropagation(); o.onPin(b.id, p.field!); }}>
                  <line x1={x1 - 4} y1={y} x2={x1 + 14} y2={y} className={qCls} />
                  <circle cx={x1 + 16} cy={y} r={4} className="stub" />
                </g>
              )}
              {p.kind === 'bool' && p.connected && <line x1={x1 - 4} y1={y} x2={x1} y2={y} className={qCls} />}
              {p.kind === 'val' && <line x1={x1 - 4} y1={y} x2={x1 + 4} y2={y} className="w" />}
              {p.kind === 'val' && <OpText o={o} id={b.id} field={p.field!} x={x1 + 7} y={y + 4} value={p.value} anchor="start" required={!p.optional} />}
            </g>
          );
        })}
      </g>
    );
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={o.fit ? { maxWidth: '100%', height: 'auto' } : undefined} className="kop-svg" role="img" aria-label={T.kopEd.esquema}>
      <line x1={X0} y1={2} x2={X0} y2={H - 2} className={`rail ${flow ? (flow.get('rail') === 1 ? 'on' : flow.get('rail') === -1 ? 'skip' : '') : ''}`} />
      {out}
      {L.slots.map((s, i) => (
        <rect key={`slot${i}`} x={px(s.x) + 4} y={py(s.y) - 14} width={CW - 8} height={28} rx={5} className={`slot ${selected === s.chain ? 'sel' : ''}`}
          onMouseDown={(e) => { e.stopPropagation(); o.onSelect(s.chain, e); }} />
      ))}
    </svg>
  );
}
