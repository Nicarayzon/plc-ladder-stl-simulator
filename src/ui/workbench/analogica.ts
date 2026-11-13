// Analógicas en voltios, para el indicador de 0 a 10 V de las salidas analógicas (PAW) del panel de E/S.
// Regla de tres que pidió el usuario: 0 = 0 V y 27712 = 10 V. El deslizador de las PEW sigue llegando a 32767:
// por encima de 27712 la tensión pasa de 10 V (fuera de escala) y la aguja se queda al final.

/** Valor de una palabra analógica que equivale a 10 V */
export const VALOR_10V = 27712;
/** Máximo del deslizador de las PEW */
export const PEW_MAX = 32767;
/** Final de la escala del indicador, en voltios */
export const V_MAX = 10;

/** Salida analógica (PAW n): las que llevan indicador. Las AW son la imagen de las salidas digitales. */
export const esPaw = (addr: string): boolean => addr.startsWith('PAW ');

/** Tensión de una palabra analógica a partir de su valor (con signo) */
export const voltios = (valor: number): number => (valor * V_MAX) / VALOR_10V;

/** Fracción de la escala (de 0 a 1) donde queda la aguja: fuera del rango se queda en el extremo */
export const fraccionEscala = (v: number): number => Math.min(1, Math.max(0, v / V_MAX));

/** Fuera del rango del indicador (más de 10 V o menos de 0 V) */
export const fueraDeEscala = (v: number): boolean => v > V_MAX || v < 0;

const numero = (addr: string) => parseInt(addr.slice(addr.indexOf(' ') + 1), 10);

/**
 * Cada PAW con su PEW, para enseñar la entrada justo debajo del indicador de la salida:
 * primero la del mismo número (PAW 256 ↔ PEW 256, como en un módulo analógico) y luego las que queden, por orden.
 * Las PEW sin PAW quedan sueltas (van debajo de «Analógicas y palabras», como siempre).
 */
export function emparejar(pews: readonly string[], paws: readonly string[]): { pares: { paw: string; pew: string | null }[]; sueltas: string[] } {
  const libres = [...pews].sort((a, b) => numero(a) - numero(b));
  const pares = [...paws].sort((a, b) => numero(a) - numero(b)).map((paw) => {
    const i = libres.findIndex((p) => numero(p) === numero(paw));
    return { paw, pew: i >= 0 ? libres.splice(i, 1)[0] : null };
  });
  for (const par of pares) if (!par.pew && libres.length) par.pew = libres.shift()!;
  return { pares, sueltas: libres };
}
