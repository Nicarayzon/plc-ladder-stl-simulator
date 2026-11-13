// Zoom del código AWL (Ajustes ▸ Zoom del AWL), como el del KOP: agranda la letra del editor AWL y lo que va con ella
// (números de línea, valores en vivo, puntos de parada y, a la mitad de ritmo, las columnas de «Observar» y su cabecera).
// Se pone como variable CSS en <html> (--awl-zoom) y el CSS del editor multiplica sus tamaños por ella.

/** Hasta 180 %: más allá, con «Observar» y el panel de E/S, al código le queda muy poco ancho */
export const ZOOM_AWL = { min: 0.8, max: 1.8, paso: 0.1, defecto: 1 } as const;
/** Tamaño de la letra del editor AWL sin zoom, en px */
export const LETRA_AWL = 13;

/** Zoom válido a partir de lo guardado: dentro de los límites y en pasos de 0,1; lo que no es un número, el de por defecto */
export const limitarZoomAwl = (z: unknown): number => {
  const n = typeof z === 'number' && Number.isFinite(z) ? z : ZOOM_AWL.defecto;
  return Math.round(Math.min(ZOOM_AWL.max, Math.max(ZOOM_AWL.min, n)) * 10) / 10;
};

/** Pone el zoom en <html> (variable --awl-zoom) */
export function aplicarZoomAwl(doc: Document, z: unknown): void {
  doc.documentElement.style.setProperty('--awl-zoom', String(limitarZoomAwl(z)));
}
