import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'system' | 'dark' | 'light';

export interface Settings {
  theme: Theme;
  nemotecnia: 'de' | 'en';
  cycleMs: number;
  retentiveMBytes: number;
  retentiveCounters: number;
  retentiveTimers: number;
  randomLocals: boolean;
  /** Columnas extra de «Observar» en AWL */
  observeExtra: boolean;
  observeHex: boolean;
  /** Mostrar símbolos en lugar de direcciones absolutas */
  simbolica: boolean;
  /** Teclas 1–8 → bits 0–7 del primer byte de entradas */
  teclasEntradas: boolean;
  /** Qué hace un clic en una entrada sin tipo propio: pulsador (1 mientras se pulsa) o interruptor (se queda) */
  entradaClic: 'NA' | 'INT';
  kopZoom: number;
  set: (p: Partial<Settings>) => void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      theme: 'system',
      nemotecnia: 'de',
      cycleMs: 10,
      retentiveMBytes: 16,
      retentiveCounters: 8,
      retentiveTimers: 0,
      randomLocals: false,
      observeExtra: false,
      observeHex: false,
      simbolica: false,
      teclasEntradas: true,
      entradaClic: 'NA',
      kopZoom: 1,
      set: (p) => set(p),
    }),
    { name: 'automatizacion.v1.settings', version: 2, migrate: (st) => ({ ...(st as object), entradaClic: 'NA' }) as unknown as Settings },
  ),
);

export const getSettings = () => useSettings.getState();
