// Guía «Abrir la tabla de variables» (0.29.1): señala, paso a paso, dónde se crea y se abre la tabla de variables y cómo
// se ven los valores en vivo: clic derecho en Bloques ▸ Insertar nuevo objeto ▸ Tabla de variables ▸ gafas (Observar
// variable) ▸ un operando. Como la de la marca de ciclo (guiaCicloEstado.ts), no cuenta clics: el paso sale de lo que hay
// en pantalla (un menú abierto, la tabla abierta, las gafas pulsadas…), que GuiaVat.tsx lee de los atributos `data-guia`.
// Solo hay una guía a la vez: al empezar una se cierra la otra.
import { create } from 'zustand';
import { T } from '../../i18n';
import { useGuiaCiclo } from './guiaCicloEstado';

interface GuiaVat {
  activa: boolean;
  empezar: () => void;
  terminar: () => void;
}

export const useGuiaVat = create<GuiaVat>((set) => ({
  activa: false,
  empezar: () => { useGuiaCiclo.getState().terminar(); set({ activa: true }); },
  terminar: () => set({ activa: false }),
}));
// si empieza la de la marca de ciclo, se cierra esta
useGuiaCiclo.subscribe((s, antes) => { if (s.activa && !antes.activa) useGuiaVat.getState().terminar(); });

export type ObjetivoVat =
  | 'bloques' | 'proyecto' | 'abrir-proyectos' | 'vat-fila'
  | 'insertar-objeto' | 'nueva-vat' | 'vat-gafas' | 'vat-operando' | 'vat-tabla';

export const TOTAL_PASOS_VAT = 5;

export interface EstadoVat {
  /** La tabla de variables que se ve (flotante o abajo); null si no hay ninguna abierta a la vista */
  tabla: null | {
    nombre: string;
    /** Se ve la cuadrícula (en la ventana flotante no sale hasta pulsar las gafas la primera vez) */
    visible: boolean;
    observando: boolean;
    /** Alguna fila tiene operando */
    conOperando: boolean;
  };
  /** Hay un menú abierto con «Insertar nuevo objeto» */
  menuInsertar: boolean;
  /** Está abierto el submenú con «Tabla de variables» */
  menuVat: boolean;
  /** La primera tabla del proyecto, si ya tiene alguna */
  existente?: string;
}

export interface PasoGuiaVat {
  /** 1–5; `TOTAL_PASOS_VAT + 1` = hecho */
  n: number;
  objetivos: { id: ObjetivoVat; texto: string }[];
}

export function pasoGuiaVat({ tabla, menuInsertar, menuVat, existente }: EstadoVat): PasoGuiaVat {
  if (tabla) {
    if (tabla.visible && tabla.observando && tabla.conOperando) return { n: TOTAL_PASOS_VAT + 1, objetivos: [{ id: 'vat-tabla', texto: T.guiaVat.listo(tabla.nombre) }] };
    if (!tabla.visible || !tabla.observando) return { n: 4, objetivos: [{ id: 'vat-gafas', texto: T.guiaVat.gafas }] };
    return { n: 5, objetivos: [{ id: 'vat-operando', texto: T.guiaVat.operando }] };
  }
  if (menuVat) return { n: 3, objetivos: [{ id: 'nueva-vat', texto: T.guiaVat.nueva }] };
  if (menuInsertar) return { n: 2, objetivos: [{ id: 'insertar-objeto', texto: T.guiaVat.insertar }] };
  // en el explorador; si no se ve lo que hay que pulsar, lo que hay que abrir antes
  const antes = [
    { id: 'proyecto' as const, texto: T.guia.proyecto },
    { id: 'abrir-proyectos' as const, texto: T.guia.explorador },
  ];
  if (existente) return { n: 3, objetivos: [{ id: 'vat-fila', texto: T.guiaVat.abrir(existente) }, { id: 'bloques', texto: T.guiaVat.desplegar(existente) }, ...antes] };
  return { n: 1, objetivos: [{ id: 'bloques', texto: T.guiaVat.bloques }, ...antes] };
}
