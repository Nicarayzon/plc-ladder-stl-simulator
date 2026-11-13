import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idioma } from '../i18n';
import { temaGuardado, type Theme } from '../ui/temas/paletas';
import { INTENSIDAD, TAMANO, type PapelId } from '../ui/temas/papeles';

export type { Theme };

export interface Settings {
  /** Tema básico (Temas ▸ Básicos): «system» o una paleta */
  theme: Theme;
  /** Papel de fondo (Temas ▸ Avanzado): '' = ninguno; 'propia' = la imagen del usuario (src/ui/temas/imagenPropia.ts) */
  papel: PapelId;
  /** Opacidad del papel, de 0,1 a 1 */
  papelIntensidad: number;
  /** Tamaño de los motivos, de 0,5 a 2 */
  papelTamano: number;
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
  /** Zoom del código AWL (letra del editor y lo que va con ella), de 0,8 a 1,8 (src/ui/workbench/zoomAwl.ts) */
  awlZoom: number;
  set: (p: Partial<Settings>) => void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      theme: 'system',
      papel: '',
      papelIntensidad: INTENSIDAD.defecto,
      papelTamano: TAMANO.defecto,
      // sin ajustes guardados (instalación nueva): la nemotecnia del idioma de la app; quien ya tenía ajustes conserva la suya
      nemotecnia: idioma === 'en' ? 'en' : 'de',
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
      awlZoom: 1,
      set: (p) => set(p),
    }),
    {
      name: 'automatizacion.v1.settings', version: 2, migrate: (st) => ({ ...(st as object), entradaClic: 'NA' }) as unknown as Settings,
      // un tema que ya no existe (Ámbar retro, quitado en la 0.30.0) no se queda a medias: pasa a Café
      merge: (guardado, actual) => {
        const g = (guardado ?? {}) as Partial<Settings>;
        return { ...actual, ...g, theme: temaGuardado(g.theme) };
      },
    },
  ),
);

export const getSettings = () => useSettings.getState();
