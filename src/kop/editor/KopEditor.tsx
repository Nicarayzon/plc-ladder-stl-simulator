// Editor gráfico de un segmento KOP
import { useCallback, useMemo, useRef, useState } from 'react';
import type { Elem, Salida, SegmentoKOP } from '../model';
import { layoutSegment } from '../layout';
import { computeFlow, type Flow } from '../flow';
import { validateSegment, type KopIssue } from '../validate';
import * as E from '../edit';
import { KopSvg, CW, RH, X0, PADT, WY, type OperandHit } from '../render/KopSvg';
import { CatalogModal, type CatItem } from './Catalog';
import { ContextMenu, type MenuItem } from '../../ui/common/ui';
import { Icon } from '../../ui/common/Icon';
import { originKeyElem, originKeySeg, type SimController } from '../../sim/SimController';
import { useSimTick } from '../../ui/workbench/useSim';
import { useSettings } from '../../store/settings';
import { parseOperand } from '../../core/operands';
import { displayOperand, operandEnToDe } from '../../core/translate';
import { makeReader, readRaw } from '../../sim/readers';
import { s16, s32 } from '../../core/num';
import { normAddr } from '../../ui/workbench/symbols';
import { askText } from '../../ui/common/ask';

export interface KopEditorProps {
  seg: SegmentoKOP;
  onChange: (s: SegmentoKOP) => void;
  sim: SimController;
  block: string;
  observe: boolean;
  readOnly?: boolean;
  lang: 'de' | 'en';
  symByAddr: Map<string, string>;
  symbols: string[];
  onFocus?: () => void;
}

/** «A4.7» → «A 4.7», «MW10» → «MW 10», «DB1.DBX0.0» → «DB1.DBX 0.0» */
export function spacedOperand(t: string): string {
  if (/^DB\d+\./.test(t)) return t.replace(/^(DB\d+\.DB[XBWD])\s*(\d)/, '$1 $2');
  if (t.includes('[')) return t;
  return t.replace(/^([A-Z]+)\s*(\d)/, '$1 $2');
}

