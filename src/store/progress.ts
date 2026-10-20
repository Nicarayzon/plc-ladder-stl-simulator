import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Programa } from '../core/program';
import type { WbState } from '../ui/workbench/types';

export type Estado = 'sin_ver' | 'intentado' | 'superado';

export interface ProgItem {
  estado: Estado;
  mejorNota: number;
  intentos: number;
  fecha: number;
  /** 0 = sin repaso; 1, 2, 3 = repasos pendientes a 1, 3 y 7 días */
  caja: number;
  proximo: number | null;
}

export interface ExamRecord {
  fecha: number;
  nota: number;
  preguntas: number;
  duracionS: number;
  detalle: { id: string; titulo: string; nota: number }[];
}

interface ProgressState {
  items: Record<string, ProgItem>;
  examenes: ExamRecord[];
  borradores: Record<string, { programa: Programa; wb?: WbState }>;
  ultimo: string | null;
  visto: (id: string) => void;
  registrar: (id: string, nota: number) => void;
  guardarBorrador: (id: string, programa: Programa, wb?: WbState) => void;
  borrarBorrador: (id: string) => void;
  guardarExamen: (r: ExamRecord) => void;
  importar: (data: Partial<Pick<ProgressState, 'items' | 'examenes' | 'borradores'>>) => void;
  reiniciar: () => void;
}

const DAY = 86400000;
const blank = (): ProgItem => ({ estado: 'sin_ver', mejorNota: 0, intentos: 0, fecha: 0, caja: 0, proximo: null });

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      items: {},
      examenes: [],
      borradores: {},
      ultimo: null,
      visto: (id) => {
        const it = get().items[id] ?? blank();
        set({ ultimo: id, items: { ...get().items, [id]: { ...it, fecha: it.fecha || Date.now() } } });
      },
      registrar: (id, nota) => {
        const now = Date.now();
        const it = { ...(get().items[id] ?? blank()) };
        it.intentos += 1;
        it.fecha = now;
        it.mejorNota = Math.max(it.mejorNota, nota);
        const ok = nota >= 0.999;
        if (ok) it.estado = 'superado';
        else if (it.estado !== 'superado') it.estado = 'intentado';
        if (!ok) {
          it.caja = 1;
          it.proximo = now + DAY;
        } else if (it.caja > 0 && it.proximo !== null && it.proximo <= now + DAY / 2) {
          it.caja += 1;
          it.proximo = it.caja === 2 ? now + 3 * DAY : it.caja === 3 ? now + 7 * DAY : null;
          if (it.caja > 3) it.caja = 0;
        }
        set({ items: { ...get().items, [id]: it }, ultimo: id });
      },
      guardarBorrador: (id, programa, wb) => set({ borradores: { ...get().borradores, [id]: { programa, wb } } }),
      borrarBorrador: (id) => {
        const b = { ...get().borradores };
        delete b[id];
        set({ borradores: b });
      },
      guardarExamen: (r) => set({ examenes: [r, ...get().examenes].slice(0, 100) }),
      importar: (d) => set({ items: { ...get().items, ...(d.items ?? {}) }, examenes: d.examenes ?? get().examenes, borradores: { ...get().borradores, ...(d.borradores ?? {}) } }),
      reiniciar: () => set({ items: {}, examenes: [], borradores: {}, ultimo: null }),
    }),
    { name: 'automatizacion.v1.progress', version: 1 },
  ),
);

export function pendientes(items: Record<string, ProgItem>): string[] {
  const now = Date.now();
  return Object.entries(items).filter(([, v]) => v.proximo !== null && v.proximo <= now).map(([k]) => k);
}
