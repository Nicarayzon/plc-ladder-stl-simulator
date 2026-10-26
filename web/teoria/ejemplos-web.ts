// Ejemplos que solo están en la web, para temas que el banco de ejemplos de la app no cubre. Por ejemplo, la
// marca de ciclo: el intérprete de referencia, que comprueba el banco, no la simula. Cada ejemplo trae su modelo
// KOP, su código AWL y sus textos en cada idioma; la página los muestra igual que los del banco.
import { bob, cont, na, nc, not, par, r, s, seg, segs } from '../../src/kop/build';
import type { SegmentoKOP } from '../../src/kop/model';
import type { OperandoVivo } from '../../scripts/web/vivo-datos';
import type { PorIdioma } from './paginas';

export interface EjemploWeb {
  titulo: PorIdioma;
  /** Markdown */
  enunciado: PorIdioma;
  /** Código con los comentarios de cada idioma, siempre con la nemotécnica alemana (en inglés la traduce el generador) */
  awl: PorIdioma;
  kop: SegmentoKOP[];
  /** Byte de la marca de ciclo, si el ejemplo la usa */
  marcaCiclo?: number;
  entradas: OperandoVivo[];
  salidas: OperandoVivo[];
}

export const EJEMPLOS_WEB: Record<string, EjemploWeb> = {
  'intro-primero': {
    titulo: { es: 'Tu primer programa: un interruptor enciende un piloto', en: 'Your first program: a switch turns on a lamp', de: 'Dein erstes Programm: Ein Schalter schaltet eine Leuchte ein' },
    enunciado: {
      es: 'el piloto A4.0 se enciende mientras el interruptor E0.0 está a 1. Es el programa más sencillo posible: un contacto NA y una bobina. Activa E0.0 y fíjate en cómo pasa la corriente por el esquema, de izquierda a derecha.',
      en: 'the lamp Q4.0 is on while the switch I0.0 is at 1. It is the simplest possible program: a normally open contact and a coil. Switch on I0.0 and watch how the power flows through the diagram, from left to right.',
      de: 'Die Leuchte A4.0 leuchtet, solange der Schalter E0.0 auf 1 steht. Es ist das einfachste mögliche Programm: ein Schließer und eine Spule. Schalte E0.0 ein und beobachte, wie der Strom von links nach rechts durch das Netzwerk fließt.',
    },
    awl: {
      es: `      U     E 0.0           // si el interruptor está a 1…
      =     A 4.0           // …se enciende el piloto`,
      en: `      U     E 0.0           // if the switch is at 1…
      =     A 4.0           // …the lamp turns on`,
      de: `      U     E 0.0           // wenn der Schalter auf 1 steht…
      =     A 4.0           // …leuchtet die Leuchte`,
    },
    kop: segs('intro-primero', [seg({ entrada: [na('E 0.0')], salidas: [bob('A 4.0')] })]),
    entradas: [{ op: 'E 0.0', tipo: 'BOOL', valor: '0' }],
    salidas: [],
  },
  'mc-intermitente': {
    titulo: { es: 'Piloto intermitente con la marca de ciclo', en: 'Flashing lamp with the clock memory', de: 'Blinkleuchte mit dem Taktmerker' },
    enunciado: {
      es: 'mientras la alarma E0.0 esté activa, el piloto A4.0 parpadea a 1 Hz. La marca de ciclo está en MB100, así que se usa `M 100.5` (periodo de 1 s).',
      en: 'while the alarm I0.0 is active, the lamp Q4.0 flashes at 1 Hz. The clock memory is in MB100, so `M 100.5` (period of 1 s) is used.',
      de: 'Solange der Alarm E0.0 ansteht, blinkt die Leuchte A4.0 mit 1 Hz. Der Taktmerker liegt in MB100, deshalb wird `M 100.5` (Periodendauer 1 s) verwendet.',
    },
    awl: {
      es: `      U     E 0.0           // alarma activa
      U     M 100.5         // marca de ciclo: 1 Hz
      =     A 4.0           // piloto intermitente`,
      en: `      U     E 0.0           // alarm active
      U     M 100.5         // clock memory: 1 Hz
      =     A 4.0           // flashing lamp`,
      de: `      U     E 0.0           // Alarm steht an
      U     M 100.5         // Taktmerker: 1 Hz
      =     A 4.0           // Blinkleuchte`,
    },
    kop: segs('mc-intermitente', [seg({ entrada: [na('E 0.0'), na('M 100.5')], salidas: [bob('A 4.0')] })]),
    marcaCiclo: 100,
    entradas: [{ op: 'E 0.0', tipo: 'BOOL', valor: '0' }],
    salidas: [{ op: 'M 100.5', tipo: 'BOOL', valor: '0' }],
  },
  'mc-segundos': {
    titulo: { es: 'Contar segundos con la marca de ciclo', en: 'Counting seconds with the clock memory', de: 'Sekunden zählen mit dem Taktmerker' },
    enunciado: {
      es: 'mientras E0.3 = 1, el contador Z2 suma 1 en cada flanco positivo de `M 100.5`, es decir, una vez por segundo. E0.4 lo pone a cero y MW40 guarda los segundos contados. Fíjate en que el primer segundo puede contarse enseguida: depende de en qué punto de su periodo esté `M 100.5` al activar E0.3.',
      en: 'while I0.3 = 1, counter C2 adds 1 on each rising edge of `M 100.5`, that is, once per second. I0.4 resets it and MW40 holds the seconds counted. Note that the first second may be counted straight away: it depends on where `M 100.5` is in its period when I0.3 turns on.',
      de: 'Solange E0.3 = 1 ist, zählt Z2 bei jeder steigenden Flanke von `M 100.5` um 1 hoch, also einmal pro Sekunde. E0.4 setzt ihn zurück, und MW40 enthält die gezählten Sekunden. Die erste Sekunde kann sofort gezählt werden: Das hängt davon ab, an welcher Stelle seiner Periode `M 100.5` steht, wenn E0.3 eingeschaltet wird.',
    },
    awl: {
      es: `      U     E 0.3           // contar mientras E0.3 = 1
      U     M 100.5         // un flanco positivo por segundo
      ZV    Z 2
      U     E 0.4           // puesta a cero
      R     Z 2
      L     Z 2
      T     MW 40           // segundos contados`,
      en: `      U     E 0.3           // count while I0.3 = 1
      U     M 100.5         // one rising edge per second
      ZV    Z 2
      U     E 0.4           // reset
      R     Z 2
      L     Z 2
      T     MW 40           // seconds counted`,
      de: `      U     E 0.3           // zählen, solange E0.3 = 1
      U     M 100.5         // eine steigende Flanke pro Sekunde
      ZV    Z 2
      U     E 0.4           // zurücksetzen
      R     Z 2
      L     Z 2
      T     MW 40           // gezählte Sekunden`,
    },
    kop: segs('mc-segundos', [seg({
      entrada: [na('E 0.3'), na('M 100.5')],
      salidas: [cont('Z_VORW', 'Z 2', { pinR: na('E 0.4'), dual: 'MW 40' })],
    })]),
    marcaCiclo: 100,
    entradas: [{ op: 'E 0.3', tipo: 'BOOL', valor: '0' }, { op: 'E 0.4', tipo: 'BOOL', valor: '0' }],
    salidas: [{ op: 'M 100.5', tipo: 'BOOL', valor: '0' }, { op: 'MW 40', tipo: 'INT', valor: '0' }],
  },
};

