// Páginas de teoría de la web (docs/<idioma>/<carpeta>/<slug>/).
// El texto sale de la referencia y de los ejemplos: en español, de src/content/; en los demás idiomas, de
// web/teoria/<idioma>/referencia.md y ejemplos.md, que conservan la numeración de secciones y los códigos E01, Q01…
// Aquí solo se elige qué secciones y qué ejemplos van en cada página, y su título y descripción.

export type Idioma = 'es' | 'en' | 'de';
export type PorIdioma = Partial<Record<Idioma, string>>;

export interface Seccion {
  /** Número de la referencia: «6.6» (apartado) o «9» (capítulo sin apartados) */
  ref: string;
  /** Título en la página, si no vale el de la referencia */
  titulo?: PorIdioma;
}

export interface Pagina {
  id: string;
  slug: PorIdioma;
  /** Título de la página (h1 y <title>) */
  titulo: PorIdioma;
  /** Nombre corto: índice lateral y «anterior / siguiente» */
  corto: PorIdioma;
  /** Meta descripción y entradilla */
  descripcion: PorIdioma;
  secciones: Seccion[];
  /** Ejemplos resueltos (E…, C…) */
  ejemplos?: string[];
  /** Preguntas «¿qué vale…?» con la solución plegada (Q…) */
  preguntas?: string[];
}