/** Normaliza lo que escribe el alumno: «e0.0» → «E 0.0» (en alemán); constantes y símbolos se respetan. */
export function normalizeOperandInput(v: string, lang: 'de' | 'en'): string {
  let t = v.trim();
  if (!t) return '';
  if (t.startsWith('"')) return t.endsWith('"') ? t : `${t}"`;
  if (lang === 'en') t = operandEnToDe(t);
  try {
    const op = parseOperand(t);
    if (!op) return t;
    if (op.kind === 'const') return t.toUpperCase().replace(/^(S5T|T|L|C|P|DW|W|B)#/i, (m) => m.toUpperCase());
    if (op.kind === 'block') return `${op.name} ${op.n}`;
    return spacedOperand(op.text);
  } catch {
    return t.toUpperCase();
  }
}

export function KopEditor(props: KopEditorProps) {
  const { seg, onChange, sim, block, observe, readOnly, lang, symByAddr } = props;
  const simbolica = useSettings((s) => s.simbolica);
  const zoom = useSettings((s) => s.kopZoom);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<(OperandHit & { text: string }) | null>(null);
  const [catalog, setCatalog] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const host = useRef<HTMLDivElement>(null);

  const layout = useMemo(() => layoutSegment(seg), [seg]);
  const symMap = sim.compiled.symbols;
  const issues = useMemo(() => {
    const m = new Map<string, KopIssue[]>();
    for (const i of validateSegment(seg, symMap)) m.set(i.id, [...(m.get(i.id) ?? []), i]);
    return m;
  }, [seg, symMap]);

  // ───── flujo de corriente ─────
  const calcFlow = (): Flow | null => {
    if (!(observe && sim.cpu.state === 'RUN')) return null;
    const cpu = sim.cpu;
    const ob = cpu.obs.get(block);
    const blk = cpu.blocks.get(block);
    let flow: Flow | null = null;
    if (ob && blk) {
      const segLoc = sim.index.map.get(originKeySeg(block, seg.id));
      const segExecuted = !!segLoc && ob.stamp[segLoc[0].pc] === cpu.stamp;
      flow = computeFlow(seg, (id, role) => {
        const locs = sim.index.map.get(originKeyElem(block, seg.id, id));
        if (!locs) return null;
        for (let i = locs.length - 1; i >= 0; i--) {
          const pc = locs[i].pc;
          if (blk.instrs[pc]?.origin?.role !== role) continue;
          const st = ob.st[pc];
          return { executed: ob.stamp[pc] === cpu.stamp, rlo: (st >> 1) & 1, sta: (st >> 2) & 1, count: ob.count[pc] };
        }
        return null;
      }, (s) => {
        try {
          if (s.k === 'TEMP') return cpu.timers[parseOperand(s.t, symMap)!.n!].q;
          if (s.k === 'CONT') return cpu.counters[parseOperand(s.z, symMap)!.n!].value > 0 ? 1 : 0;
          if (s.k === 'BIEST') return readRaw(cpu, makeReader(s.op, symMap));
        } catch { /* operando no válido */ }
        return null;
      }, segExecuted);
    }
    return flow;
  };

  // valores en vivo de los operandos que se ven (se leen al pintar)
  const liveCache = useMemo(() => new Map<string, ReturnType<typeof makeReader> | null>(), [symMap]); // eslint-disable-line react-hooks/exhaustive-deps
  // solo se repinta si cambia el flujo de corriente o algún valor en vivo
  useSimTick(sim, observe ? 10 : 2, () => {
    const f: unknown[] = [sim.rev, sim.cpu.state];
    if (!observe) return f;
    const fl = calcFlow();
    let k = '';
    if (fl) for (const v of fl.values()) k += v;
    f.push(k);
    for (const r of liveCache.values()) if (r) f.push(readRaw(sim.cpu, r));
    return f;
  });
  const flow = calcFlow();

  // ───── textos de operandos ─────
  const showOp = useCallback((op: string) => {
    const t = op.trim();
    if (t.startsWith('"')) {
      const addr = symMap.get(t.replace(/^"|"$/g, ''));
      return simbolica || !addr ? { main: t, sub: addr ? displayOperand(addr, lang) : undefined } : { main: displayOperand(addr, lang), sub: t };
    }
    const sym = symByAddr.get(normAddr(t));
    const shown = displayOperand(t, lang);
    if (sym) return simbolica ? { main: `"${sym}"`, sub: shown } : { main: shown, sub: `"${sym}"` };
    return { main: shown };
  }, [symMap, symByAddr, simbolica, lang]);

  const live = useMemo(() => {
    if (!observe) return undefined;
    const cache = liveCache;
    return (op: string) => {
      let r = cache.get(op);
      if (r === undefined) {
        try {
          const o = parseOperand(op, symMap);
          r = o && (o.kind === 'mem' || o.kind === 'timer' || o.kind === 'counter') ? makeReader(o.kind === 'mem' ? op : `${op}:VALOR`, symMap) : null;
        } catch { r = null; }
        cache.set(op, r);
      }
      if (!r) return null;
      const raw = readRaw(sim.cpu, r);
      if (Number.isNaN(raw)) return null;
      return String(r.size === 2 && r.kind === 'mem' ? s16(raw) : r.size === 4 ? s32(raw) : raw);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observe, liveCache]);

  // ───── edición ─────
  const apply = (r: E.EditResult) => {
    onChange(r.seg);
    setSelected(r.sel);
  };
  const ins = (kind: E.CatalogKind, preset?: string) => {
    if (readOnly) return;
    let r = E.insertFromCatalog(seg, selected, kind);
    if (preset && r.sel) r = { seg: E.setField(r.seg, r.sel, 'op', preset), sel: r.sel };
    apply(r);
    // editar el operando del elemento nuevo
    if (!preset && r.sel) setTimeout(() => startEditFirst(r.seg, r.sel!), 30);
  };
  const startEditFirst = (s: SegmentoKOP, id: string) => {
    const n = E.findNode(s, id);
    if (!n) return;
    const fields = E.operandFields(n);
    if (!fields.length) return;
    beginEdit(s, id, fields[0]);
  };
  const beginEdit = (s: SegmentoKOP, id: string, field: string) => {
    if (readOnly) return;
    const L = layoutSegment(s);
    const it = L.items.find((x) => x.id === id) ?? L.boxes.find((x) => x.id === id);
    if (!it) return;
    const n = E.findNode(s, id) as unknown as Record<string, unknown>;
    const value = field.startsWith('p.') ? ((n.p as Record<string, string>)[field.slice(2)] ?? '') : String(n[field] ?? '');
    const cx = X0 + (it.x + it.w / 2) * CW;
    const wy = PADT + it.y * RH + WY;
    setEditing({ id, field, x: cx, y: wy - 16, w: 110, anchor: 'middle', value, text: value ? displayOperand(value, lang) : '' });
  };
  const commitEdit = (next?: 'tab' | 'shiftTab') => {
    if (!editing) return;
    const v = editing.field === 'meta' ? editing.text.trim().toUpperCase() : editing.field === 'bloque' ? normalizeOperandInput(editing.text, 'de') : normalizeOperandInput(editing.text, lang);
    const ns = E.setField(seg, editing.id, editing.field, v);
    onChange(ns);
    const n = E.findNode(ns, editing.id);
    setEditing(null);
    if (next && n) {
      const fields = E.operandFields(n);
      const i = fields.indexOf(editing.field);
      const nf = fields[next === 'tab' ? i + 1 : i - 1];
      if (nf) setTimeout(() => beginEdit(ns, editing.id, nf), 10);
    }
    host.current?.focus();
  };

  const node = selected ? E.findNode(seg, selected) : null;

  const toggleNANC = () => {
    if (!node || (node.k !== 'NA' && node.k !== 'NC')) return;
    apply(E.replaceNode(seg, node.id, { ...node, k: node.k === 'NA' ? 'NC' : 'NA' } as Elem));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (editing || readOnly) return;
    const k = e.key;
    const alt = e.altKey;
    const code = e.code;
    const is = (fk: string, digit: string) => k === fk || (alt && code === `Digit${digit}`);
    let handled = true;
    if (is('F2', '1')) ins('NA');
    else if (is('F3', '2')) ins('NC');
    else if (is('F7', '7')) {
      if (node && !E.isElemKind(node)) apply(E.wrapParallel(seg, node.id));
      else ins('BOB');
    } else if (is('F8', '8')) apply(E.wrapParallel(seg, selected));
    else if (is('F9', '9')) { if (selected) apply(E.addBranchToEnclosing(seg, selected)); }
    else if ((e.metaKey || e.ctrlKey) && k.toLowerCase() === 'k') setCatalog(true);
    else if (k === 'Delete' || k === 'Backspace') { if (selected) apply(E.deleteNode(seg, selected)); }
    else if (k === 'Enter' && selected) startEditFirst(seg, selected);
    else if (k === 'Escape') setSelected(null);
    else if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') move(k);
    else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  };

  const move = (k: string) => {
    const all = [...layout.items.map((i) => ({ id: i.id, x: i.x, y: i.y })), ...layout.boxes.map((b) => ({ id: b.id, x: b.x, y: b.y }))];
    if (!all.length) return;
    const cur = all.find((a) => a.id === selected);
    if (!cur) { setSelected(all.sort((a, b) => a.y - b.y || a.x - b.x)[0].id); return; }
    let cands = all.filter((a) => a.id !== cur.id);
    if (k === 'ArrowLeft') cands = cands.filter((a) => a.y === cur.y && a.x < cur.x).sort((a, b) => b.x - a.x);
    if (k === 'ArrowRight') cands = cands.filter((a) => a.y === cur.y && a.x > cur.x).sort((a, b) => a.x - b.x);
    if (k === 'ArrowUp') cands = cands.filter((a) => a.y < cur.y).sort((a, b) => (b.y - a.y) || Math.abs(a.x - cur.x) - Math.abs(b.x - cur.x));
    if (k === 'ArrowDown') cands = cands.filter((a) => a.y > cur.y).sort((a, b) => (a.y - b.y) || Math.abs(a.x - cur.x) - Math.abs(b.x - cur.x));
    if (cands[0]) setSelected(cands[0].id);
  };

  const ctxItems = (id: string): MenuItem[] => {
    const n = E.findNode(seg, id);
    const items: MenuItem[] = [];
    if (n && E.operandFields(n).length) items.push({ label: 'Editar operando', hint: '↵', onClick: () => startEditFirst(seg, id) });
    if (n && (n.k === 'NA' || n.k === 'NC')) items.push({ label: n.k === 'NA' ? 'Cambiar a contacto NC' : 'Cambiar a contacto NA', onClick: () => apply(E.replaceNode(seg, id, { ...n, k: n.k === 'NA' ? 'NC' : 'NA' } as Elem)) });
    if (n && (n.k === 'BOB' || n.k === 'S' || n.k === 'R')) {
      for (const k of ['BOB', 'S', 'R'] as const) if (k !== n.k) items.push({ label: `Cambiar a bobina ${k === 'BOB' ? '( )' : `(${k})`}`, onClick: () => apply(E.replaceNode(seg, id, Object.assign({}, n, { k }) as Salida)) });
    }
    if (n && n.k === 'CMP') {
      items.push({ label: 'Cambiar comparación…', onClick: async () => {
        const fn = (await askText({ title: 'Cambiar comparación', label: 'Comparación (==I, <>I, >I, <I, >=I, <=I; …D para DINT, …R para REAL):', value: n.fn,
          validate: (v) => (/^(==|<>|>=|<=|>|<)[IDR]$/.test(v.trim().toUpperCase()) ? null : 'Por ejemplo: >I, ==D, <=R') }))?.toUpperCase();
        if (fn) apply(E.replaceNode(seg, id, { ...n, fn: fn as typeof n.fn }));
      } });
    }
    items.push({ sep: true, label: '' });
    items.push({ label: 'Insertar contacto NA detrás', hint: 'F2', onClick: () => { setSelected(id); apply(E.insertSeries(seg, id, E.makeNode('NA') as Elem, 'after')); } });
    items.push({ label: 'Insertar contacto NA delante', onClick: () => apply(E.insertSeries(seg, id, E.makeNode('NA') as Elem, 'before')) });
    items.push({ label: n && !E.isElemKind(n) ? 'Añadir salida en paralelo' : 'Abrir rama paralela', hint: 'F8', onClick: () => apply(E.wrapParallel(seg, id)) });
    items.push({ sep: true, label: '' });
    items.push({ label: 'Borrar', hint: '⌫', onClick: () => apply(E.deleteNode(seg, id)) });
    return items;
  };

  const editingInput = editing && (
    <input className="kop-op-input mono" autoFocus value={editing.text}
      style={{ left: (editing.anchor === 'middle' ? editing.x - 60 : editing.anchor === 'start' ? editing.x - 4 : editing.x - 116) * zoom, top: (editing.y - 13) * zoom, width: 120 }}
      onChange={(e) => setEditing({ ...editing, text: e.target.value })}
      onBlur={() => commitEdit()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
        if (e.key === 'Escape') { e.preventDefault(); setEditing(null); host.current?.focus(); }
        if (e.key === 'Tab') { e.preventDefault(); commitEdit(e.shiftKey ? 'shiftTab' : 'tab'); }
      }}
      list={`kop-sym-${seg.id}`} aria-label="Operando" />
  );

  return (
    <div className="kop-editor" onFocus={props.onFocus}>
      {!readOnly && (
        <div className="kop-tools" role="toolbar" aria-label="Elementos KOP">
          <button className="btn small" onClick={() => ins('NA')} title="Contacto NA (F2 o ⌥1)"><span className="mono">-| |-</span></button>
          <button className="btn small" onClick={() => ins('NC')} title="Contacto NC (F3 o ⌥2)"><span className="mono">-|/|-</span></button>
          <button className="btn small" onClick={() => (node && !E.isElemKind(node) ? apply(E.wrapParallel(seg, node.id)) : ins('BOB'))} title="Bobina (F7 o ⌥7)"><span className="mono">-( )</span></button>
          <button className="btn small" onClick={() => apply(E.wrapParallel(seg, selected))} title="Abrir rama paralela sobre la selección (F8 o ⌥8)"><Icon name="ladder" size={13} />Rama</button>
          <button className="btn small" disabled={!selected} onClick={() => selected && apply(E.addBranchToEnclosing(seg, selected))} title="Añadir otra rama al paralelo (F9 o ⌥9)">+ Rama</button>
          <button className="btn small" disabled={!node || (node.k !== 'NA' && node.k !== 'NC')} onClick={toggleNANC} title="Cambiar NA ↔ NC">NA↔NC</button>
          <button className="btn small" onClick={() => setCatalog(true)} title="Catálogo de elementos (⌘K)"><Icon name="plus" size={13} />Catálogo</button>
          <button className="btn small ghost" disabled={!selected} onClick={() => selected && apply(E.deleteNode(seg, selected))} title="Borrar (⌫)"><Icon name="trash" size={13} /></button>
          <span className="sep" />
          <label className="row faint" style={{ fontSize: 11.5, gap: 4 }} title="Meta (LABEL) al principio del segmento, para saltar aquí con JMP">
            Meta
            <input className="input mono" style={{ height: 22, width: 64 }} value={seg.meta ?? ''} placeholder="—" maxLength={4}
              onChange={(e) => onChange(E.setField(seg, seg.id, 'meta', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '')))} aria-label="Meta del segmento" />
          </label>
          <span className="spacer" />
          <span className="faint" style={{ fontSize: 11 }}>Doble clic: operando · Tab: siguiente</span>
        </div>
      )}
      <div className="kop-canvas" ref={host} tabIndex={0} onKeyDown={onKey} onMouseDown={() => { if (!editing) setSelected(null); }}
        aria-label="Editor KOP: F2 contacto NA, F3 NC, F7 bobina, F8 rama, Supr borrar">
        <div style={{ position: 'relative', transform: `scale(${zoom})`, transformOrigin: '0 0', width: 'fit-content' }}>
          <KopSvg layout={layout} flow={flow} selected={selected} issues={issues} showOp={showOp} live={live} lang={lang}
            onSelect={(id) => { setSelected(id); host.current?.focus(); }}
            onEdit={(h) => { setSelected(h.id); if (!readOnly) setEditing({ ...h, text: h.value ? displayOperand(h.value, lang) : '' }); }}
            onPin={(boxId, field) => { if (!readOnly) apply(E.connectPin(seg, boxId, field)); }}
            onContext={(id, e) => { setSelected(id); if (!readOnly) setMenu({ x: e.clientX, y: e.clientY, id }); }} />
        </div>
        {editingInput}
        <datalist id={`kop-sym-${seg.id}`}>{props.symbols.map((s) => <option key={s} value={`"${s}"`} />)}</datalist>
      </div>
      {catalog && <CatalogModal onClose={() => setCatalog(false)} onPick={(it: CatItem) => { setCatalog(false); ins(it.kind, it.preset); host.current?.focus(); }} />}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={ctxItems(menu.id)} onClose={() => setMenu(null)} />}
    </div>
  );
}
