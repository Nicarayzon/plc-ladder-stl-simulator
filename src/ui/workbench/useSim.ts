import { useEffect, useReducer, useRef } from 'react';
import type { SimController } from '../../sim/SimController';

/** Lo que enseña un componente, en barato: un número, un texto o una lista corta de valores. */
export type Firma = string | number | boolean | null | readonly unknown[];

function igual(a: Firma | undefined, b: Firma | undefined): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
    return true;
  }
  return Object.is(a, b);
}

/**
 * Vuelve a pintar el componente cuando cambia el simulador, como mucho `hz` veces por segundo.
 * Con `firma`, solo si ha cambiado lo que el componente enseña: si la firma es la misma que
 * en el último render, React no hace nada y el navegador no tiene que volver a dibujar.
 *
 * Todos los paneles miran a la vez: el tiempo se parte en franjas de 1/hz s contadas desde el mismo
 * origen, y cada panel mira en el primer aviso del simulador de cada franja. Así los cambios de
 * varios paneles caen en el mismo aviso, React los junta y la pantalla se dibuja una vez, no una por
 * panel.
 */
export function useSimTick(sim: SimController, hz = 15, firma?: () => Firma) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const firmaRef = useRef(firma);
  firmaRef.current = firma;
  // firma de lo que se pinta en este render (también cuando el render viene de fuera)
  const pintada = useRef<Firma | undefined>(undefined);
  pintada.current = firma ? firma() : undefined;
  useEffect(() => {
    const gap = 1000 / hz;
    let franja = -1;
    let timer: number | undefined;
    const check = () => {
      const f = firmaRef.current;
      if (f) {
        const v = f();
        if (igual(v, pintada.current)) return;
        pintada.current = v;
      }
      force();
    };
    const fn = () => {
      const now = performance.now();
      const n = Math.floor(now / gap);
      if (n !== franja) {
        franja = n;
        if (timer !== undefined) { clearTimeout(timer); timer = undefined; }
        check();
      } else if (timer === undefined) {
        // por si no llegan más avisos en un rato (STOP, pausa): mirar otra vez pasada esta franja;
        // con la simulación en marcha el siguiente aviso llega antes y lo cancela
        timer = window.setTimeout(() => {
          timer = undefined;
          franja = Math.floor(performance.now() / gap);
          check();
        }, (n + 1) * gap - now + 30);
      }
    };
    const un = sim.subscribe(fn);
    return () => {
      un();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [sim, hz]);
}
