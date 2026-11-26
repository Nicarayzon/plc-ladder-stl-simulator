// Guía «Activar la marca de ciclo» (0.29.1): marca en la app, paso a paso, dónde pulsar para activar la marca de ciclo
// por el camino real (explorador ▸ Hardware ▸ CPU ▸ Ciclo/Marca de ciclo ▸ Aceptar ▸ Guardar y compilar ▸ Cargar en
// módulo). No lleva la cuenta de los clics: el paso sale del estado de la app (lo guardado y lo cargado en el programa y
// lo que la ventana del hardware tiene abierto), así que avanza solo, y retrocede si el usuario cierra algo antes de
// tiempo. Cada paso dice qué elementos señalar (atributo `data-guia`), por orden: se señala el primero que esté a la vista.
import { create } from 'zustand';
import { T } from '../../i18n';

/** Lo que la ventana del hardware cuenta de sí misma (HwConfig la va poniendo al día) */
export interface HwVisto {
  abierta: boolean;
  /** El borrador de la CPU tiene la marca de ciclo activa */
  borradorCiclo: boolean;
  /** Hay cambios sin guardar */
  sucio: boolean;
  /** Propiedades de la CPU abiertas: pestaña y lo que hay escrito en Ciclo/Marca de ciclo */
  props: null | { pestana: string; activa: boolean; byte: number };
}
export const HW_CERRADA: HwVisto = { abierta: false, borradorCiclo: false, sucio: false, props: null };

interface GuiaCiclo {
  activa: boolean;
  /** Byte que se propone (el que el programa consulta sin escribirlo nunca); sin él vale el que elija el usuario */
  sugerido?: number;
  hw: HwVisto;
  empezar: (sugerido?: number) => void;
  terminar: () => void;
  ponerHw: (h: Partial<HwVisto>) => void;
}

export const useGuiaCiclo = create<GuiaCiclo>((set) => ({
  activa: false,
  hw: HW_CERRADA,
  empezar: (sugerido) => set({ activa: true, sugerido }),
  terminar: () => set({ activa: false, sugerido: undefined }),
  ponerHw: (h) => set((s) => ({ hw: { ...s.hw, ...h } })),
}));

/** Elementos que la guía puede señalar: cada uno lleva `data-guia="…"` en la interfaz */
export type Objetivo =
  | 'hw-fila' | 'equipo' | 'proyecto' | 'abrir-proyectos'
  | 'cpu-fila' | 'tab-ciclo' | 'check-ciclo' | 'byte-ciclo' | 'aceptar' | 'guardar' | 'cargar' | 'estado-hw';

export const TOTAL_PASOS = 7;

export interface PasoGuia {
  /** 1–7; `TOTAL_PASOS + 1` = hecho */
  n: number;
  /** Lo que se señala, por orden de preferencia, con su texto */
  objetivos: { id: Objetivo; texto: string }[];
}

export interface EstadoGuia {
  /** Byte de la marca de ciclo guardado (null = sin marca de ciclo) */
  guardado: number | null;
  /** Byte de la marca de ciclo cargado en la CPU */
  cargado: number | null;
  /** Lo guardado no es lo que hay cargado */
  sinCargar: boolean;
  hw: HwVisto;
  sugerido?: number;
}

/** El Hardware del explorador y, si no se ve, lo que hay que abrir antes para verlo */
const enExplorador = (texto: string): PasoGuia['objetivos'] => [
  { id: 'hw-fila', texto },
  { id: 'equipo', texto: T.guia.equipo },
  { id: 'proyecto', texto: T.guia.proyecto },
  { id: 'abrir-proyectos', texto: T.guia.explorador },
];

export function pasoGuia({ guardado, cargado, sinCargar, hw, sugerido }: EstadoGuia): PasoGuia {
  // hecho: cargada en la CPU (y, si se propuso un byte, en ese: con otro, el programa seguiría sin su intermitente)
  // (con la ventana abierta, junto a su franja, que dice «En la CPU: marca de ciclo MB n»; si no, junto al Hardware del explorador)
  if (cargado !== null && !sinCargar && !hw.sucio && (sugerido === undefined || cargado === sugerido)) {
    const texto = T.guia.listo(cargado);
    return { n: TOTAL_PASOS + 1, objetivos: hw.abierta ? [{ id: 'estado-hw', texto }, { id: 'hw-fila', texto }] : [{ id: 'hw-fila', texto }] };
  }
  if (hw.abierta && hw.props) {
    const { pestana, activa, byte } = hw.props;
    if (pestana !== 'ciclo') return { n: 3, objetivos: [{ id: 'tab-ciclo', texto: T.guia.pestana }] };
    if (!activa) return { n: 4, objetivos: [{ id: 'check-ciclo', texto: T.guia.casilla }] };
    if (sugerido !== undefined && byte !== sugerido) return { n: 5, objetivos: [{ id: 'byte-ciclo', texto: T.guia.byte(sugerido) }] };
    return { n: 5, objetivos: [{ id: 'aceptar', texto: T.guia.aceptar(byte) }] };
  }
  if (hw.abierta) {
    if (hw.sucio && hw.borradorCiclo) return { n: 6, objetivos: [{ id: 'guardar', texto: T.guia.guardar }] };
    if (!hw.sucio && guardado !== null && sinCargar) return { n: 7, objetivos: [{ id: 'cargar', texto: T.guia.cargar }] };
    return { n: 2, objetivos: [{ id: 'cpu-fila', texto: T.guia.cpu }] };
  }
  if (guardado !== null && sinCargar) return { n: 7, objetivos: enExplorador(T.guia.reabrir) };
  return { n: 1, objetivos: enExplorador(T.guia.hwFila) };
}