export const PAGINAS: Pagina[] = [
  {
    id: 'intro',
    slug: { es: 'que-es-un-plc', en: 'what-is-a-plc', de: 'was-ist-eine-sps' },
    titulo: { es: 'Qué es un PLC: partes, lenguajes y por dónde empezar', en: 'What is a PLC: parts, languages and where to start', de: 'Was ist eine SPS: Aufbau, Sprachen und Einstieg' },
    corto: { es: 'Qué es un PLC', en: 'What is a PLC', de: 'Was ist eine SPS' },
    descripcion: {
      es: 'Introducción a los autómatas programables: qué es un PLC, de qué partes se compone, en qué se diferencia de los relés y de un Arduino, qué lenguajes de programación existen (KOP, FUP, AWL, texto estructurado y GRAFCET) y cuál conviene aprender primero.',
      en: 'Introduction to programmable logic controllers: what a PLC is, its parts, how it differs from relays and from an Arduino, which programming languages exist (Ladder, FBD, STL, structured text and GRAFCET) and which one to learn first.',
      de: 'Einführung in speicherprogrammierbare Steuerungen: was eine SPS ist, woraus sie besteht, wie sie sich von Relais und von einem Arduino unterscheidet, welche Programmiersprachen es gibt (KOP, FUP, AWL, strukturierter Text und GRAFCET) und mit welcher man anfangen sollte.',
    },
    secciones: [{ ref: 'I.1' }, { ref: 'I.2' }, { ref: 'I.3' }, { ref: 'I.4' }, { ref: 'I.5' }],
    ejemplos: ['intro-primero'],
  },
  {
    id: 'ciclo',
    slug: { es: 'ciclo-de-scan', en: 'scan-cycle', de: 'sps-zyklus' },
    titulo: { es: 'Cómo funciona un PLC: el ciclo de scan', en: 'How a PLC works: the scan cycle', de: 'Wie eine SPS arbeitet: der Zyklus' },
    corto: { es: 'El ciclo de scan', en: 'The scan cycle', de: 'Der SPS-Zyklus' },
    descripcion: {
      es: 'Cómo ejecuta un autómata programable su programa: lee las entradas, ejecuta el OB1 y escribe las salidas. Qué consecuencias tiene en tus programas KOP y AWL, y por qué un paro NC se programa con un contacto NA.',
      en: 'How a programmable logic controller runs its program: it reads the inputs, executes OB1 and writes the outputs. What this means for your Ladder and STL programs, and why a normally closed stop button is programmed with a normally open contact.',
      de: 'Wie eine speicherprogrammierbare Steuerung ihr Programm abarbeitet: Eingänge lesen, OB1 bearbeiten, Ausgänge schreiben. Was das für deine KOP- und AWL-Programme bedeutet und warum ein Halt-Taster mit Öffner im Programm als Schließer abgefragt wird.',
    },
    secciones: [{ ref: '1.1' }, { ref: '1.2' }, { ref: '1.3' }, { ref: '1.4' }],
    ejemplos: ['E09', 'E09b'],
    preguntas: ['Q12'],
  },
  {
    id: 'memoria',
    slug: { es: 'areas-de-memoria', en: 'memory-areas', de: 'speicherbereiche' },
    titulo: { es: 'Áreas de memoria del PLC: entradas, salidas, marcas, temporizadores y contadores', en: 'PLC memory areas: inputs, outputs, bit memory, timers and counters', de: 'Speicherbereiche der SPS: Eingänge, Ausgänge, Merker, Zeiten und Zähler' },
    corto: { es: 'Áreas de memoria', en: 'Memory areas', de: 'Speicherbereiche' },
    descripcion: {
      es: 'Las áreas de memoria de un autómata (E, A, M, T, Z, DB, L y periferia), cómo se direccionan bits, bytes, palabras y dobles palabras, y para qué sirven las marcas y la marca de ciclo.',
      en: 'The memory areas of a PLC (I, Q, M, T, C, DB, L and peripheral I/O), how bits, bytes, words and double words are addressed, and what bit memory is used for.',
      de: 'Die Speicherbereiche einer SPS (E, A, M, T, Z, DB, L und Peripherie), wie Bits, Bytes, Wörter und Doppelwörter adressiert werden und wofür Merker verwendet werden.',
    },
    secciones: [{ ref: '2.1' }, { ref: '2.2' }, { ref: '2.3' }, { ref: '2.4' }, { ref: '2.5' }],
    preguntas: ['Q06'],
  },
  {
    id: 'tipos',
    slug: { es: 'tipos-de-datos', en: 'data-types', de: 'datentypen' },
    titulo: { es: 'Tipos de datos y constantes: INT, DINT, REAL, BCD y S5TIME', en: 'Data types and constants: INT, DINT, REAL, BCD and S5TIME', de: 'Datentypen und Konstanten: INT, DINT, REAL, BCD und S5TIME' },
    corto: { es: 'Tipos de datos', en: 'Data types', de: 'Datentypen' },
    descripcion: {
      es: 'Tipos de datos de KOP y AWL con su rango y sus constantes: BOOL, BYTE, WORD, INT, DINT, REAL, S5TIME y TIME. Cómo funciona el BCD, el formato interno de S5TIME y el direccionamiento simbólico.',
      en: 'Ladder and STL data types with their ranges and constants: BOOL, BYTE, WORD, INT, DINT, REAL, S5TIME and TIME. How BCD works, the internal format of S5TIME and symbolic addressing.',
      de: 'Datentypen in KOP und AWL mit Wertebereich und Konstanten: BOOL, BYTE, WORD, INT, DINT, REAL, S5TIME und TIME. Wie BCD funktioniert, das interne Format von S5TIME und die symbolische Adressierung.',
    },
    secciones: [{ ref: '3.1' }, { ref: '3.2' }, { ref: '3.3' }, { ref: '3.4' }, { ref: '4' }],
    ejemplos: ['E24'],
  },
  {
    id: 'bloques',
    slug: { es: 'bloques-ob-fc-fb-db', en: 'blocks-ob-fc-fb-db', de: 'bausteine-ob-fc-fb-db' },
    titulo: { es: 'Bloques del programa: OB, FC, FB y DB', en: 'Program blocks: OB, FC, FB and DB', de: 'Bausteine: OB, FC, FB und DB' },
    corto: { es: 'Bloques OB, FC, FB y DB', en: 'Blocks: OB, FC, FB and DB', de: 'Bausteine OB, FC, FB, DB' },
    descripcion: {
      es: 'Cómo se estructura un programa de autómata en bloques: OB de organización, funciones FC, bloques de función FB con su DB de instancia y bloques de datos DB. Los OB más importantes y cómo se llaman los bloques en AWL.',
      en: 'How a PLC program is structured in blocks: organization blocks (OB), functions (FC), function blocks (FB) with their instance DB, and data blocks (DB). The most important OBs and how blocks are called in STL.',
      de: 'Wie ein SPS-Programm in Bausteine gegliedert wird: Organisationsbausteine (OB), Funktionen (FC), Funktionsbausteine (FB) mit Instanz-DB und Datenbausteine (DB). Die wichtigsten OBs und wie Bausteine in AWL aufgerufen werden.',
    },
    secciones: [{ ref: '5.1' }, { ref: '5.2' }, { ref: '5.3' }, { ref: '5.4' }, { ref: '7.17' }, { ref: '7.18' }],
  },
  {
    id: 'kop',
    slug: { es: 'kop-contactos-y-bobinas', en: 'ladder-contacts-and-coils', de: 'kop-kontakte-und-spulen' },
    titulo: { es: 'KOP (Ladder) paso a paso: contactos, bobinas, serie y paralelo', en: 'Ladder logic (LAD) step by step: contacts, coils, series and parallel', de: 'KOP (Kontaktplan) Schritt für Schritt: Kontakte, Spulen, Reihe und parallel' },
    corto: { es: 'KOP: contactos y bobinas', en: 'Ladder: contacts and coils', de: 'KOP: Kontakte und Spulen' },
    descripcion: {
      es: 'Cómo se lee y se programa un esquema de contactos KOP (Ladder), paso a paso: contactos NA y NC, contactos en serie (Y) y en paralelo (O), bobinas, Set, Reset y NOT, con ejemplos que puedes probar aquí mismo y su equivalente en AWL.',
      en: 'How to read and program a Ladder diagram (LAD, called KOP in German), step by step: normally open and normally closed contacts, contacts in series (AND) and in parallel (OR), coils, Set, Reset and NOT, with examples you can try right here and their STL equivalent.',
      de: 'Wie man einen Kontaktplan (KOP) liest und programmiert, Schritt für Schritt: Schließer und Öffner, Kontakte in Reihe (UND) und parallel (ODER), Spulen, Setzen, Rücksetzen und NOT, mit Beispielen zum Ausprobieren und ihrer Entsprechung in AWL.',
    },
    secciones: [
      { ref: 'K.1' }, { ref: 'K.2' }, { ref: 'K.3' }, { ref: 'K.4' }, { ref: 'K.5' }, { ref: 'K.6' }, { ref: 'K.7' },
      { ref: '6.1', titulo: { es: 'Resumen y reglas de construcción', en: 'Summary and construction rules', de: 'Zusammenfassung und Regeln für den Aufbau' } }, { ref: '6.2' }, { ref: '6.3' }, { ref: '6.10' },
    ],
    ejemplos: ['E01', 'E02', 'E03'],
  },
  {
    id: 'awl',
    slug: { es: 'awl-rlo-y-logica-de-bits', en: 'stl-rlo-and-bit-logic', de: 'awl-vke-und-bitverknuepfung' },
    titulo: { es: 'AWL (STL) paso a paso: U, UN, O, ON, X y el RLO', en: 'Statement List (STL) step by step: A, AN, O, ON, X and the RLO', de: 'AWL (Anweisungsliste) Schritt für Schritt: U, UN, O, ON, X und das VKE' },
    corto: { es: 'AWL: RLO y lógica de bits', en: 'STL: RLO and bit logic', de: 'AWL: VKE und Bitlogik' },
    descripcion: {
      es: 'Las instrucciones lógicas de AWL (STL) explicadas una a una: U, UN, O, ON, X, XN, =, S, R y NOT, cómo se calcula el RLO, cómo se agrupa con paréntesis y cómo resolver un ejercicio a mano, con ejemplos que puedes probar aquí mismo.',
      en: 'The STL (AWL) logic instructions explained one by one: A, AN, O, ON, X, XN, =, S, R and NOT, how the RLO is calculated, how to group with brackets and how to solve an exercise by hand, with examples you can try right here.',
      de: 'Die Verknüpfungsanweisungen der AWL einzeln erklärt: U, UN, O, ON, X, XN, =, S, R und NOT, wie das VKE berechnet wird, wie man mit Klammern gruppiert und wie man eine Aufgabe von Hand löst, mit Beispielen zum Ausprobieren.',
    },
    secciones: [
      { ref: 'A.1' }, { ref: 'A.2' }, { ref: 'A.3' }, { ref: 'A.4' }, { ref: 'A.5' }, { ref: 'A.6' }, { ref: 'A.7' }, { ref: 'A.8' },
      { ref: '7.1' }, { ref: '7.2' }, { ref: '7.3' }, { ref: '7.4' }, { ref: '7.16' }, { ref: '7.21' },
    ],
    ejemplos: ['E04', 'E05'],
    preguntas: ['Q01', 'Q02'],
  },
  {
    id: 'setreset',
    slug: { es: 'enclavamiento-set-reset', en: 'latching-set-reset', de: 'selbsthaltung-setzen-ruecksetzen' },
    titulo: { es: 'Marcha y paro: enclavamiento, Set y Reset en KOP y AWL', en: 'Start and stop: latching, Set and Reset in Ladder and STL', de: 'Ein und Aus: Selbsthaltung, Setzen und Rücksetzen in KOP und AWL' },
    corto: { es: 'Enclavamiento, Set y Reset', en: 'Latching, Set and Reset', de: 'Selbsthaltung, Setzen, Rücksetzen' },
    descripcion: {
      es: 'Cómo programar una marcha y paro en KOP y AWL: enclavamiento (autorretención), bobinas Set y Reset, biestables SR y RS, y cómo se decide la prioridad entre marcha y paro.',
      en: 'How to program a start/stop circuit in Ladder and STL: latching (self-holding), Set and Reset coils, SR and RS flip-flops, and how the priority between start and stop is decided.',
      de: 'Wie du eine Ein-/Aus-Schaltung in KOP und AWL programmierst: Selbsthaltung, Setz- und Rücksetzspulen, SR- und RS-Flipflops und wie die Priorität zwischen Ein und Aus entschieden wird.',
    },
    secciones: [
      { ref: '6.4', titulo: { es: 'En KOP: bobinas, enclavamiento y biestables', en: 'In Ladder: coils, latching and flip-flops', de: 'In KOP: Spulen, Selbsthaltung und Flipflops' } },
      { ref: '7.5', titulo: { es: 'En AWL: asignación, Set y Reset', en: 'In STL: assignment, Set and Reset', de: 'In AWL: Zuweisung, Setzen und Rücksetzen' } },
    ],
    ejemplos: ['E06', 'E07', 'E08'],
  },
  {
    id: 'flancos',
    slug: { es: 'flancos', en: 'edge-detection', de: 'flanken' },
    titulo: { es: 'Flancos positivos y negativos en KOP y AWL (P, N, FP y FN)', en: 'Rising and falling edges in Ladder and STL (P, N, FP and FN)', de: 'Positive und negative Flanken in KOP und AWL (P, N, FP und FN)' },
    corto: { es: 'Flancos', en: 'Edge detection', de: 'Flanken' },
    descripcion: {
      es: 'Qué es un flanco positivo o negativo, cómo se detecta en KOP con (P) y (N) y en AWL con FP y FN, por qué cada flanco necesita su propia marca y cómo se hace un telerruptor.',
      en: 'What a rising or falling edge is, how it is detected in Ladder with (P) and (N) and in STL with FP and FN, why each edge needs its own memory bit, and how to build a toggle (impulse) relay.',
      de: 'Was eine positive oder negative Flanke ist, wie sie in KOP mit (P) und (N) und in AWL mit FP und FN erkannt wird, warum jede Flanke einen eigenen Flankenmerker braucht und wie ein Stromstoßschalter funktioniert.',
    },
    secciones: [
      { ref: '6.5', titulo: { es: 'Flancos en KOP', en: 'Edges in Ladder', de: 'Flanken in KOP' } },
      { ref: '7.6', titulo: { es: 'Flancos en AWL', en: 'Edges in STL', de: 'Flanken in AWL' } },
    ],
    ejemplos: ['E10', 'E11'],
  },
  {
    id: 'temporizadores',
    slug: { es: 'temporizadores', en: 'timers', de: 'zeiten' },
    titulo: { es: 'Temporizadores en KOP y AWL: SI, SV, SE, SS y SA', en: 'Timers in Ladder and STL: SP, SE, SD, SS and SF', de: 'Zeiten in KOP und AWL: SI, SV, SE, SS und SA' },
    corto: { es: 'Temporizadores', en: 'Timers', de: 'Zeiten' },
    descripcion: {
      es: 'Los cinco temporizadores de KOP y AWL explicados con cronogramas: impulso (SI), impulso prolongado (SV), retardo a la conexión (SE), retardo con memoria (SS) y retardo a la desconexión (SA). Con ejemplos resueltos.',
      en: 'The five Ladder and STL timers explained with timing diagrams: pulse (SP), extended pulse (SE), on-delay (SD), retentive on-delay (SS) and off-delay (SF). With worked examples.',
      de: 'Die fünf Zeiten in KOP und AWL mit Zeitdiagrammen erklärt: Impuls (SI), verlängerter Impuls (SV), Einschaltverzögerung (SE), speichernde Einschaltverzögerung (SS) und Ausschaltverzögerung (SA). Mit gelösten Beispielen.',
    },
    secciones: [
      { ref: '6.6', titulo: { es: 'Temporizadores en KOP', en: 'Timers in Ladder', de: 'Zeiten in KOP' } },
      { ref: '7.7' },
    ],
    ejemplos: ['E12', 'E13', 'E17'],
    preguntas: ['Q10'],
  },
  {
    id: 'contadores',
    slug: { es: 'contadores', en: 'counters', de: 'zaehler' },
    titulo: { es: 'Contadores en KOP y AWL: ZV, ZR y valor de preselección', en: 'Counters in Ladder and STL: count up, count down and preset value', de: 'Zähler in KOP und AWL: vorwärts, rückwärts und Zählwert setzen' },
    corto: { es: 'Contadores', en: 'Counters', de: 'Zähler' },
    descripcion: {
      es: 'Contadores ascendentes y descendentes en KOP y AWL: patillas, carga del valor de preselección en BCD, reset y lectura del valor en binario o en BCD. Con el ejemplo de un aparcamiento.',
      en: 'Up and down counters in Ladder and STL: pins, loading the preset value in BCD, reset, and reading the value in binary or in BCD. With a car park example.',
      de: 'Vorwärts- und Rückwärtszähler in KOP und AWL: Anschlüsse, Setzen des Zählwerts in BCD, Rücksetzen und Lesen des Werts binär oder in BCD. Mit dem Beispiel eines Parkhauses.',
    },
    secciones: [
      { ref: '6.7', titulo: { es: 'Contadores en KOP', en: 'Counters in Ladder', de: 'Zähler in KOP' } },
      { ref: '7.8' },
    ],
    ejemplos: ['E18', 'E19'],
  },
  {
    id: 'marcaciclo',
    slug: { es: 'marca-de-ciclo', en: 'clock-memory', de: 'taktmerker' },
    titulo: { es: 'Marca de ciclo: pilotos intermitentes sin temporizadores', en: 'Clock memory: flashing lights without timers', de: 'Taktmerker: Blinklichter ohne Zeiten' },
    corto: { es: 'Marca de ciclo', en: 'Clock memory', de: 'Taktmerker' },
    descripcion: {
      es: 'Qué es la marca de ciclo de un autómata, cómo se activa, a qué frecuencia oscila cada bit y cómo se usa para hacer parpadear un piloto o repetir una acción cada segundo, con ejemplos en KOP y AWL.',
      en: 'What a PLC’s clock memory is, how to enable it, the frequency of each bit and how to use it to make a lamp flash or repeat an action every second, with Ladder and STL examples.',
      de: 'Was der Taktmerker einer SPS ist, wie er aktiviert wird, mit welcher Frequenz jedes Bit schwingt und wie man damit eine Leuchte blinken lässt oder eine Aktion jede Sekunde wiederholt, mit Beispielen in KOP und AWL.',
    },
    secciones: [{ ref: '2.6' }],
    ejemplos: ['mc-intermitente', 'mc-segundos'],
  },
  {
    id: 'secuencias',
    slug: { es: 'secuencias-grafcet', en: 'sequences-grafcet', de: 'ablaufsteuerung-grafcet' },
    titulo: { es: 'Secuencias y GRAFCET en KOP y AWL: etapas, transiciones y marcas de etapa', en: 'Sequences and GRAFCET in Ladder and STL: steps, transitions and step bits', de: 'Ablaufsteuerungen und GRAFCET in KOP und AWL: Schritte, Transitionen und Schrittmerker' },
    corto: { es: 'Secuencias y GRAFCET', en: 'Sequences and GRAFCET', de: 'Ablaufsteuerung und GRAFCET' },
    descripcion: {
      es: 'Cómo programar una secuencia en un autómata: qué es un GRAFCET, cómo se pasa a KOP y AWL con marcas de etapa y Set/Reset, y el ejemplo completo de un semáforo que puedes probar.',
      en: 'How to program a sequence in a PLC: what a GRAFCET is, how to turn it into Ladder and STL with step bits and Set/Reset, and the complete example of a traffic light that you can try.',
      de: 'Wie man eine Ablaufsteuerung in einer SPS programmiert: was ein GRAFCET ist, wie man ihn mit Schrittmerkern und Setzen/Rücksetzen in KOP und AWL umsetzt, und das vollständige Beispiel einer Ampel zum Ausprobieren.',
    },
    secciones: [{ ref: 'S.1' }, { ref: 'S.2' }, { ref: 'S.3' }, { ref: 'S.4' }],
    ejemplos: ['E28'],
  },
  {
    id: 'aritmetica',
    slug: { es: 'comparacion-y-aritmetica', en: 'compare-and-arithmetic', de: 'vergleich-und-arithmetik' },
    titulo: { es: 'Carga, comparación y aritmética en KOP y AWL', en: 'Load, compare and arithmetic in Ladder and STL', de: 'Laden, Vergleichen und Arithmetik in KOP und AWL' },
    corto: { es: 'Comparación y aritmética', en: 'Compare and arithmetic', de: 'Vergleich und Arithmetik' },
    descripcion: {
      es: 'Cómo se trabaja con números en un autómata: cargar y transferir con L y T, comparar enteros y reales, sumar, restar, multiplicar y dividir, y qué pasa con los bits de estado cuando hay desbordamiento.',
      en: 'How to work with numbers in a PLC: load and transfer with L and T, compare integers and reals, add, subtract, multiply and divide, and what happens to the status bits on overflow.',
      de: 'Wie man in einer SPS mit Zahlen arbeitet: Laden und Transferieren mit L und T, Ganzzahlen und Gleitpunktzahlen vergleichen, addieren, subtrahieren, multiplizieren und dividieren und was bei einem Überlauf mit den Statusbits passiert.',
    },
    secciones: [
      { ref: '6.8', titulo: { es: 'Cuadros con EN/ENO en KOP', en: 'Boxes with EN/ENO in Ladder', de: 'Boxen mit EN/ENO in KOP' } },
      { ref: '7.9' }, { ref: '7.10' }, { ref: '7.11' }, { ref: '7.14' },
    ],
    ejemplos: ['E20', 'E21', 'E22'],
    preguntas: ['Q03'],
  },
  {
    id: 'conversiones',
    slug: { es: 'conversiones-y-logica-de-palabras', en: 'conversions-and-word-logic', de: 'umwandlung-und-wortverknuepfung' },
    titulo: { es: 'Conversiones y lógica de palabras: BCD, INT, DINT y REAL', en: 'Conversions and word logic: BCD, INT, DINT and REAL', de: 'Umwandlung und Wortverknüpfung: BCD, INT, DINT und REAL' },
    corto: { es: 'Conversiones', en: 'Conversions', de: 'Umwandlungen' },
    descripcion: {
      es: 'Cómo convertir entre BCD, INT, DINT y REAL en AWL y en KOP, cómo redondear, cómo escalar una entrada analógica a porcentaje y cómo enmascarar y desplazar bits con la lógica de palabras.',
      en: 'How to convert between BCD, INT, DINT and REAL in STL and Ladder, how to round, how to scale an analog input to a percentage, and how to mask and shift bits with word logic.',
      de: 'Wie man in AWL und KOP zwischen BCD, INT, DINT und REAL umwandelt, wie gerundet wird, wie ein Analogeingang in Prozent skaliert wird und wie Bits mit Wortverknüpfungen maskiert und geschoben werden.',
    },
    secciones: [{ ref: '7.12' }, { ref: '7.13' }],
    ejemplos: ['E23', 'E25'],
  },
  {
    id: 'saltos',
    slug: { es: 'saltos-y-bucles', en: 'jumps-and-loops', de: 'spruenge-und-schleifen' },
    titulo: { es: 'Saltos y bucles en AWL: SPA, SPB, SPBN y LOOP', en: 'Jumps and loops in STL: JU, JC, JCN and LOOP', de: 'Sprünge und Schleifen in AWL: SPA, SPB, SPBN und LOOP' },
    corto: { es: 'Saltos y bucles', en: 'Jumps and loops', de: 'Sprünge und Schleifen' },
    descripcion: {
      es: 'Saltos condicionales e incondicionales en AWL (SPA, SPB, SPBN, SPZ…), su equivalente en KOP (JMP, JMPN) y bucles con LOOP, con las trampas que más se preguntan en los exámenes.',
      en: 'Conditional and unconditional jumps in STL (JU, JC, JCN, JZ…), their Ladder equivalent (JMP, JMPN) and loops with LOOP, with the pitfalls that come up most often in exams.',
      de: 'Bedingte und unbedingte Sprünge in AWL (SPA, SPB, SPBN, SPZ…), ihre Entsprechung in KOP (JMP, JMPN) und Schleifen mit LOOP, mit den Fallen, die in Prüfungen am häufigsten vorkommen.',
    },
    secciones: [
      { ref: '6.9', titulo: { es: 'Control del programa en KOP', en: 'Program control in Ladder', de: 'Programmsteuerung in KOP' } },
      { ref: '7.15', titulo: { es: 'Saltos en AWL', en: 'Jumps in STL', de: 'Sprünge in AWL' } },
    ],
    ejemplos: ['E26', 'E27'],
    preguntas: ['Q08'],
  },
  {
    id: 'indirecto',
    slug: { es: 'direccionamiento-indirecto-y-mcr', en: 'indirect-addressing-and-mcr', de: 'indirekte-adressierung-und-mcr' },
    titulo: { es: 'Direccionamiento indirecto y MCR en AWL', en: 'Indirect addressing and MCR in STL', de: 'Indirekte Adressierung und MCR in AWL' },
    corto: { es: 'Direccionamiento indirecto', en: 'Indirect addressing', de: 'Indirekte Adressierung' },
    descripcion: {
      es: 'Direccionamiento indirecto por memoria y por registro en AWL, el formato de los punteros de área y el Master Control Relay (MCR), con un ejemplo que suma una tabla de palabras.',
      en: 'Memory-indirect and register-indirect addressing in STL, the area pointer format and the Master Control Relay (MCR), with an example that adds up a table of words.',
      de: 'Speicherindirekte und registerindirekte Adressierung in AWL, das Format des Bereichszeigers und das Master Control Relay (MCR), mit einem Beispiel, das eine Tabelle von Wörtern aufsummiert.',
    },
    secciones: [{ ref: '7.19' }, { ref: '7.20' }],
    ejemplos: ['E29'],
  },
  {
    id: 'equivalencias',
    slug: { es: 'equivalencias-kop-awl', en: 'ladder-stl-equivalences', de: 'kop-awl-entsprechungen' },
    titulo: { es: 'Equivalencias KOP ↔ AWL: cómo pasar de un lenguaje a otro', en: 'Ladder ↔ STL equivalences: translating between the two languages', de: 'Entsprechungen KOP ↔ AWL: von einer Sprache in die andere' },
    corto: { es: 'Equivalencias KOP ↔ AWL', en: 'Ladder ↔ STL', de: 'KOP ↔ AWL' },
    descripcion: {
      es: 'Cómo traducir un esquema KOP a AWL y al revés: cada elemento con su instrucción, los patrones de serie y paralelo y cómo se traducen los cuadros con EN/ENO. Con ejercicios resueltos.',
      en: 'How to translate a Ladder network into STL and back: each element with its instruction, series and parallel patterns, and how boxes with EN/ENO are translated. With worked exercises.',
      de: 'Wie man ein KOP-Netzwerk in AWL übersetzt und umgekehrt: jedes Element mit seiner Anweisung, Muster für Reihen- und Parallelschaltungen und wie Boxen mit EN/ENO übersetzt werden. Mit gelösten Aufgaben.',
    },
    secciones: [{ ref: '8.1' }, { ref: '8.2' }, { ref: '8.3' }],
    ejemplos: ['C01', 'C04'],
  },
  {
    id: 'ejercicios',
    slug: { es: 'ejercicios-resueltos', en: 'solved-exercises', de: 'geloeste-aufgaben' },
    titulo: { es: 'Ejercicios resueltos de autómatas: depósito, minutero, contador y estrella-triángulo', en: 'Solved PLC exercises: tank, staircase timer, counter and star-delta', de: 'Gelöste SPS-Aufgaben: Behälter, Treppenhausautomat, Zähler und Stern-Dreieck' },
    corto: { es: 'Ejercicios resueltos', en: 'Solved exercises', de: 'Gelöste Aufgaben' },
    descripcion: {
      es: 'Ejercicios típicos de PLC resueltos en KOP y AWL y comprobados en el simulador: llenado de un depósito con histéresis, minutero de escalera, aviso cada 5 piezas y arranque estrella-triángulo.',
      en: 'Typical PLC exercises solved in Ladder and STL and checked in the simulator: filling a tank with hysteresis, a staircase light timer, a warning every 5 parts and a star-delta motor start.',
      de: 'Typische SPS-Aufgaben, in KOP und AWL gelöst und im Simulator geprüft: Behälter füllen mit Hysterese, Treppenhausautomat, Meldung alle 5 Teile und Stern-Dreieck-Anlauf.',
    },
    secciones: [{ ref: 'P.1' }],
    ejemplos: ['P01', 'P02', 'P03', 'P04'],
  },
  {
    id: 'nemotecnica',
    slug: { es: 'nemotecnica-y-glosario', en: 'mnemonics-and-glossary', de: 'mnemonik-und-glossar' },
    titulo: { es: 'Nemotécnica alemana e inglesa de AWL y glosario', en: 'German and English STL mnemonics, and glossary', de: 'Deutsche und englische AWL-Mnemonik und Glossar' },
    corto: { es: 'Nemotécnica y glosario', en: 'Mnemonics and glossary', de: 'Mnemonik und Glossar' },
    descripcion: {
      es: 'Tabla de equivalencias entre la nemotécnica alemana (U, E, A, SPB…) y la inglesa (A, I, Q, JC…) de AWL y STL, y glosario de los términos de KOP y AWL.',
      en: 'Table of equivalences between the German (U, E, A, SPB…) and the English (A, I, Q, JC…) STL mnemonics, and a glossary of Ladder and STL terms.',
      de: 'Tabelle der Entsprechungen zwischen der deutschen (U, E, A, SPB…) und der englischen AWL-Mnemonik (A, I, Q, JC…) und ein Glossar der Begriffe aus KOP und AWL.',
    },
    secciones: [{ ref: '11' }, { ref: '12' }],
  },
];
