// Búfer circular del analizador lógico: una muestra por ciclo de cada señal elegida.
import type { CPU } from '../core/cpu';
import { bitsF32, s16, s32 } from '../core/num';
import { makeReader, readRaw, type Reader } from './readers';
import type { Symbols } from '../core/operands';

export type SignalView = 'bit' | 'dec' | 'hex' | 'analog' | 'real';

export interface Signal {
  id: number;
  text: string;
  label: string;
  reader: Reader;
  view: SignalView;
  color: string;
  data: Float64Array;
}

export interface Marker { t: number; label: string }

const COLORS = ['#3ddc84', '#5aa0e6', '#f2b84b', '#e2667a', '#b48cf2', '#4fd1c5', '#f08a4b', '#9bd35a', '#e57ad6', '#8fa3bf'];

export class AnalyzerBuffer {
  cap: number;
  head = 0;
  count = 0;
  t: Float64Array;
  signals: Signal[] = [];
  markers: Marker[] = [];
  private nextId = 1;
  /** Muestrear cada k ciclos */
  every = 1;
  private skip = 0;

  constructor(cap = 65536) {
    this.cap = cap;
    this.t = new Float64Array(cap);
  }

  add(text: string, symbols?: Symbols, label?: string, view?: SignalView): Signal {
    const reader = makeReader(text, symbols);
    const v: SignalView = view ?? (reader.size === 0 ? 'bit' : reader.size === 4 && /:REAL$/i.test(text) ? 'real' : 'dec');
    const data = new Float64Array(this.cap);
    data.fill(NaN);
    const sig: Signal = { id: this.nextId++, text, label: label ?? text, reader, view: v, color: COLORS[(this.nextId - 2) % COLORS.length], data };
    this.signals.push(sig);
    return sig;
  }

  remove(id: number) {
    this.signals = this.signals.filter((s) => s.id !== id);
  }

  clear() {
    this.head = 0;
    this.count = 0;
    this.markers = [];
    for (const s of this.signals) s.data.fill(NaN);
  }

  /** Valor numérico de una señal según su vista (sin signo para bits). */
  static value(cpu: CPU, s: { reader: Reader; view: SignalView }): number {
    const raw = readRaw(cpu, s.reader);
    if (Number.isNaN(raw)) return NaN;
    const size = s.reader.size;
    if (s.view === 'real' && size === 4) return bitsF32(raw);
    if (size === 2 && s.reader.kind === 'mem') return s16(raw);
    if (size === 4) return s32(raw);
    return raw;
  }

  sample(cpu: CPU) {
    if (this.every > 1) {
      this.skip = (this.skip + 1) % this.every;
      if (this.skip !== 0) return;
    }
    const i = this.head;
    this.t[i] = cpu.timeMs;
    for (const s of this.signals) s.data[i] = AnalyzerBuffer.value(cpu, s);
    this.head = (this.head + 1) % this.cap;
    if (this.count < this.cap) this.count++;
  }

  /** Índice físico de la muestra lógica k (0 = la más antigua). */
  idx(k: number): number {
    return (this.head - this.count + k + this.cap * 2) % this.cap;
  }

  firstTime(): number {
    return this.count ? this.t[this.idx(0)] : 0;
  }
  lastTime(): number {
    return this.count ? this.t[this.idx(this.count - 1)] : 0;
  }

  /** Busca la última muestra con tiempo ≤ t (búsqueda binaria). */
  findIndex(t: number): number {
    let lo = 0;
    let hi = this.count - 1;
    if (hi < 0) return -1;
    if (t < this.t[this.idx(0)]) return -1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.t[this.idx(mid)] <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  toCSV(): string {
    const head = ['t_ms', ...this.signals.map((s) => `"${s.label.replace(/"/g, '""')}"`)].join(';');
    const rows = [head];
    for (let k = 0; k < this.count; k++) {
      const i = this.idx(k);
      rows.push([String(this.t[i]), ...this.signals.map((s) => (Number.isNaN(s.data[i]) ? '' : String(s.data[i]).replace('.', ',')))].join(';'));
    }
    return rows.join('\n');
  }
}
