// Catálogo de elementos KOP agrupado por tipo de operación
import { useMemo, useState } from 'react';
import { Modal } from '../../ui/common/ui';
import type { CatalogKind } from '../edit';
import { BOX_DEFS, type FnBox } from '../model';

export interface CatItem { kind: CatalogKind; label: string; desc: string; preset?: string }
export interface CatGroup { name: string; items: CatItem[] }

const cmp = (t: 'I' | 'D' | 'R'): CatItem[] => (['==', '<>', '>', '<', '>=', '<='] as const).map((r) => ({ kind: `CMP:${r}${t}` as CatalogKind, label: `CMP ${r}${t}`, desc: `Comparar ${t === 'I' ? 'enteros' : t === 'D' ? 'dobles enteros' : 'REAL'}: IN1 ${r} IN2` }));
const boxes = (grupo: string): CatItem[] => (Object.keys(BOX_DEFS) as FnBox[]).filter((f) => BOX_DEFS[f].grupo === grupo).map((f) => ({ kind: `BOX:${f}` as CatalogKind, label: f, desc: BOX_DEFS[f].desc }));

export const CATALOG: CatGroup[] = [
  { name: 'Operaciones lógicas con bits', items: [
    { kind: 'NA', label: '---| |---', desc: 'Contacto normalmente abierto (F2)' },
    { kind: 'NC', label: '---|/|---', desc: 'Contacto normalmente cerrado (F3)' },
    { kind: 'NOT', label: '--|NOT|--', desc: 'Invertir el resultado lógico' },
    { kind: 'BOB', label: '---( )', desc: 'Bobina de salida (F7)' },
    { kind: 'S', label: '---(S)', desc: 'Activar (poner a 1)' },
    { kind: 'R', label: '---(R)', desc: 'Desactivar (poner a 0)' },
    { kind: 'CON', label: '---(#)---', desc: 'Conector: asigna el resultado intermedio a un bit' },
    { kind: 'P', label: '---(P)---', desc: 'Flanco positivo del RLO (necesita una marca)' },
    { kind: 'N', label: '---(N)---', desc: 'Flanco negativo del RLO (necesita una marca)' },
    { kind: 'POS', label: 'POS', desc: 'Flanco positivo de un operando' },
    { kind: 'NEG', label: 'NEG', desc: 'Flanco negativo de un operando' },
    { kind: 'BIEST:SR', label: 'SR', desc: 'Biestable de activación/desactivación (prioridad a desactivar)' },
    { kind: 'BIEST:RS', label: 'RS', desc: 'Biestable de desactivación/activación (prioridad a activar)' },
    { kind: 'SAVE', label: '---(SAVE)', desc: 'Guardar el RLO en RB' },
  ] },
  { name: 'Comparación', items: [...cmp('I'), ...cmp('D'), ...cmp('R')] },
  { name: 'Temporizadores', items: [
    { kind: 'TEMP:S_IMPULS', label: 'S_IMPULS', desc: 'Temporizador como impulso (SI)' },
    { kind: 'TEMP:S_VIMP', label: 'S_VIMP', desc: 'Impulso prolongado (SV)' },
    { kind: 'TEMP:S_EVERZ', label: 'S_EVERZ', desc: 'Retardo a la conexión (SE)' },
    { kind: 'TEMP:S_SEVERZ', label: 'S_SEVERZ', desc: 'Retardo a la conexión con memoria (SS)' },
    { kind: 'TEMP:S_AVERZ', label: 'S_AVERZ', desc: 'Retardo a la desconexión (SA)' },
    { kind: 'SI', label: '---(SI)', desc: 'Bobina: arrancar impulso' },
    { kind: 'SV', label: '---(SV)', desc: 'Bobina: arrancar impulso prolongado' },
    { kind: 'SE', label: '---(SE)', desc: 'Bobina: arrancar retardo a la conexión' },
    { kind: 'SS', label: '---(SS)', desc: 'Bobina: arrancar retardo con memoria' },
    { kind: 'SA', label: '---(SA)', desc: 'Bobina: arrancar retardo a la desconexión' },
  ] },
  { name: 'Contadores', items: [
    { kind: 'CONT:ZAEHLER', label: 'ZAEHLER', desc: 'Contador adelante/atrás' },
    { kind: 'CONT:Z_VORW', label: 'Z_VORW', desc: 'Contador adelante' },
    { kind: 'CONT:Z_RUECK', label: 'Z_RUECK', desc: 'Contador atrás' },
    { kind: 'ZV', label: '---(ZV)', desc: 'Bobina: contar adelante' },
    { kind: 'ZR', label: '---(ZR)', desc: 'Bobina: contar atrás' },
    { kind: 'SZ', label: '---(SZ)', desc: 'Bobina: cargar el valor de contaje' },
  ] },
  { name: 'Transferencia', items: boxes('Transferencia') },
  { name: 'Enteros', items: boxes('Enteros') },
  { name: 'Coma flotante', items: boxes('Coma flotante') },
  { name: 'Conversión', items: boxes('Conversión') },
  { name: 'Lógica de palabras', items: boxes('Lógica de palabras') },
  { name: 'Desplazamiento y rotación', items: boxes('Desplazamiento y rotación') },
  { name: 'Saltos', items: [
    { kind: 'JMP', label: '---(JMP)', desc: 'Saltar a la meta si RLO = 1 (sin contactos: siempre)' },
    { kind: 'JMPN', label: '---(JMPN)', desc: 'Saltar a la meta si RLO = 0' },
  ] },
  { name: 'Control del programa', items: [
    { kind: 'CALL', label: '---(CALL)', desc: 'Llamar a una FC (si RLO = 1; sin contactos: siempre)' },
    { kind: 'RET', label: '---(RET)', desc: 'Terminar el bloque si RLO = 1' },
  ] },
  { name: 'Bits de estado', items: ['OV', 'OS', 'BIE', '==0', '<>0', '>0', '<0', '>=0', '<=0', 'UO'].map((s) => ({ kind: 'NA' as CatalogKind, label: `---| ${s} |---`, desc: `Contacto del bit de estado ${s}`, preset: s })) },
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
    <Modal title="Catálogo de elementos KOP" onClose={onClose} width={760}>
      <input className="input" style={{ width: '100%', marginBottom: 10 }} placeholder="Buscar: contacto, CMP, MOVE, temporizador…" autoFocus value={q} onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && list[0]) onPick(list[0]); }} aria-label="Buscar en el catálogo" />
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
