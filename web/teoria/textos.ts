// Textos fijos de las páginas de teoría en cada idioma.
import type { TextosCronogramas } from '../../scripts/web/cronogramas';
import type { TextosFiguras } from '../../scripts/web/figuras';
import type { TextosVivo } from '../../scripts/web/vivo-datos';
import type { Idioma } from './paginas';

export interface Textos {
  /** Carpeta de la teoría dentro de docs/<idioma>/ */
  carpeta: string;
  /** Nombre del idioma en su propia lengua */
  nombre: string;
  locale: string;
  teoria: string;
  tituloIndice: string;
  descripcionIndice: string;
  entradillaIndice: string;
  simulador: string;
  descargar: string;
  indice: string;
  ejemplos: string;
  enunciado: string;
  preguntas: string;
  preguntasPie: string;
  /** Título del bloque de preguntas frecuentes */
  faq: string;
  segmento: string;
  anterior: string;
  siguiente: string;
  ver: string;
  y: string;
  /** Coletilla que acompaña a los § en los ejemplos («de la referencia»), como expresión regular; se quita */
  deLaReferencia: string;
  /** Frases de los documentos que solo tienen sentido dentro de la app */
  quitar: RegExp[];
  practicaTitulo: string;
  practicaTexto: string;
  practicaBoton: string;
  pie: string;
  cambiarTema: string;
  codigoGitHub: string;
  idiomas: string;
  esquemaKop: string;
  /** Panel interactivo de los ejemplos */
  vivo: TextosVivo;
  /** Cronogramas de los flancos y de los temporizadores */
  cronogramas: TextosCronogramas;
  /** Figuras que sustituyen a los esquemas en ASCII de la referencia */
  figuras: TextosFiguras;
}

