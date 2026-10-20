// Operaciones puras sobre el programa (bloques y segmentos)
import { newSegId, segId, type Bloque, type Programa, type Segmento } from '../../core/program';
import { normBlockName } from '../../core/compiler';
import { reId } from '../../kop/ids';
import type { SegmentoKOP } from '../../kop/model';
import { newId } from '../../kop/ids';

export const blockIndex = (p: Programa, name: string) => p.bloques.findIndex((b) => normBlockName(b.nombre) === name);

export function updateBlock(p: Programa, name: string, fn: (b: Bloque) => Bloque): Programa {
  return { ...p, bloques: p.bloques.map((b) => (normBlockName(b.nombre) === name ? fn(b) : b)) };
}

export function updateSegment(p: Programa, block: string, id: string, fn: (s: Segmento) => Segmento): Programa {
  return updateBlock(p, block, (b) => ({ ...b, segmentos: b.segmentos.map((s) => (segId(s) === id ? fn(s) : s)) }));
}

export function newKopSegment(): SegmentoKOP {
  return { id: newSegId(), titulo: '', entrada: { k: 'SER', id: newId(), items: [{ k: 'NA', id: newId(), op: '' }] }, salidas: [{ salida: { k: 'BOB', id: newId(), op: '' } }] };
}

export function newSegment(lang: 'AWL' | 'KOP'): Segmento {
  return lang === 'AWL' ? { lang: 'AWL', id: newSegId(), titulo: '', awl: '' } : { lang: 'KOP', kop: newKopSegment() };
}

export function insertSegment(p: Programa, block: string, afterId: string | null, seg: Segmento): Programa {
  return updateBlock(p, block, (b) => {
    const i = afterId === null ? b.segmentos.length - 1 : b.segmentos.findIndex((s) => segId(s) === afterId);
    const segs = [...b.segmentos];
    segs.splice(i + 1, 0, seg);
    return { ...b, segmentos: segs };
  });
}

export function deleteSegment(p: Programa, block: string, id: string): Programa {
  return updateBlock(p, block, (b) => ({ ...b, segmentos: b.segmentos.filter((s) => segId(s) !== id) }));
}

export function moveSegment(p: Programa, block: string, id: string, dir: -1 | 1): Programa {
  return updateBlock(p, block, (b) => {
    const segs = [...b.segmentos];
    const i = segs.findIndex((s) => segId(s) === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= segs.length) return b;
    [segs[i], segs[j]] = [segs[j], segs[i]];
    return { ...b, segmentos: segs };
  });
}

export function duplicateSegment(p: Programa, block: string, id: string): Programa {
  const b = p.bloques[blockIndex(p, block)];
  const s = b.segmentos.find((x) => segId(x) === id)!;
  const copy: Segmento = s.lang === 'AWL' ? { ...s, id: newSegId() } : { lang: 'KOP', kop: { ...reId(s.kop), id: newSegId() } };
  return insertSegment(p, block, id, copy);
}

export function nextFc(p: Programa): string {
  const used = new Set(p.bloques.map((b) => normBlockName(b.nombre)));
  for (let i = 1; ; i++) if (!used.has(`FC${i}`)) return `FC${i}`;
}

export function addBlock(p: Programa, name: string): Programa {
  if (blockIndex(p, name) >= 0) return p;
  const blocks = [...p.bloques, { nombre: name, segmentos: [newSegment('AWL')] }];
  const order = (n: string) => (n === 'OB1' ? 0 : n === 'OB100' ? 1 : n.startsWith('OB') ? 2 : 3 + parseInt(n.slice(2), 10) / 1000);
  blocks.sort((a, b) => order(normBlockName(a.nombre)) - order(normBlockName(b.nombre)));
  return { ...p, bloques: blocks };
}

export function removeBlock(p: Programa, name: string): Programa {
  return { ...p, bloques: p.bloques.filter((b) => normBlockName(b.nombre) !== name) };
}

export function renameBlock(p: Programa, from: string, to: string): Programa {
  return updateBlock(p, from, (b) => ({ ...b, nombre: to }));
}
