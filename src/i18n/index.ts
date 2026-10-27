// Idioma de la interfaz. Se elige al arrancar y no cambia hasta reiniciar la app: así los textos
// se pueden leer en cualquier sitio (también en constantes de módulo) con `T.zona.clave`.
// El motor (src/core) solo usa T para sus mensajes: la lógica no depende del idioma.
import { es, type Textos } from './es';
import { en } from './en';
import { de } from './de';

export type { Textos };
export type Idioma = 'es' | 'en' | 'de';

/** Idiomas con traducción completa, en el orden del selector. Tiene que coincidir con DISPONIBLES de electron/idioma.cjs */
export const IDIOMAS: { id: Idioma; nombre: string }[] = [
  { id: 'es', nombre: 'Español' },
  { id: 'en', nombre: 'English' },
  { id: 'de', nombre: 'Deutsch' },
];

const DICCIONARIOS: Partial<Record<Idioma, Textos>> = { es, en, de };

/** Lo que expone electron/preload.cjs */
export interface PuenteApp {
  idioma: Idioma;
  /** Primer arranque con idiomas: hay que avisar de que se puede cambiar */
  bienvenida: boolean;
  guardarIdioma: (i: Idioma) => Promise<boolean>;
  reiniciar: () => void;
}

/** null fuera de Electron (servidor de desarrollo, pruebas, la web) */
export const puente: PuenteApp | null = (globalThis as { automatizacionApp?: PuenteApp }).automatizacionApp ?? null;

/** Sin Electron (servidor de desarrollo de Vite), el idioma se guarda en el navegador */
export const CLAVE_IDIOMA_WEB = 'automatizacion-idioma';

const disponible = (i: unknown): i is Idioma => IDIOMAS.some((x) => x.id === i);

function inicial(): Idioma {
  if (puente && disponible(puente.idioma)) return puente.idioma;
  // solo en un navegador: en Node (pruebas, scripts de la web) localStorage avisa o no existe
  if (typeof window !== 'undefined') {
    try {
      const i = window.localStorage.getItem(CLAVE_IDIOMA_WEB);
      if (disponible(i)) return i;
    } catch { /* sin almacenamiento */ }
  }
  return 'es';
}

export let idioma: Idioma = inicial();
export let T: Textos = DICCIONARIOS[idioma] ?? es;

/** Los textos de un idioma concreto (el aviso de reinicio se enseña ya en el idioma elegido) */
export const textosDe = (i: Idioma): Textos => DICCIONARIOS[i] ?? es;

/** Solo para scripts y pruebas: en la app, el idioma cambia al reiniciar */
export function ponerIdioma(i: Idioma): void {
  idioma = DICCIONARIOS[i] ? i : 'es';
  T = textosDe(idioma);
}