export const TEXTOS: Partial<Record<Idioma, Textos>> = {
  es: {
    carpeta: 'teoria',
    nombre: 'Español',
    locale: 'es_ES',
    teoria: 'Teoría',
    tituloIndice: 'Teoría de autómatas: KOP y AWL explicados con ejemplos',
    descripcionIndice: 'Curso gratuito de programación de autómatas en KOP (Ladder) y AWL (STL): ciclo de scan, memoria, lógica de bits, temporizadores, contadores, aritmética y saltos, con ejemplos resueltos.',
    entradillaIndice: 'Todo lo necesario para programar autómatas en KOP (esquema de contactos o Ladder) y en AWL (lista de instrucciones o STL), tema a tema y con ejemplos resueltos. Es la misma teoría que trae el simulador en la sección «Aprender».',
    simulador: 'Simulador',
    descargar: 'Descargar',
    indice: 'Índice de la teoría',
    ejemplos: 'Ejemplos resueltos',
    enunciado: 'Enunciado',
    preguntas: 'Ponte a prueba',
    preguntasPie: 'Piensa la respuesta antes de abrir la solución.',
    faq: 'Preguntas frecuentes',
    segmento: 'Segmento',
    anterior: 'Anterior',
    siguiente: 'Siguiente',
    ver: 'ver',
    y: 'y',
    deLaReferencia: '\\s+de la referencia',
    quitar: [/^- La app debería permitir usar símbolos.*\n?/m, / \(cada carácter representa un ciclo\)/],
    practicaTitulo: 'Practica con el simulador',
    practicaTexto: 'Todos los ejemplos de esta página vienen en Automatizacion, un simulador de PLC gratuito para Windows, macOS y Linux: ábrelos, cambia las entradas y mira cómo responde el programa ciclo a ciclo.',
    practicaBoton: 'Descargar el simulador',
    pie: 'Simulador de PLC gratuito para aprender KOP y AWL. © 2026 Arzath · Licencia MIT · Proyecto educativo independiente, sin relación con ningún fabricante de autómatas.',
    cambiarTema: 'Cambiar entre tema claro y oscuro',
    codigoGitHub: 'Código en GitHub',
    idiomas: 'Idioma',
    esquemaKop: 'Esquema KOP',
    vivo: {
      pruebalo: 'Pruébalo',
      pista: 'Haz clic en las entradas.',
      pistaMayus: 'Con Mayús + clic, la entrada funciona como un pulsador mientras la mantienes.',
      reiniciar: 'Reiniciar',
      valorNoValido: 'Valor no válido',
    },
    figuras: {
      ciclo: [['Leer entradas', 'PAE'], ['Ejecutar OB1', 'programa'], ['Escribir salidas', 'PAA'], ['Comunicación', 'y diagnóstico']],
      cicloVuelta: 'y vuelta a empezar',
      bytesFilas: ['Doble palabra', 'Palabras', 'Bytes', 'Bits de MD 10'],
      bytesPie: 'El byte de dirección más baja es el más significativo: MW10 = MB10 · 256 + MB11, así que MB10 es el byte alto de MW10.',
      s5: { bit: 'Bit', sinUso: 'sin uso', base: 'base', centenas: 'centenas', decenas: 'decenas', unidades: 'unidades', pie: 'S5T#5S se guarda como W#16#0500: base 00 (10 ms) y las cifras 5, 0 y 0 en BCD, es decir, 500 × 10 ms = 5 s.' },
      awl: { meta: 'Meta (opcional)', operacion: 'Operación', operando: 'Operando', comentario: 'Comentario', ejemplo: ['FIN:', 'U', 'E 0.0', '// Y con la entrada 0.0'] },
      kop: {
        y: 'Y (AND): A4.0 = E0.0 ∧ E0.1',
        o: 'O (OR): A4.0 = E0.0 ∨ E0.1',
        nand: 'NAND: la Y invertida con NOT',
        nor: 'NOR: la O invertida con NOT',
        xor: 'O-exclusiva (XOR): a·b̄ + ā·b',
        enclavamiento: 'Marcha y paro con prioridad al paro. E0.0 = marcha, E0.1 = paro (NC cableado) y A4.0 = motor. El contacto A4.0, en paralelo con la marcha, mantiene el motor en marcha al soltarla.',
        setReset: 'Set y Reset con bobinas. El Reset va en el segundo segmento, así que se ejecuta después: prioridad a desactivar.',
        sr: 'SR: si S y R valen 1 a la vez, gana R y Q = 0.',
        rs: 'RS: si las dos valen 1, gana S y Q = 1.',
        flanco: 'M10.1 = impulso de un ciclo al pulsar E0.0. M10.0 es la marca de flanco, donde (P) guarda el RLO del ciclo anterior.',
        temporizador: 'Retardo a la conexión T1 (S_EVERZ) con todas sus patillas: arranque S, valor TW, reset R, estado Q y tiempo restante en DUAL (binario) y DEZ (BCD).',
        contador: 'Contador ascendente Z1 (Z_VORW): cuenta los flancos de ZV, carga 5 con S, se pone a 0 con R y da el valor en DUAL (binario) y DEZ (BCD). Q = 1 si el valor es mayor que 0.',
        comparador: 'El comparador va en serie con el contacto, como si fuera otro contacto: A5.6 = E2.0 ∧ (MW30 > 500).',
      },
    },
    cronogramas: {
      nota: 'Con TW = 1 s. Las señales salen de simular cada temporizador con el motor del simulador.',
      marcaCiclo: { pie: 'Los ocho bits de la marca de ciclo en MB100 durante 4 s, simulados con el motor del simulador. A la derecha, el periodo de cada bit.' },
      grafcet: {
        reposo: 'Reposo', verde: 'verde', ambar: 'ámbar', rojo: 'rojo', marcha: 'marcha',
        pie: 'El GRAFCET del semáforo del ejemplo E28. La etapa inicial (0) no tiene marca: en el programa, «ninguna etapa activa» hace de etapa inicial. Al poner E 0.0 a 0, un segmento de paro desactiva todas las etapas.',
      },
      flancos: { pie: 'Cada columna es un ciclo de scan. (P) vale 1 solo en el ciclo en que E 0.0 pasa de 0 a 1, y (N) solo en el ciclo en que pasa de 1 a 0.' },
      temporizadores: {
        SI: { nemo: 'SI', nombre: 'Impulso', cuadro: 'S_IMPULS', pie: 'Q se activa con el flanco de S y dura t como máximo. Si S cae antes, Q cae con ella.' },
        SV: { nemo: 'SV', nombre: 'Impulso prolongado', cuadro: 'S_VIMP', pie: 'Q dura t aunque S caiga. Un nuevo flanco de S mientras cuenta lo vuelve a arrancar.' },
        SE: { nemo: 'SE', nombre: 'Retardo a la conexión', cuadro: 'S_EVERZ', pie: 'Q se activa cuando S lleva t a 1. El segundo pulso es más corto que t, así que Q no llega a activarse.' },
        SS: { nemo: 'SS', nombre: 'Retardo a la conexión con memoria', cuadro: 'S_SEVERZ', pie: 'Arranca con el flanco de S y sigue contando aunque S caiga. Q se queda a 1 hasta el reset R.' },
        SA: { nemo: 'SA', nombre: 'Retardo a la desconexión', cuadro: 'S_AVERZ', pie: 'Q se activa en cuanto S = 1 y se desactiva t después de la última bajada de S.' },
      },
    },
  },
  en: {
    carpeta: 'theory',
    nombre: 'English',
    locale: 'en_US',
    teoria: 'Theory',
    tituloIndice: 'PLC programming theory: Ladder (LAD) and STL explained with examples',
    descripcionIndice: 'Free PLC programming course in Ladder (LAD, KOP) and Statement List (STL, AWL): scan cycle, memory, bit logic, timers, counters, arithmetic and jumps, with worked examples you can run in your browser.',
    entradillaIndice: 'Everything you need to program PLCs in Ladder (LAD, called KOP in German) and Statement List (STL, called AWL in German), topic by topic and with worked examples you can try right here. It is the theory built into the Automatizacion simulator, whose interface is in Spanish.',
    simulador: 'Simulator',
    descargar: 'Download',
    indice: 'Theory contents',
    ejemplos: 'Worked examples',
    enunciado: 'Task',
    preguntas: 'Test yourself',
    preguntasPie: 'Work out the answer before you open the solution.',
    faq: 'Frequently asked questions',
    segmento: 'Network',
    anterior: 'Previous',
    siguiente: 'Next',
    ver: 'see',
    y: 'and',
    deLaReferencia: '\\s+of the reference',
    quitar: [],
    practicaTitulo: 'Practice with the simulator',
    practicaTexto: 'All the examples on this page come with Automatizacion, a free PLC simulator for Windows, macOS and Linux: open them, change the inputs and watch the program respond cycle by cycle. Note: the app’s interface is in Spanish.',
    practicaBoton: 'Download the simulator',
    pie: 'Free PLC simulator to learn Ladder and STL. © 2026 Arzath · MIT License · Independent educational project, not affiliated with any PLC manufacturer.',
    cambiarTema: 'Switch between light and dark theme',
    codigoGitHub: 'Code on GitHub',
    idiomas: 'Language',
    esquemaKop: 'Ladder diagram',
    vivo: {
      pruebalo: 'Try it',
      pista: 'Click the inputs.',
      pistaMayus: 'With Shift + click, an input works as a push button while you hold it.',
      reiniciar: 'Reset',
      valorNoValido: 'Invalid value',
    },
    figuras: {
      ciclo: [['Read inputs', 'PII'], ['Execute OB1', 'program'], ['Write outputs', 'PIQ'], ['Communication', 'and diagnostics']],
      cicloVuelta: 'and start again',
      bytesFilas: ['Double word', 'Words', 'Bytes', 'Bits of MD 10'],
      bytesPie: 'The byte with the lowest address is the most significant one: MW10 = MB10 · 256 + MB11, so MB10 is the high byte of MW10.',
      s5: { bit: 'Bit', sinUso: 'unused', base: 'base', centenas: 'hundreds', decenas: 'tens', unidades: 'units', pie: 'S5T#5S is stored as W#16#0500: time base 00 (10 ms) and the digits 5, 0 and 0 in BCD, that is, 500 × 10 ms = 5 s.' },
      awl: { meta: 'Label (optional)', operacion: 'Operation', operando: 'Operand', comentario: 'Comment', ejemplo: ['END:', 'A', 'I 0.0', '// AND with input 0.0'] },
      kop: {
        y: 'AND: Q4.0 = I0.0 ∧ I0.1',
        o: 'OR: Q4.0 = I0.0 ∨ I0.1',
        nand: 'NAND: AND inverted with NOT',
        nor: 'NOR: OR inverted with NOT',
        xor: 'Exclusive OR (XOR): a·b̄ + ā·b',
        enclavamiento: 'Start and stop with stop priority. I0.0 = start, I0.1 = stop (wired NC) and Q4.0 = motor. The Q4.0 contact, in parallel with start, keeps the motor running after start is released.',
        setReset: 'Set and Reset with coils. The reset is in the second network, so it is executed later: reset priority.',
        sr: 'SR: if S and R are both 1, R wins and Q = 0.',
        rs: 'RS: if both are 1, S wins and Q = 1.',
        flanco: 'M10.1 = one-cycle pulse when I0.0 is pressed. M10.0 is the edge memory bit, where (P) stores the RLO of the previous cycle.',
        temporizador: 'On-delay T1 (S_ODT) with all its pins, labeled with the German names, like the simulator: start S, time value TW (TV), reset R, status Q and remaining time in DUAL (BI, binary) and DEZ (BCD).',
        contador: 'Up counter C1 (S_CU): it counts the edges on ZV (CU), loads 5 with S, is reset to 0 with R and gives the value in DUAL (CV, binary) and DEZ (CV_BCD). Q = 1 if the value is greater than 0.',
        comparador: 'The comparator goes in series with the contact, as if it were another contact: Q5.6 = I2.0 ∧ (MW30 > 500).',
      },
    },
    cronogramas: {
      nota: 'With TV = 1 s. The signals come from simulating each timer with the simulator’s engine.',
      marcaCiclo: { pie: 'The eight bits of the clock memory in MB100 over 4 s, simulated with the simulator’s engine. On the right, the period of each bit.' },
      grafcet: {
        reposo: 'Idle', verde: 'green', ambar: 'amber', rojo: 'red', marcha: 'start',
        pie: 'The GRAFCET of the traffic light in example E28. The initial step (0) has no memory bit: in the program, “no step active” acts as the initial step. When I 0.0 is set to 0, a stop network deactivates all the steps.',
      },
      flancos: { pie: 'Each column is one scan cycle. (P) is 1 only in the cycle in which I 0.0 changes from 0 to 1, and (N) only in the cycle in which it changes from 1 to 0.' },
      temporizadores: {
        SI: { nemo: 'SP', nombre: 'Pulse', cuadro: 'S_PULSE', pie: 'Q turns on with the rising edge of S and lasts at most t. If S drops earlier, Q drops with it.' },
        SV: { nemo: 'SE', nombre: 'Extended pulse', cuadro: 'S_PEXT', pie: 'Q lasts t even if S drops. A new rising edge of S while the timer is running starts it again.' },
        SE: { nemo: 'SD', nombre: 'On-delay', cuadro: 'S_ODT', pie: 'Q turns on once S has been at 1 for t. The second pulse is shorter than t, so Q never turns on.' },
        SS: { nemo: 'SS', nombre: 'Retentive on-delay', cuadro: 'S_ODTS', pie: 'It starts with the rising edge of S and keeps timing even if S drops. Q stays at 1 until the reset R.' },
        SA: { nemo: 'SF', nombre: 'Off-delay', cuadro: 'S_OFFDT', pie: 'Q turns on as soon as S = 1 and turns off t after the last falling edge of S.' },
      },
    },
  },
  de: {
    carpeta: 'theorie',
    nombre: 'Deutsch',
    locale: 'de_DE',
    teoria: 'Theorie',
    tituloIndice: 'SPS-Programmierung: KOP und AWL mit Beispielen erklärt',
    descripcionIndice: 'Kostenloser Kurs zur SPS-Programmierung in KOP (Kontaktplan) und AWL (Anweisungsliste): Zyklus, Speicherbereiche, Bitverknüpfungen, Zeiten, Zähler, Arithmetik und Sprünge, mit gelösten Beispielen, die du im Browser ausprobieren kannst.',
    entradillaIndice: 'Alles, was du zum Programmieren einer SPS in KOP (Kontaktplan) und AWL (Anweisungsliste) brauchst, Thema für Thema und mit gelösten Beispielen, die du direkt hier ausprobieren kannst. Es ist die Theorie aus dem Simulator Automatizacion, dessen Oberfläche auf Spanisch ist.',
    simulador: 'Simulator',
    descargar: 'Herunterladen',
    indice: 'Inhalt der Theorie',
    ejemplos: 'Gelöste Beispiele',
    enunciado: 'Aufgabe',
    preguntas: 'Teste dein Wissen',
    preguntasPie: 'Überlege dir die Antwort, bevor du die Lösung aufklappst.',
    faq: 'Häufige Fragen',
    segmento: 'Netzwerk',
    anterior: 'Zurück',
    siguiente: 'Weiter',
    ver: 'siehe',
    y: 'und',
    deLaReferencia: '\\s+der Referenz',
    quitar: [],
    practicaTitulo: 'Mit dem Simulator üben',
    practicaTexto: 'Alle Beispiele dieser Seite sind in Automatizacion enthalten, einem kostenlosen SPS-Simulator für Windows, macOS und Linux: Öffne sie, ändere die Eingänge und beobachte Zyklus für Zyklus, wie das Programm reagiert. Hinweis: Die Oberfläche der App ist auf Spanisch.',
    practicaBoton: 'Simulator herunterladen',
    pie: 'Kostenloser SPS-Simulator zum Lernen von KOP und AWL. © 2026 Arzath · MIT-Lizenz · Unabhängiges Bildungsprojekt ohne Verbindung zu einem SPS-Hersteller.',
    cambiarTema: 'Zwischen hellem und dunklem Design wechseln',
    codigoGitHub: 'Code auf GitHub',
    idiomas: 'Sprache',
    esquemaKop: 'KOP-Netzwerk',
    vivo: {
      pruebalo: 'Ausprobieren',
      pista: 'Klicke auf die Eingänge.',
      pistaMayus: 'Mit Umschalt + Klick wirkt ein Eingang als Taster, solange du ihn gedrückt hältst.',
      reiniciar: 'Neu starten',
      valorNoValido: 'Ungültiger Wert',
    },
    figuras: {
      ciclo: [['Eingänge lesen', 'PAE'], ['OB1 bearbeiten', 'Programm'], ['Ausgänge schreiben', 'PAA'], ['Kommunikation', 'und Diagnose']],
      cicloVuelta: 'und wieder von vorn',
      bytesFilas: ['Doppelwort', 'Wörter', 'Bytes', 'Bits von MD 10'],
      bytesPie: 'Das Byte mit der niedrigsten Adresse ist das höchstwertige: MW10 = MB10 · 256 + MB11, also ist MB10 das High-Byte von MW10.',
      s5: { bit: 'Bit', sinUso: 'frei', base: 'Basis', centenas: 'Hunderter', decenas: 'Zehner', unidades: 'Einer', pie: 'S5T#5S wird als W#16#0500 gespeichert: Zeitbasis 00 (10 ms) und die Ziffern 5, 0 und 0 in BCD, also 500 × 10 ms = 5 s.' },
      awl: { meta: 'Sprungmarke (optional)', operacion: 'Operation', operando: 'Operand', comentario: 'Kommentar', ejemplo: ['ENDE:', 'U', 'E 0.0', '// UND mit Eingang 0.0'] },
      kop: {
        y: 'UND: A4.0 = E0.0 ∧ E0.1',
        o: 'ODER: A4.0 = E0.0 ∨ E0.1',
        nand: 'NAND: UND, mit NOT negiert',
        nor: 'NOR: ODER, mit NOT negiert',
        xor: 'Exklusiv-ODER (XOR): a·b̄ + ā·b',
        enclavamiento: 'Ein und Aus mit Vorrang für Aus. E0.0 = Ein, E0.1 = Halt (als Öffner verdrahtet) und A4.0 = Motor. Der Kontakt A4.0 parallel zu Ein hält den Motor eingeschaltet, wenn Ein losgelassen wird.',
        setReset: 'Setzen und Rücksetzen mit Spulen. Das Rücksetzen steht im zweiten Netzwerk und wird danach bearbeitet: rücksetzdominant.',
        sr: 'SR: Sind S und R gleichzeitig 1, gewinnt R und Q = 0.',
        rs: 'RS: Sind beide 1, gewinnt S und Q = 1.',
        flanco: 'M10.1 = Impuls für einen Zyklus beim Drücken von E0.0. M10.0 ist der Flankenmerker, in dem (P) das VKE des vorherigen Zyklus speichert.',
        temporizador: 'Einschaltverzögerung T1 (S_EVERZ) mit allen Anschlüssen: Start S, Zeitwert TW, Rücksetzen R, Zustand Q und Restzeit in DUAL (binär) und DEZ (BCD).',
        contador: 'Vorwärtszähler Z1 (Z_VORW): zählt die Flanken an ZV, lädt 5 mit S, wird mit R auf 0 gesetzt und liefert den Wert in DUAL (binär) und DEZ (BCD). Q = 1, wenn der Wert größer als 0 ist.',
        comparador: 'Der Vergleicher steht in Reihe mit dem Kontakt, wie ein weiterer Kontakt: A5.6 = E2.0 ∧ (MW30 > 500).',
      },
    },
    cronogramas: {
      nota: 'Mit TW = 1 s. Die Signale stammen aus der Simulation jeder Zeit mit dem Simulator.',
      marcaCiclo: { pie: 'Die acht Bits des Taktmerkers in MB100 über 4 s, mit dem Simulator simuliert. Rechts die Periodendauer jedes Bits.' },
      grafcet: {
        reposo: 'Ruhe', verde: 'grün', ambar: 'gelb', rojo: 'rot', marcha: 'Start',
        pie: 'Der GRAFCET der Ampel aus Beispiel E28. Der Anfangsschritt (0) hat keinen Merker: Im Programm dient „kein Schritt aktiv“ als Anfangsschritt. Wird E 0.0 auf 0 gesetzt, setzt ein Halt-Netzwerk alle Schritte zurück.',
      },
      flancos: { pie: 'Jede Spalte ist ein Zyklus. (P) ist nur in dem Zyklus 1, in dem E 0.0 von 0 auf 1 wechselt, und (N) nur in dem Zyklus, in dem E 0.0 von 1 auf 0 wechselt.' },
      temporizadores: {
        SI: { nemo: 'SI', nombre: 'Impuls', cuadro: 'S_IMPULS', pie: 'Q wird mit der steigenden Flanke von S zu 1 und bleibt höchstens t lang an. Fällt S vorher ab, fällt Q mit ab.' },
        SV: { nemo: 'SV', nombre: 'Verlängerter Impuls', cuadro: 'S_VIMP', pie: 'Q bleibt t lang an, auch wenn S abfällt. Eine neue steigende Flanke von S während des Ablaufs startet die Zeit neu.' },
        SE: { nemo: 'SE', nombre: 'Einschaltverzögerung', cuadro: 'S_EVERZ', pie: 'Q wird 1, wenn S seit t auf 1 ist. Der zweite Impuls ist kürzer als t, deshalb wird Q nicht 1.' },
        SS: { nemo: 'SS', nombre: 'Speichernde Einschaltverzögerung', cuadro: 'S_SEVERZ', pie: 'Startet mit der steigenden Flanke von S und läuft weiter, auch wenn S abfällt. Q bleibt bis zum Rücksetzen R auf 1.' },
        SA: { nemo: 'SA', nombre: 'Ausschaltverzögerung', cuadro: 'S_AVERZ', pie: 'Q wird 1, sobald S = 1 ist, und t nach der letzten fallenden Flanke von S wieder 0.' },
      },
    },
  },
};
