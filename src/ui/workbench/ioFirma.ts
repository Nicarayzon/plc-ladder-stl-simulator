// Qué enseña el panel E/S y su «firma»: si la firma no cambia entre dos avisos del simulador, el
// panel no se vuelve a pintar (ver useSimTick).
import type { SimController } from '../../sim/SimController';
import { bitKey, sortBits, type Usage } from '../../core/usage';
import { makeReader, readRaw } from '../../sim/readers';

export const byteOf = (k: string) => parseInt(/^[A-Z]+(\d+)\./.exec(k)![1], 10);
export const bitOf = (k: string) => +k.slice(-1);

/** Marcas que usa el programa: bits y bytes/palabras/dobles palabras (sin indirectos) */
export function marcasDe(usage: Usage | null) {
  const bits = new Set<string>();
  const words = new Map<string, { byte: number; size: number }>();
  for (const a of usage?.accesses ?? []) {
    if (a.area !== 'M' || a.indirect) continue;
    if (a.kind === 'bit') bits.add(bitKey('M', a.byte, a.bit));
    else if (a.kind === 'mem') words.set(`${a.size === 1 ? 'MB' : a.size === 2 ? 'MW' : 'MD'} ${a.byte}`, { byte: a.byte, size: a.size });
  }
  const sorted = sortBits([...bits]);
  /** byte → bits que usa el programa (máscara), para la firma de la fila de la marca de ciclo */
  const masks = new Map<number, number>();
  for (const k of sorted) { const b = byteOf(k); masks.set(b, (masks.get(b) ?? 0) | (1 << bitOf(k))); }
  return { bits: sorted, masks, words: [...words.entries()].sort((x, y) => x[1].byte - y[1].byte || x[1].size - y[1].size) };
}

export type Marcas = ReturnType<typeof marcasDe>;

const readers = new Map<string, ReturnType<typeof makeReader>>();
export const readerOf = (a: string) => {
  let r = readers.get(a);
  if (!r) { r = makeReader(a); readers.set(a, r); }
  return r;
};

/**
 * Firma del panel: los bytes de la imagen de E/S y de marcas que se ven. Si no cambia ninguno,
 * el panel no se vuelve a pintar.
 */
export function firmaIo(sim: SimController, ins: string[], outs: string[], marcas: Marcas, analog: string[], words: string[], clockByte: number | null): unknown[] {
  const cpu = sim.cpu;
  const f: unknown[] = [sim.rev];
  let prev = -1;
  for (const k of ins) { const b = byteOf(k); if (b !== prev) { f.push(cpu.periphIn[b]); prev = b; } }
  prev = -1;
  for (const k of outs) { const b = byteOf(k); if (b !== prev) { f.push(cpu.periphOut[b]); prev = b; } }
  // de la marca de ciclo solo se ven los bits que usa el programa: el resto (M 0.0 cambia 20 veces
  // por segundo) no debe repintar el panel
  for (const [b, mask] of marcas.masks) f.push(b === clockByte ? cpu.M[b] & mask : cpu.M[b]);
  for (const [, w] of marcas.words) for (let i = 0; i < w.size; i++) f.push(cpu.M[w.byte + i]);
  for (const a of analog) f.push(readRaw(cpu, readerOf(a)));
  for (const a of words) f.push(readRaw(cpu, readerOf(a)));
  return f;
}
