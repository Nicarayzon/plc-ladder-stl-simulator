// Hardware del proyecto: el equipo con su bastidor (fuente, CPU compacta y sus E/S integradas).
import type { HwEstacion, Programa } from './program';

/** CPU nueva del bastidor: sin marca de ciclo (hay que activarla en sus propiedades) y con el byte 0 propuesto. */
export function nuevaEstacion(n: number): HwEstacion {
  return { id: `hw${Date.now().toString(36)}${n}`, tipo: 'CPU', nombre: `CPU(${n})`, marcaCiclo: { activa: false, byte: 0 } };
}

/** Hardware guardado del proyecto, con la CPU en el bastidor aunque el proyecto aún no tenga hardware. */
export function hwDe(p: Programa): { estaciones: HwEstacion[] } {
  return p.hw?.estaciones.length ? p.hw : { estaciones: [nuevaEstacion(1)] };
}

/** Bytes de marcas que puede usar la marca de ciclo */
export const MAX_BYTE_MARCAS = 2047;
