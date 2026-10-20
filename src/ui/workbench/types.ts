import type { Formato } from '../../core/format';
import type { SignalView } from '../../sim/analyzer';
import type { InputTipo } from '../../sim/SimController';

export interface VatFila { text: string; fmt: Formato }

/** Tabla de variables del proyecto (VAT_1…) */
export interface VatTabla { nombre: string; filas: VatFila[] }

/** Estado del banco de trabajo que se guarda con el proyecto */
export interface WbState {
  /** Pestaña «Variables» de la derecha (Probar y ejercicios). En el simulador libre van en `vats`. */
  vat: VatFila[];
  vats?: VatTabla[];
  signals: { text: string; view: SignalView }[];
  inputs: [string, InputTipo][];
  /** Entradas/salidas quitadas del panel con clic derecho */
  hidden?: string[];
  /** Entradas añadidas a mano al panel */
  extra?: string[];
}

export const emptyWbState = (): WbState => ({ vat: [], signals: [], inputs: [] });

/** Proyectos de antes de la 0.15.0: las filas de la pestaña «Variables» pasan a la VAT_1. */
export function migrarVat(wb: WbState): WbState {
  if (wb.vats || !wb.vat?.length) return wb;
  return { ...wb, vat: [], vats: [{ nombre: 'VAT_1', filas: wb.vat }] };
}

/** Primer nombre libre: VAT_1, VAT_2… */
export function nextVat(wb: WbState): string {
  const usados = new Set((wb.vats ?? []).map((v) => v.nombre.toUpperCase()));
  for (let i = 1; ; i++) if (!usados.has(`VAT_${i}`)) return `VAT_${i}`;
}
