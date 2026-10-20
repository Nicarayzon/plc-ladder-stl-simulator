// Identificadores de elementos KOP
import type { Elem, Rama, Salida, SegmentoKOP } from './model';

let counter = 0;
const session = Math.floor(Math.random() * 36 ** 3).toString(36);

/** Id nuevo, único dentro de la sesión (para elementos creados en el editor). */
export function newId(prefix = 'k'): string {
  counter += 1;
  return `${prefix}${session}${counter.toString(36)}`;
}

/** Asigna ids deterministas a todo el segmento (para los modelos de los ejercicios). */
export function assignIds(seg: SegmentoKOP, prefix: string): SegmentoKOP {
  let n = 0;
  const id = () => `${prefix}.${++n}`;
  const elem = (e: Elem | undefined) => {
    if (!e) return;
    (e as { id: string }).id = id();
    if (e.k === 'SER') e.items.forEach(elem);
    else if (e.k === 'PAR') e.ramas.forEach(elem);
  };
  const ramas = (rs: Rama[] | undefined) => rs?.forEach((r) => { elem(r.pre); sal(r.salida); });
  const sal = (s: Salida) => {
    (s as { id: string }).id = id();
    if (s.k === 'TEMP') { elem(s.pinR); ramas(s.q); } else if (s.k === 'CONT') { elem(s.pinZR); elem(s.pinS); elem(s.pinR); ramas(s.q); } else if (s.k === 'BIEST') { elem(s.pin2); ramas(s.q); } else if (s.k === 'BOX') ramas(s.eno);
  };
  seg.id = prefix;
  elem(seg.entrada);
  ramas(seg.salidas);
  return seg;
}

/** Copia profunda con ids nuevos (duplicar, pegar). */
export function reId<T>(x: T): T {
  const c = structuredClone(x) as unknown;
  const walk = (o: unknown) => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === 'object') {
      const r = o as Record<string, unknown>;
      if (typeof r.id === 'string' && typeof r.k === 'string') r.id = newId();
      Object.values(r).forEach(walk);
    }
  };
  walk(c);
  return c as T;
}
