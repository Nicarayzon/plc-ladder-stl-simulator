// Bloques de biblioteca: funciones ya hechas que el alumno copia a su proyecto desde la «Biblioteca estándar»
// (ventana de la biblioteca, o el catálogo del KOP). En el proyecto son un bloque más, protegido: no tienen
// segmentos y la CPU los ejecuta directamente. Se llaman con CALL y sus parámetros:
//
//       CALL  FC 82
//         S_BIT := M 0.0      // primer bit
//         N     := 8          // cuántos bits
//
// FC 82 (RSET) pone a 0 los N bits consecutivos que empiezan en S_BIT, y FC 83 (SSET) los pone a 1. Los dos
// dependen del MCR: dentro de una zona MCR desactivada no cambian nada.

export type LibId = 'RSET' | 'SSET';

export interface LibParam {
  nombre: string;
  /** POINTER: dirección de un bit (`M 0.0` o `P#M 0.0`). INT: constante entera o palabra (MW, DBW…). */
  tipo: 'POINTER' | 'INT';
}

export interface LibDef {
  id: LibId;
  /** Nombre del bloque en el proyecto (FC82) */
  bloque: string;
  /** Número del bloque (82) */
  numero: number;
  params: LibParam[];
  /** Valor que escribe en los bits del rango */
  valor: 0 | 1;
}

const PARAMS_RANGO: LibParam[] = [{ nombre: 'S_BIT', tipo: 'POINTER' }, { nombre: 'N', tipo: 'INT' }];

export const BIBLIOTECA: Record<LibId, LibDef> = {
  RSET: { id: 'RSET', bloque: 'FC82', numero: 82, params: PARAMS_RANGO, valor: 0 },
  SSET: { id: 'SSET', bloque: 'FC83', numero: 83, params: PARAMS_RANGO, valor: 1 },
};

export const LIB_IDS = Object.keys(BIBLIOTECA) as LibId[];

export const esLibId = (v: unknown): v is LibId => typeof v === 'string' && (LIB_IDS as string[]).includes(v);

/** Bloque de biblioteca que lleva este nombre en la biblioteca (FC82 → RSET), si hay alguno. */
export function libPorBloque(nombre: string): LibDef | undefined {
  return LIB_IDS.map((id) => BIBLIOTECA[id]).find((d) => d.bloque === nombre);
}

/** «FC82» → «FC 82» (como se escribe en el AWL). */
export const conEspacio = (bloque: string) => bloque.replace(/^([A-Z]+)(\d+)$/, '$1 $2');

/** Líneas AWL de una llamada con sus parámetros vacíos, como las pone el editor al escribir `CALL FC 82`. */
export function lineasParametros(def: LibDef, sangria: string): string[] {
  const ancho = Math.max(...def.params.map((p) => p.nombre.length));
  return def.params.map((p) => `${sangria}${p.nombre.padEnd(ancho)} := `);
}
