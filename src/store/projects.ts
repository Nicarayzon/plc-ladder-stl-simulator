import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Programa } from '../core/program';
import { emptyProgram, migrarHw } from '../core/program';
import { emptyWbState, migrarVat, type WbState } from '../ui/workbench/types';
import { demoAntiguo } from './legacyDemo';

const DEMO_NOMBRE = 'Ejemplo: marcha y paro';
const DEMO_SIMBOLOS = ['Marcha', 'Paro', 'Motor', 'Piloto'];

/** Migración v1 → v2: quita el programa de ejemplo (Marcha/Paro/Motor/Piloto) de versiones anteriores. */
export function quitarDemo(st: { proyectos: Proyecto[]; actual: string | null }) {
  const demo = JSON.stringify(demoAntiguo());
  const proyectos: Proyecto[] = [];
  for (const p of st.proyectos ?? []) {
    if (JSON.stringify(p.programa) === demo) continue; // el ejemplo sin tocar: se borra
    if (p.nombre === DEMO_NOMBRE) {
      // el alumno lo usó para su código: se conserva, sin los símbolos de ejemplo que ya no use
      const texto = JSON.stringify(p.programa.bloques);
      const simbolos = p.programa.simbolos.filter((x) => !(DEMO_SIMBOLOS.includes(x.nombre) && !texto.includes(`\\"${x.nombre}\\"`) && !texto.includes(`"${x.nombre}"`)));
      const inputs = (p.wb?.inputs ?? []).filter(([k, t]) => !((k === 'E0.0' && t === 'NA') || (k === 'E0.1' && t === 'NC')));
      proyectos.push({ ...p, nombre: 'Programa 1', programa: { ...p.programa, simbolos }, wb: { ...(p.wb ?? emptyWbState()), inputs } });
      continue;
    }
    proyectos.push(p);
  }
  const actual = proyectos.some((p) => p.id === st.actual) ? st.actual : proyectos[0]?.id ?? null;
  return { ...st, proyectos, actual };
}

/** Migraciones de los proyectos guardados: v2 quita el ejemplo antiguo, v3 pasa la pestaña «Variables» a la VAT_1, v4 renombra la CPU del hardware. */
export function migrarProyectos(st: { proyectos: Proyecto[]; actual: string | null }, version: number) {
  let r = version < 2 ? quitarDemo(st) : st;
  if (version < 3) r = { ...r, proyectos: (r.proyectos ?? []).map((p) => ({ ...p, wb: migrarVat(p.wb ?? emptyWbState()) })) };
  if (version < 4) r = { ...r, proyectos: (r.proyectos ?? []).map((p) => (p.programa ? { ...p, programa: migrarHw(p.programa) } : p)) };
  return r;
}

export interface Proyecto {
  id: string;
  nombre: string;
  programa: Programa;
  wb: WbState;
  actualizado: number;
}

interface ProjectsState {
  proyectos: Proyecto[];
  actual: string | null;
  crear: (nombre: string, programa?: Programa, wb?: WbState) => string;
  actualizar: (id: string, p: Partial<Proyecto>) => void;
  borrar: (id: string) => void;
  setActual: (id: string) => void;
}

const nid = () => `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

export const useProjects = create<ProjectsState>()(
  persist(
    (set, get) => ({
      proyectos: [],
      actual: null,
      crear: (nombre, programa, wb) => {
        const id = nid();
        const p: Proyecto = { id, nombre, programa: programa ?? emptyProgram(), wb: wb ?? emptyWbState(), actualizado: Date.now() };
        set({ proyectos: [...get().proyectos, p], actual: id });
        return id;
      },
      actualizar: (id, patch) => set({ proyectos: get().proyectos.map((p) => (p.id === id ? { ...p, ...patch, actualizado: Date.now() } : p)) }),
      borrar: (id) => {
        const rest = get().proyectos.filter((p) => p.id !== id);
        set({ proyectos: rest, actual: get().actual === id ? rest[0]?.id ?? null : get().actual });
      },
      setActual: (id) => set({ actual: id }),
    }),
    { name: 'automatizacion.v1.projects', version: 4, migrate: (st, v) => migrarProyectos(st as { proyectos: Proyecto[]; actual: string | null }, v) as unknown as ProjectsState },
  ),
);