/**
 * Ejemplos pequeños que van dentro del texto de la teoría, justo después de explicar cada contacto o instrucción.
 * En el Markdown se ponen con «<!-- probar: id -->»: el esquema KOP, el panel «Pruébalo» y el código AWL.
 */
export type Mini = Omit<EjemploWeb, 'titulo' | 'enunciado'>;

const e = (op: string): OperandoVivo => ({ op, tipo: 'BOOL', valor: '0' });

export const MINIS: Record<string, Mini> = {
  na: {
    kop: segs('mini-na', [seg({ entrada: [na('E 0.0')], salidas: [bob('A 4.0')] })]),
    awl: {
      es: `      U     E 0.0           // ¿E0.0 vale 1?
      =     A 4.0           // el resultado, a la salida`,
      en: `      U     E 0.0           // is I0.0 at 1?
      =     A 4.0           // the result, to the output`,
      de: `      U     E 0.0           // ist E0.0 gleich 1?
      =     A 4.0           // das Ergebnis an den Ausgang`,
    },
    entradas: [e('E 0.0')], salidas: [],
  },
  nc: {
    kop: segs('mini-nc', [seg({ entrada: [nc('E 0.0')], salidas: [bob('A 4.0')] })]),
    awl: {
      es: `      UN    E 0.0           // ¿E0.0 vale 0?
      =     A 4.0`,
      en: `      UN    E 0.0           // is I0.0 at 0?
      =     A 4.0`,
      de: `      UN    E 0.0           // ist E0.0 gleich 0?
      =     A 4.0`,
    },
    entradas: [e('E 0.0')], salidas: [],
  },
  y: {
    kop: segs('mini-y', [seg({ entrada: [na('E 0.0'), na('E 0.1')], salidas: [bob('A 4.0')] })]),
    awl: {
      es: `      U     E 0.0
      U     E 0.1           // y además E0.1
      =     A 4.0           // A4.0 = E0.0 ∧ E0.1`,
      en: `      U     E 0.0
      U     E 0.1           // and also I0.1
      =     A 4.0           // Q4.0 = I0.0 ∧ I0.1`,
      de: `      U     E 0.0
      U     E 0.1           // und außerdem E0.1
      =     A 4.0           // A4.0 = E0.0 ∧ E0.1`,
    },
    entradas: [e('E 0.0'), e('E 0.1')], salidas: [],
  },
  'y-no': {
    kop: segs('mini-y-no', [seg({ entrada: [na('E 0.0'), nc('E 0.1')], salidas: [bob('A 4.0')] })]),
    awl: {
      es: `      U     E 0.0           // marcha
      UN    E 0.1           // y no hay alarma
      =     A 4.0           // A4.0 = E0.0 ∧ ¬E0.1`,
      en: `      U     E 0.0           // start
      UN    E 0.1           // and no alarm
      =     A 4.0           // Q4.0 = I0.0 ∧ ¬I0.1`,
      de: `      U     E 0.0           // Ein
      UN    E 0.1           // und kein Alarm
      =     A 4.0           // A4.0 = E0.0 ∧ ¬E0.1`,
    },
    entradas: [e('E 0.0'), e('E 0.1')], salidas: [],
  },
  o: {
    kop: segs('mini-o', [seg({ entrada: [par([na('E 0.0')], [na('E 0.1')])], salidas: [bob('A 4.0')] })]),
    awl: {
      es: `      O     E 0.0
      O     E 0.1           // o E0.1
      =     A 4.0           // A4.0 = E0.0 ∨ E0.1`,
      en: `      O     E 0.0
      O     E 0.1           // or I0.1
      =     A 4.0           // Q4.0 = I0.0 ∨ I0.1`,
      de: `      O     E 0.0
      O     E 0.1           // oder E0.1
      =     A 4.0           // A4.0 = E0.0 ∨ E0.1`,
    },
    entradas: [e('E 0.0'), e('E 0.1')], salidas: [],
  },
  'o-no': {
    kop: segs('mini-o-no', [seg({ entrada: [par([na('E 0.0')], [nc('E 0.1')])], salidas: [bob('A 4.0')] })]),
    awl: {
      es: `      O     E 0.0
      ON    E 0.1           // o E0.1 vale 0
      =     A 4.0           // A4.0 = E0.0 ∨ ¬E0.1`,
      en: `      O     E 0.0
      ON    E 0.1           // or I0.1 is at 0
      =     A 4.0           // Q4.0 = I0.0 ∨ ¬I0.1`,
      de: `      O     E 0.0
      ON    E 0.1           // oder E0.1 ist 0
      =     A 4.0           // A4.0 = E0.0 ∨ ¬E0.1`,
    },
    entradas: [e('E 0.0'), e('E 0.1')], salidas: [],
  },
  combinado: {
    kop: segs('mini-comb', [seg({ entrada: [par([na('E 0.0')], [na('E 0.1')]), na('E 0.2')], salidas: [bob('A 4.0')] })]),
    awl: {
      es: `      U(
      O     E 0.0
      O     E 0.1
      )
      U     E 0.2
      =     A 4.0           // A4.0 = (E0.0 ∨ E0.1) ∧ E0.2`,
      en: `      U(
      O     E 0.0
      O     E 0.1
      )
      U     E 0.2
      =     A 4.0           // Q4.0 = (I0.0 ∨ I0.1) ∧ I0.2`,
      de: `      U(
      O     E 0.0
      O     E 0.1
      )
      U     E 0.2
      =     A 4.0           // A4.0 = (E0.0 ∨ E0.1) ∧ E0.2`,
    },
    entradas: [e('E 0.0'), e('E 0.1'), e('E 0.2')], salidas: [],
  },
  bobinas: {
    kop: segs('mini-bob', [
      seg({ entrada: [na('E 0.0')], salidas: [bob('A 4.0'), bob('A 4.1')] }),
      seg({ entrada: [na('E 0.0'), not()], salidas: [bob('A 4.2')] }),
    ]),
    awl: {
      es: `      U     E 0.0
      =     A 4.0           // dos asignaciones con el mismo RLO
      =     A 4.1
      U     E 0.0
      NOT                   // invierte el RLO
      =     A 4.2`,
      en: `      U     E 0.0
      =     A 4.0           // two assignments with the same RLO
      =     A 4.1
      U     E 0.0
      NOT                   // inverts the RLO
      =     A 4.2`,
      de: `      U     E 0.0
      =     A 4.0           // zwei Zuweisungen mit demselben VKE
      =     A 4.1
      U     E 0.0
      NOT                   // negiert das VKE
      =     A 4.2`,
    },
    entradas: [e('E 0.0')], salidas: [],
  },
  xor: {
    kop: segs('mini-xor', [seg({ entrada: [par([na('E 0.0'), nc('E 0.1')], [nc('E 0.0'), na('E 0.1')])], salidas: [bob('A 4.0')] })]),
    awl: {
      es: `      X     E 0.0           // interruptor de un extremo del pasillo
      X     E 0.1           // interruptor del otro extremo
      =     A 4.0           // la luz cambia con cualquiera de los dos`,
      en: `      X     E 0.0           // switch at one end of the corridor
      X     E 0.1           // switch at the other end
      =     A 4.0           // either switch changes the light`,
      de: `      X     E 0.0           // Schalter am einen Ende des Flurs
      X     E 0.1           // Schalter am anderen Ende
      =     A 4.0           // jeder der beiden Schalter wechselt das Licht`,
    },
    entradas: [e('E 0.0'), e('E 0.1')], salidas: [],
  },
  'set-reset': {
    kop: segs('mini-sr', [
      seg({ entrada: [na('E 0.0')], salidas: [s('A 4.0')] }),
      seg({ entrada: [na('E 0.1')], salidas: [r('A 4.0')] }),
    ]),
    awl: {
      es: `      U     E 0.0
      S     A 4.0           // si E0.0 = 1, A4.0 se pone a 1 y se queda
      U     E 0.1
      R     A 4.0           // si E0.1 = 1, A4.0 vuelve a 0`,
      en: `      U     E 0.0
      S     A 4.0           // if I0.0 = 1, Q4.0 is set to 1 and stays there
      U     E 0.1
      R     A 4.0           // if I0.1 = 1, Q4.0 goes back to 0`,
      de: `      U     E 0.0
      S     A 4.0           // wenn E0.0 = 1, wird A4.0 gesetzt und bleibt 1
      U     E 0.1
      R     A 4.0           // wenn E0.1 = 1, wird A4.0 wieder 0`,
    },
    entradas: [e('E 0.0'), e('E 0.1')], salidas: [],
  },
};
