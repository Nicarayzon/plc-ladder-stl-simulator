// Catálogo de elementos KOP agrupado por tipo de operación
import { useMemo, useState } from 'react';
import { Modal } from '../../ui/common/ui';
import type { CatalogKind } from '../edit';
import { BOX_DEFS, type FnBox } from '../model';
import { T } from '../../i18n';

export interface CatItem { kind: CatalogKind; label: string; desc: string; preset?: string }
export interface CatGroup { name: string; items: CatItem[] }

const cmp = (t: 'I' | 'D' | 'R'): CatItem[] => (['==', '<>', '>', '<', '>=', '<='] as const).map((r) => ({ kind: `CMP:${r}${t}` as CatalogKind, label: `CMP ${r}${t}`, desc: T.catalogo.comparar(t, r) }));
const boxes = (grupo: string): CatItem[] => (Object.keys(BOX_DEFS) as FnBox[]).filter((f) => BOX_DEFS[f].grupo === grupo).map((f) => ({ kind: `BOX:${f}` as CatalogKind, label: f, desc: T.catalogo.cajas[f] ?? BOX_DEFS[f].desc }));
const D = T.catalogo.d;
const G = T.catalogo.grupos;

export const CATALOG: CatGroup[] = [
  { name: G.bits, items: [
    { kind: 'NA', label: '---| |---', desc: D.NA },
    { kind: 'NC', label: '---|/|---', desc: D.NC },
    { kind: 'NOT', label: '--|NOT|--', desc: D.NOT },
    { kind: 'BOB', label: '---( )', desc: D.BOB },
    { kind: 'S', label: '---(S)', desc: D.S },
    { kind: 'R', label: '---(R)', desc: D.R },
    { kind: 'CON', label: '---(#)---', desc: D.CON },
    { kind: 'P', label: '---(P)---', desc: D.P },
    { kind: 'N', label: '---(N)---', desc: D.N },
    { kind: 'POS', label: 'POS', desc: D.POS },
    { kind: 'NEG', label: 'NEG', desc: D.NEG },
    { kind: 'BIEST:SR', label: 'SR', desc: D.SR },
    { kind: 'BIEST:RS', label: 'RS', desc: D.RS },
    { kind: 'SAVE', label: '---(SAVE)', desc: D.SAVE },
  ] },
  { name: G.comparacion, items: [...cmp('I'), ...cmp('D'), ...cmp('R')] },
  { name: G.temporizadores, items: [
    { kind: 'TEMP:S_IMPULS', label: 'S_IMPULS', desc: D.S_IMPULS },
    { kind: 'TEMP:S_VIMP', label: 'S_VIMP', desc: D.S_VIMP },
    { kind: 'TEMP:S_EVERZ', label: 'S_EVERZ', desc: D.S_EVERZ },
    { kind: 'TEMP:S_SEVERZ', label: 'S_SEVERZ', desc: D.S_SEVERZ },
    { kind: 'TEMP:S_AVERZ', label: 'S_AVERZ', desc: D.S_AVERZ },
    { kind: 'SI', label: '---(SI)', desc: D.SI },
    { kind: 'SV', label: '---(SV)', desc: D.SV },
    { kind: 'SE', label: '---(SE)', desc: D.SE },
    { kind: 'SS', label: '---(SS)', desc: D.SS },
    { kind: 'SA', label: '---(SA)', desc: D.SA },
  ] },
  { name: G.contadores, items: [
    { kind: 'CONT:ZAEHLER', label: 'ZAEHLER', desc: D.ZAEHLER },
    { kind: 'CONT:Z_VORW', label: 'Z_VORW', desc: D.Z_VORW },
    { kind: 'CONT:Z_RUECK', label: 'Z_RUECK', desc: D.Z_RUECK },
    { kind: 'ZV', label: '---(ZV)', desc: D.ZV },
    { kind: 'ZR', label: '---(ZR)', desc: D.ZR },
    { kind: 'SZ', label: '---(SZ)', desc: D.SZ },
  ] },
  // los cuadros de BOX_DEFS se agrupan por su `grupo` (en español, como clave) y se rotulan con el diccionario
  ...['Transferencia', 'Enteros', 'Coma flotante', 'Conversión', 'Lógica de palabras', 'Desplazamiento y rotación'].map((g) => ({ name: G[g] ?? g, items: boxes(g) })),
  { name: G.saltos, items: [
    { kind: 'JMP', label: '---(JMP)', desc: D.JMP },
    { kind: 'JMPN', label: '---(JMPN)', desc: D.JMPN },
  ] },
  { name: G.control, items: [
    { kind: 'CALL', label: '---(CALL)', desc: D.CALL },
    { kind: 'RET', label: '---(RET)', desc: D.RET },
  ] },
  { name: G.estado, items: ['OV', 'OS', 'BIE', '==0', '<>0', '>0', '<0', '>=0', '<=0', 'UO'].map((s) => ({ kind: 'NA' as CatalogKind, label: `---| ${s} |---`, desc: T.catalogo.bitEstado(s), preset: s })) },
];

export function CatalogModal({ onPick, onClose }: { onPick: (it: CatItem) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [grp, setGrp] = useState(0);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return null;
    return CATALOG.flatMap((g) => g.items.filter((i) => i.label.toLowerCase().includes(t) || i.desc.toLowerCase().includes(t)).map((i) => ({ ...i, grupo: g.name })));
  }, [q]);
  const list = filtered ?? CATALOG[grp].items.map((i) => ({ ...i, grupo: CATALOG[grp].name }));
  return (
    <Modal title={T.catalogo.titulo} onClose={onClose} width={760}>
      <input className="input" style={{ width: '100%', marginBottom: 10 }} placeholder={T.catalogo.buscar} autoFocus value={q} onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && list[0]) onPick(list[0]); }} aria-label={T.catalogo.buscarEtiqueta} />
      <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', gap: 10, height: 420 }}>
        <div style={{ overflowY: 'auto', borderRight: '1px solid var(--border)', paddingRight: 6 }}>
          {CATALOG.map((g, i) => (
            <button key={g.name} className={`nav-item ${!filtered && grp === i ? 'active' : ''}`} onClick={() => { setQ(''); setGrp(i); }}>{g.name}</button>
          ))}
        </div>
        <div style={{ overflowY: 'auto' }}>
          {list.map((it, i) => (
            <button key={`${it.kind}${it.preset ?? ''}${i}`} className="cat-item" onClick={() => onPick(it)}>
              <span className="mono cat-label">{it.label}</span>
              <span className="muted">{it.desc}</span>
              {filtered && <span className="faint" style={{ marginLeft: 'auto', fontSize: 11 }}>{it.grupo}</span>}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
