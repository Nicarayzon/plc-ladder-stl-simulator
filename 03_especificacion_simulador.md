# Especificación — App de práctica de KOP y AWL con mini simulador

> **Para el agente que va a desarrollar la app.** Este documento dice *qué* construir y *cómo debe comportarse*. La semántica exacta de cada instrucción está en el intérprete de referencia `tools/interprete_referencia.py`: **si este documento y ese código discrepan, manda el código**. Los apartados marcados como **(normativo)** son obligatorios. El resto son recomendaciones.

---

## 0. Paquete de entrega y por dónde empezar

| Archivo | Qué es | Uso en el desarrollo |
|---|---|---|
| `src/content/referencia_KOP_AWL.md` (`01`) | Teoría completa de KOP y AWL: memoria, tipos, instrucciones, trampas | Contenido del modo «Aprender» y fuente de verdad conceptual. Los bloques ```` ```awl ```` se pueden ejecutar (botón «Probar») |
| `src/content/ejemplos_KOP_AWL.md` (`02`) | 62 fichas: 61 ejercicios con pruebas en YAML (ejemplos, predicción, traducción, programación, trazas, cronogramas) y un banco de 24 preguntas de teoría | Fuente editable del banco de ejercicios |
| `03_especificacion_simulador.md` (`03`) | Este documento | Requisitos |
| `tools/interprete_referencia.py` (`04`) | Intérprete AWL de referencia en Python (modelo de oro), con verificador del banco | Portarlo a TypeScript respetando su comportamiento y usarlo en pruebas diferenciales |
| `src/content/banco_ejercicios.json` (`05`) | El banco de `02` exportado a JSON | Lo que **carga la app** |

En el resto del documento se citan por el número que llevaban al empezar el proyecto: `01` es la teoría, `02` los ejemplos, `04` el intérprete de referencia y `05` el banco en JSON. Las rutas son las de la tabla, desde la raíz del repositorio.

**Regla de oro.** El núcleo del simulador de la app debe superar el 100 % de las pruebas de `src/content/banco_ejercicios.json` (pasos, trazas y cronogramas) y las pruebas internas de `04` (`selftest`). Hoy el intérprete de referencia supera 62/62 y 31/31:

```text
python3 tools/interprete_referencia.py selftest
python3 tools/interprete_referencia.py test src/content/ejemplos_KOP_AWL.md
python3 tools/interprete_referencia.py export src/content/ejemplos_KOP_AWL.md src/content/banco_ejercicios.json
python3 tools/interprete_referencia.py traza programa.awl E0.0=1 MW30=10
```

**Orden de trabajo recomendado**
1. Leer el §1 a §3 de este documento y hojear `01` (secciones 1, 2 y 7).
2. Portar `04` a TypeScript (`src/core/`) y hacer que pase el banco desde Vitest (Fase 1).
3. Construir el simulador con editor AWL (Fase 1). Después el KOP (Fase 2) y el resto de modos (Fase 3).

---

## 1. Objetivo, usuario y principios

- **Usuario**: estudiante que prepara exámenes de programación de autómatas en KOP y AWL. Interfaz en **español**. Nemotécnica **alemana** (U, O, E, A, M, Z) por defecto, con opción inglesa.
- **Objetivo**: practicar sin PLC ni licencias de software. Escribir o dibujar programas, simularlos con un mini PLC, ver cómo se mueven el RLO y los acumuladores instrucción a instrucción, y corregir ejercicios tipo examen de forma automática.
- **Principios**
  1. **Fidelidad didáctica**: el simulador debe reproducir las trampas reales (evaluación secuencial de AWL, comparación que sustituye el RLO, `SPB` que deja RLO = 1, flancos de temporizadores, desbordamientos, orden de bytes…). Cuando se simplifica algo, se documenta (§6.15).
  2. **Determinismo**: mismo programa + mismas entradas + mismo número de ciclos = mismo resultado. El tiempo es **simulado**, nunca de reloj.
  3. **Todo local**: sin servidor, funciona sin conexión (PWA) y guarda el progreso en el navegador.
  4. **Explicar, no solo corregir**: cada fallo debe venir con un porqué (§9.4 y §9.5).

---

## 2. Alcance por fases

| Fase | Contenido | Criterio de salida |
|---|---|---|
| **1 — MVP AWL** | Núcleo de CPU portado de `04` (todas las instrucciones de `04`); editor AWL con resaltado y errores; simulador con panel de E/S, tabla de variables, panel T/Z, «Observar» por línea, paso a paso por instrucción y por ciclo; modos Ejemplos, Predice, Traza y Teoría; carga de `05` | 100 % del banco y del selftest en CI; la app abre y ejecuta todos los ejemplos |
| **2 — KOP** | Modelo KOP, editor gráfico, maquetación SVG, compilación KOP→AWL, flujo de corriente en línea, segmentos mixtos KOP/AWL; modo Traduce (KOP→AWL y AWL→KOP con dibujo); modelos KOP de E01–E25, C01–C04 y P01–P04 | Cada modelo KOP compilado pasa las mismas pruebas que su AWL |
| **3 — Práctica completa** | Modo Programa con equivalencia automática y avisos didácticos; Cronograma; Examen; progreso y repaso; analizador lógico (cronograma en vivo); forzado de variables; nemotécnica inglesa | Un examen de 10 preguntas se completa y corrige de principio a fin |
| **4 — Avanzado (opcional)** | FC/FB con interfaz y parámetros (`CALL` con `:=`, `#var`, DB de instancia); conversión AWL→KOP automática; plantas virtuales (§11); OB35/OB100 configurables; direccionamiento indirecto entre áreas | Según se defina |

---

## 3. Arquitectura

### 3.1 Plataforma recomendada

- **TypeScript + Vite + React** (o Svelte/Vue si se prefiere). Una sola página, **PWA** sin conexión, sin backend.
- **Editor de texto**: CodeMirror 6, con un modo AWL propio.
- **KOP**: SVG generado a partir del modelo (§7.4). No usar canvas: SVG es accesible y fácil de colorear.
- **Pruebas**: Vitest. El banco JSON se ejecuta como suite de pruebas del núcleo.
- **Persistencia**: `localStorage` (progreso, preferencias, programas del alumno), con exportar e importar en JSON.

### 3.2 Módulos

```text
src/
  core/                    ← puro TS, sin DOM, sin dependencias. 100 % testeable.
    constants.ts           parse de constantes (S5T#, C#, W#16#, L#, P#, REAL…)
    operands.ts            parse de operandos (E 0.0, MW 10, DB1.DBX 2.0, MW [MD 30]…)
    compiler.ts            texto AWL → Instr[] (metas, validación, errores en español)
    cpu.ts                 memoria, palabra de estado, ejecución, temporizadores, contadores
    trace.ts               registro por instrucción (para «Observar» y el modo Traza)
    testrunner.ts          ejecución de pruebas del banco (pasos / traza / cronograma)
    equivalence.ts         comparación de dos programas (§9.3)
    lint.ts                avisos didácticos (§9.4)
    explain.ts             explicaciones automáticas de cada fila de traza (§9.5)
  kop/
    model.ts               tipos del modelo KOP (§7.1)
    edit.ts                operaciones de edición (insertar en serie, rama paralela…)
    validate.ts            reglas de §7.2
    layout.ts              árbol → rejilla (§7.4)
    render.tsx             SVG
    compile.ts             KOP → AWL con mapa de origen (§7.5)
    flow.ts                flujo de corriente a partir de la traza (§7.6)
  ui/                      pantallas y componentes
  content/
    banco_ejercicios.json  = 05
    referencia_KOP_AWL.md  = 01
```

### 3.3 Flujo de datos

```text
 Editor AWL ─┐                                     ┌─► Observar (columnas por línea)
             ├─► Programa ─► compiler ─► Instr[] ─► cpu.step()/scan() ─► trace ─┼─► Flujo KOP (colores)
 Editor KOP ─┘   (segmentos)  (+ mapa de origen KOP)                           └─► Modo Traza / explicaciones
                                     ▲                     │
           Panel E/S, VAT, forzado ──┘                     └─► memoria ─► Panel E/S, VAT, T/Z, cronograma
```

### 3.4 Requisitos del núcleo (normativo)

- **Determinista y síncrono**: `scan()` ejecuta un ciclo completo y `stepInstruction()` ejecuta **una** instrucción. Para el paso a paso, el estado de ejecución (pc, pila de llamadas, pila de paréntesis, bloque actual, «dentro de un ciclo sí/no») tiene que ser explícito y reanudable. No vale una recursión de JS que no se pueda pausar.
- **Sin coma flotante de 64 bits en REAL**: todo resultado REAL se redondea a float32 con `Math.fround`. Los enteros se manejan con `| 0` y `>>> 0`, con cuidado al multiplicar: para `*D` usar `BigInt` o `Math.imul` y para `*I` hacer el producto exacto.
- **Rendimiento**: con programas de ejercicio (≤ 300 instrucciones) hay que llegar a ≥ 5000 ciclos/s en un portátil normal. Una prueba con `tiempo_ms: 30000` (3000 ciclos) debe tardar < 200 ms.

---

## 4. Modelo de la CPU (normativo)

### 4.1 Áreas de memoria

| Área | Tamaño en el simulador | Notas |
|---|---|---|
| Entradas físicas / periferia de entradas (PE) | 2048 bytes | `poner E0.0` y `poner PEW256` escriben aquí. `L PEW` lee aquí directamente |
| PAE (imagen de entradas, E) | 128 bytes (E0.0..E127.7) | Copia de la periferia al empezar el ciclo |
| PAA (imagen de salidas, A) | 128 bytes | Se copia a la periferia de salidas al final del ciclo |
| Periferia de salidas (PA) | 2048 bytes | `T PAW` escribe aquí **y** en la PAA si la dirección es < 128. `L PAW` → error de compilación |
| Marcas (M) | 2048 bytes | |
| Locales (L) | 256 bytes por llamada de bloque | Valen 0 al empezar el bloque (§6.15) |
| DB | Se crean automáticamente con 1024 bytes al usarlos | Más adelante: DB declarados por el ejercicio |
| Temporizadores | T0..T255 | §6.4 |
| Contadores | Z0..Z255 | §6.5 |

Orden de bytes **big-endian**: `MW10 = MB10·256 + MB11` (ver §2.2 de `01`).

### 4.2 Ciclo y tiempo

Cada `scan()` hace, en este orden:

1. **Temporizadores**: cada temporizador en marcha avanza `ciclo_ms` (por defecto 10 ms; configurable de 1 a 100 ms).
2. **Lectura de entradas**: PAE ← periferia[0..127].
3. **Programa**: se ejecuta OB100 si es el primer ciclo tras arrancar y luego OB1.
4. **Escritura de salidas**: periferia de salidas[0..127] ← PAA.

Si hay un error de ejecución, la CPU pasa a **STOP**: la PAA y la periferia de salidas se ponen a 0 y se guarda el motivo. En STOP, `scan()` no hace nada hasta que el alumno vuelva a poner RUN (lo que equivale a un rearranque).

El **tiempo simulado** = número de ciclos × `ciclo_ms`. La interfaz tiene varios modos:
- **Tiempo real**: en cada `requestAnimationFrame` se ejecutan los ciclos que correspondan al tiempo de pared transcurrido, con un máximo de 500 por frame.
- **×10** y **×100**.
- **Pausa**.
- **Paso de ciclo** y **paso de instrucción**.

### 4.3 Arranque, remanencia y borrado

- **RUN desde STOP (rearranque completo)**: se ponen a 0 la PAA, las marcas **no remanentes**, los temporizadores no remanentes y los contadores no remanentes, y se ejecuta OB100.
- **Remanencia por defecto**: MB0..MB15 y Z0..Z7. Ningún temporizador. Configurable.
- **MRES (borrado total)**: todo a 0, incluido lo remanente y los DB.
- Las pruebas del banco empiezan siempre con una CPU recién creada (todo a 0).

### 4.4 Registros y palabra de estado

ACU1, ACU2, AR1 y AR2 (32 bits); registros de DB abiertos (global e instancia); pila de paréntesis (7 niveles; cada entrada guarda la operación, el RLO, el OR y el /ER); pila MCR (8 niveles).

Palabra de estado: `/ER`(0) `RLO`(1) `STA`(2) `OR`(3) `OS`(4) `OV`(5) `A0/CC0`(6) `A1/CC1`(7) `RB/BIE`(8). Significado en el §7.2 de `01`.

### 4.5 Paso a STOP (normativo): causas y mensajes

| Causa | OB que haría falta | Mensaje (formato) |
|---|---|---|
| Cifra BCD no válida (`BTI`, `BTD`, `S Z`, valor de tiempo al arrancar un temporizador) | OB121 | «Error de conversión BCD: la cifra A no es válida…» / «Valor de tiempo no válido: 16#01F4 no es un S5TIME (¿falta S5T#?)» |
| Acceso fuera de rango (por ejemplo `MW 4000`) | OB121 | «Error de acceso al área M: la dirección 4000 está fuera de rango» |
| DB no abierto (`DBW 0` sin `AUF`) | OB121 | «No hay ningún bloque de datos abierto (falta AUF DB n)» |
| Llamada a un bloque inexistente | OB121 | «Llamada a un bloque que no existe: FC9» |
| Más de 7 niveles de paréntesis | OB121 | «Desbordamiento de la pila de anidamiento…» |
| Puntero indirecto con bit ≠ 0 en acceso a byte o palabra | OB121 | «Puntero no válido…» |
| Más de 1 000 000 de instrucciones en un ciclo | OB80 | «Tiempo de ciclo excedido (¿bucle infinito?)» |

Se muestran en la interfaz con el formato: `<mensaje> → OB121 no cargado → STOP`, junto con la línea donde ocurrió. El LED SF se enciende en rojo.

---

## 5. Sintaxis AWL (normativo)

### 5.1 Líneas

- Una instrucción por línea: `[META:] NEMÓNICO [OPERANDO] [// comentario]`. El `;` final es opcional (lo usan las fuentes AWL).
- **Mayúsculas y minúsculas** dan igual. Los espacios entre área y número son opcionales (`E 0.0` = `E0.0`).
- **Metas**: de 1 a 4 caracteres, empiezan por letra o `_`, y terminan en `:`. Pueden ir solas en una línea (se asignan a la siguiente instrucción). Si no hay siguiente instrucción, se añade un `NOP 0`. Las metas que empiezan por `_` están **reservadas para el compilador KOP** (§7.5): el editor no las permite al alumno.
- Se ignoran las líneas que empiezan por `NETWORK`, `SEGMENTO`, `TITLE`, `BEGIN` o `END_`. En el modelo de la app, los segmentos son objetos (§7.1). En texto plano, la línea `// Segmento n: título` es solo un comentario.
- Los paréntesis se escriben pegados (`U(`) o con espacio (`U (`). El cierre es `)`. MCR: `MCR(` y `)MCR`.

### 5.2 Gramática (EBNF)

```text
linea      = [ meta ":" ] [ instruccion ] [ comentario ] ;
meta       = ( letra | "_" ) { letra | digito | "_" } ;          (* máx. 4 *)
instruccion= nemonico [ operando ] ;
operando   = bit | memoria | temporizador | contador | constante | estado | bloque
           | indirecto | "STW" | "DBNO" | "DBLG" | "DINO" | "DILG" | "AR1" | "AR2" | simbolo ;
bit        = ( "E" | "A" | "M" | "L" | "DBX" | "DIX" ) byte "." bit07
           | "DB" n "." "DBX" byte "." bit07 ;
memoria    = ( "EB"|"EW"|"ED"|"AB"|"AW"|"AD"|"MB"|"MW"|"MD"|"LB"|"LW"|"LD"
             | "PEB"|"PEW"|"PED"|"PAB"|"PAW"|"PAD"|"DBB"|"DBW"|"DBD"|"DIB"|"DIW"|"DID" ) byte
           | "DB" n "." ( "DBB" | "DBW" | "DBD" ) byte ;
temporizador = "T" n ;   contador = "Z" n ;                     (* n = 0..255 *)
estado     = "OV" | "OS" | "BIE" | "==0" | "<>0" | ">0" | "<0" | ">=0" | "<=0" | "UO" ;
bloque     = ( "FC" | "FB" | "SFC" | "SFB" | "DB" | "DI" ) n ;
indirecto  = ( area_bit | prefijo_memoria ) "[" ( puntero32 | ( "AR1" | "AR2" ) "," "P#" byte "." bit07 ) "]" ;
puntero32  = "MD" n | "LD" n | "DBD" n | "DID" n ;
simbolo    = '"' texto '"' ;
```

### 5.3 Constantes

| Forma | Tipo | Valor cargado en ACU1 |
|---|---|---|
| `123`, `-5`, `+7` | INT si cabe en 16 bits, si no DINT | 16 bits (parte alta = 0, ver §6.15) |
| `L#100000` | DINT | 32 bits |
| `1.5`, `2.764800e+004`, `1e3` | REAL | IEEE 754 de 32 bits |
| `W#16#00FF`, `DW#16#…`, `B#16#1F`, `16#…` | WORD / DWORD / BYTE | |
| `2#0000000011111111` | WORD (≤ 16 dígitos) o DWORD | |
| `C#123` | BCD de 3 cifras (contadores) | `16#0123` |
| `S5T#5S`, `S5T#1M30S`, `S5T#500MS`, `S5TIME#…` | S5TIME | Base más fina en la que cabe (§3.3 de `01`) |
| `T#1M30S` | TIME | ms en 32 bits |
| `D#2026-10-13`, `TOD#12:30:00.000` | DATE / TOD | Días desde 1990-01-01 / ms desde las 0:00 |
| `B#(1,2)`, `B#(1,2,3,4)` | WORD / DWORD | |
| `'A'`, `'AB'` | CHAR | Código ASCII |
| `P#100.0`, `P#M100.0` | Puntero | Byte × 8 + bit (+ código de área en los bits 24..31 si lleva área) |

### 5.4 Símbolos

Hay una tabla de símbolos por programa con nombre, dirección, tipo y comentario. En el código se escribe `"Nombre"`. El editor autocompleta los símbolos y la vista puede mostrar símbolo o dirección absoluta (como *Ver → Representación simbólica*). Las variables `#local` son de la Fase 4.

### 5.5 Nemotécnica inglesa

Es una preferencia del usuario. El compilador acepta las dos traduciendo de inglés a alemán (tabla `EN2DE` de `04` y §11 de `01`). La vista puede mostrar el mismo programa en cualquiera de las dos. **Ojo**: `SE` en inglés = `SV` en alemán, y `SD` en inglés = `SE` en alemán. Los operandos `I`/`Q`/`C` se convierten en `E`/`A`/`Z`.

### 5.6 Errores de compilación

Llevan número de línea y un mensaje en español, igual que en `04`. Por ejemplo:
- `Línea 1: E 0.8: el número de bit va de 0 a 7`
- `Línea 4: la meta FIN no existe`
- `Línea 2: instrucción desconocida: XYZ`
- `Falta cerrar paréntesis: hay más "(" que ")"`
- `Línea 1: operando no válido para =: MW 10`
- `Línea 1: la periferia de salidas (PA) no se puede leer`
- `ENT solo existe en CPU con 4 acumuladores`

El editor los subraya en rojo. Un programa con errores no se puede pasar a RUN.

---

## 6. Semántica de ejecución (normativo)

> Resumen de lo que implementa `04` (métodos `_exec`, `_logic`, `_timer_start`, `_update_timers`, `_conv`). En caso de duda, leer el código.

### 6.1 Lógica de bits

Con `v` = valor del operando y `x` = `v` (o `¬v` en las variantes con N):

| Instrucción | RLO nuevo | Después |
|---|---|---|
| `U` / `UN` | `(/ER ? RLO ∧ x : x) ∨ OR` | /ER = 1, STA = v, OR sin cambio |
| `O` / `ON` | `(/ER ? RLO ∨ x : x) ∨ OR` | /ER = 1, STA = v, OR = 0 |
| `X` / `XN` | `(/ER ? RLO ⊕ x : x) ∨ OR` | /ER = 1, STA = v, OR = 0 |
| `O` (sin operando) | sin cambio | si /ER = 1 → OR = RLO; /ER = 0; STA = 1 |
| `NOT` | ¬RLO | OR = 0, STA = 1 |
| `SET` / `CLR` | 1 / 0 | /ER = 0, OR = 0, STA = RLO |
| `SAVE` | — | RB = RLO |
| `= op` | — | op = RLO (0 si el MCR está activo y desconectado); /ER = 0, OR = 0, STA = valor escrito |
| `S op` / `R op` (bit) | — | si RLO = 1 (y MCR ok) → op = 1 / 0; /ER = 0, OR = 0, STA = valor del bit |
| `FP m` / `FN m` | `RLO ∧ ¬m_ant` / `¬RLO ∧ m_ant` | m = RLO de entrada; /ER = 1, OR = 0 |

Valores de los **operandos de estado**: `OV`, `OS`, `BIE` (RB); `==0` (A1 = 0, A0 = 0); `<>0` (A1 ≠ A0); `>0` (10); `<0` (01); `>=0` (A0 = 0); `<=0` (A1 = 0); `UO` (11). Los temporizadores (`U T 1`) dan su Q. Los contadores (`U Z 1`) dan 1 si el valor es mayor que 0.

### 6.2 Paréntesis

`U(` `UN(` `O(` `ON(` `X(` `XN(` guardan en la pila (operación, RLO, OR, /ER) y luego ponen /ER = 0, OR = 0, STA = 1. El RLO no cambia.

`)` saca lo guardado, restaura RLO, OR y /ER, y aplica la operación guardada como si el operando fuera el RLO interior. Así `U( … )` funciona como un `U` con un operando calculado. Después, STA = 1.

### 6.3 Instrucciones que **no** tocan el RLO ni /ER

`L`, `LC`, `T`, toda la aritmética, las conversiones, la lógica de palabras, los desplazamientos, `TAK`, `PUSH`, `POP`, `INC`, `DEC`, `+`, `SPA`, los saltos por A1/A0/OV/OS, `LOOP`, `AUF` y `NOP`. Una cadena lógica sigue «por encima» de ellas.

### 6.4 Temporizadores

Cada temporizador tiene: base (0..3 → 10 ms, 100 ms, 1 s, 10 s), valor (0..999 unidades de la base), en marcha (sí/no), Q, **memoria de flanco de S** (`prev_s`), memoria de flanco de FR, acumulador de ms y tipo.

**Actualización** (paso 1 del ciclo): si está en marcha, `acc += ciclo_ms`. Mientras `valor > 0` y `acc ≥ base`: `valor -= 1` y `acc -= base`. Si `valor == 0`, termina: en marcha = no, y Q = 1 si el tipo es SE o SS, o Q = 0 si es SI, SV o SA.

**Instrucción de arranque** (`SI`/`SV`/`SE`/`SS`/`SA T n`), con `RLO` actual, `flanco = RLO ∧ ¬prev_s`, `caída = ¬RLO ∧ prev_s`, y después `prev_s = RLO`. «Cargar» = leer la base y el valor del S5TIME que hay en ACU1-L (si no es BCD válido → STOP), poner `acc = 0` y en marcha = sí.

| Tipo | Flanco de S | S = 0 | Al terminar |
|---|---|---|---|
| **SI** impulso | cargar, Q = 1 | parar, Q = 0 | Q = 0 |
| **SV** impulso prolongado | cargar (también si ya estaba en marcha: redisparo), Q = 1 | nada | Q = 0 |
| **SE** retardo a la conexión | cargar, Q = 0 | parar, Q = 0 | Q = 1 (se mantiene mientras S = 1) |
| **SS** retardo con memoria | cargar, Q = 0 | nada | Q = 1 hasta `R T n` |
| **SA** retardo a la desconexión | (S = 1) → parar, Q = 1 | en la **caída**: cargar, Q = 1 | Q = 0 |

- **`R T n`** con RLO = 1: en marcha = no, valor = 0, base = 0 y Q = 0. **No borra `prev_s`**, así que si S sigue a 1 el temporizador no vuelve a arrancar hasta un nuevo flanco (ejemplo E12).
- **`FR T n`**: en un flanco positivo de su RLO pone `prev_s = 0`. Así el siguiente arranque con S = 1 cuenta como flanco.
- **`L T n`** = valor restante en binario (unidades de la base). **`LC T n`** = `(base << 12) | BCD(valor)`.
- Todas cierran la cadena (/ER = 0, OR = 0).

### 6.5 Contadores

Cada contador tiene: valor (0..999) y memorias de flanco para ZV, ZR, S y FR.
- **ZV**: en flanco, +1 (máximo 999).
- **ZR**: en flanco, −1 (mínimo 0).
- **`S Z n`**: en flanco, valor = BCD(ACU1-L & 0xFFF) (si no es BCD válido → STOP).
- **`R Z n`**: si RLO = 1, valor = 0 (por nivel).
- **`FR Z n`**: en flanco, borra las tres memorias de flanco.
- **`L Z n`** = binario; **`LC Z n`** = BCD; **Q** = valor > 0.

### 6.6 Carga y transferencia

- **`L op`**: ACU2 = ACU1 y ACU1 = valor. Bytes y palabras se cargan con **ceros a la izquierda**.
- **`T op`**: escribe 1, 2 o 4 bytes de la parte baja de ACU1. Es **incondicional** (excepto con el MCR desconectado, que escribe 0).
- **`L STW` / `T STW`**: leen y escriben la palabra de estado.
- **`LAR1`/`LAR2`**: sin operando cargan desde ACU1; también aceptan una constante puntero, un MD o el otro AR.
- **`TAR1`/`TAR2`**: sin operando, ACU2 = ACU1 y ACU1 = AR; con operando, escriben en un MD o en el otro AR.
- **`+AR1`/`+AR2`**: suman la constante, o ACU1-L con signo si no llevan operando.

### 6.7 Aritmética y bits de estado

- **`+I` / `-I`**: r = ACU2-L ± ACU1-L (INT exacto). Se guarda w = r recortado a 16 bits en ACU1-L; **ACU1-H no cambia**. A1/A0 según el signo de **w**; OV = (r ≠ w); OS |= OV. Ejemplo: 30000 + 10000 → −25536, A1A0 = 01, OV = 1.
- **`*I`**: producto exacto en ACU1 (32 bits). A1/A0 según el signo real; OV si no cabe en INT.
- **`/I`**: con divisor 0 → A1A0 = 11, OV = OS = 1 y ACU1 no cambia. Si no, cociente truncado hacia 0 en ACU1-L y **resto** (con el signo del dividendo) en ACU1-H.
- **`+D` / `-D` / `*D` / `/D` / `MOD`**: igual que las INT pero con 32 bits. `/D` deja solo el cociente y `MOD` solo el resto.
- **REAL** (`+R`…`/R`, `SQR`, `SQRT`, `EXP`, `LN`, `SIN`…`ATAN`): se calcula y se redondea a float32. Si sale NaN → A1A0 = 11 y OV = 1; ±inf → A1A0 = 10/01 y OV = 1; subdesbordamiento a 0 → A1A0 = 00 y OV = 1; resultado normal → A1A0 según el signo y OV = 0. OS |= OV. `ABS` solo borra el bit de signo y no toca el estado.
- **`+ cte`**: suma sin tocar el estado (16 bits si la constante es INT, 32 si es DINT).
- **`INC n` / `DEC n`**: solo sobre ACU1-LL, sin acarreo.
- **OS** se borra con `SPS`, al llamar a un bloque y al terminar un bloque (también al final de cada OB1).

### 6.8 Comparación

`==I`, `<>I`, `>I`, `<I`, `>=I`, `<=I` (y `…D`, `…R`) comparan **ACU2 con ACU1**. El resultado **sustituye** al RLO. Después: /ER = 1, OR = 0, STA = resultado, A1/A0 = 10 (ACU2 > ACU1), 01 (menor) o 00 (igual) y OV = 0. Con REAL NaN: resultado 0, A1A0 = 11, OV = OS = 1.

### 6.9 Conversiones

| Instr. | Efecto |
|---|---|
| `BTI` | BCD de 3 cifras de ACU1-L (signo en el bit 15) → INT en ACU1-L. Cifra > 9 → STOP |
| `ITB` | INT → BCD con signo `F` en el nibble alto. Si \|v\| > 999 → OV = OS = 1 y no convierte |
| `BTD` / `DTB` | Igual con 7 cifras (signo en el bit 31) |
| `ITD` | Extiende el signo de 16 a 32 bits |
| `DTR` | DINT → REAL |
| `RND` | Al entero más próximo; **en x,5 al par** (2,5 → 2; 3,5 → 4) |
| `TRUNC` / `RND+` / `RND-` | Hacia 0 / hacia +∞ / hacia −∞. Fuera de rango o NaN → OV = OS = 1 y no convierte |
| `INVI` / `INVD` | Complemento a 1 |
| `NEGI` / `NEGD` | Complemento a 2 (actualizan A1/A0 y OV) |
| `NEGR` | Cambia el bit de signo |
| `CAW` / `CAD` | Intercambian bytes |

### 6.10 Lógica de palabras y desplazamientos

- **`UW`/`OW`/`XOW`**: con constante operan sobre ACU1-L y la constante; sin constante, sobre ACU1-L y ACU2-L. **`UD`/`OD`/`XOD`** igual con 32 bits. Después: A1 = (resultado ≠ 0), A0 = 0, OV = 0.
- **`SLW`/`SRW`/`SSI`** (16 bits; ACU1-H no cambia) y **`SLD`/`SRD`/`SSD`/`RLD`/`RRD`** (32 bits): n = constante, o ACU2-LL si no hay constante.
  - Con n = 0 no hacen nada.
  - Si no: A1 = último bit que ha salido (en las rotaciones, el bit que ha dado la vuelta), A0 = 0 y OV = 0.
  - SSI y SSD rellenan con el signo.
- **`RLDA`/`RRDA`**: rotan un bit pasando por A1.

### 6.11 Saltos

- **`SPA`**: salta siempre.
- **`SPB` / `SPBN`** (y `SPBB` / `SPBNB`, que además copian el RLO a RB): saltan si RLO = 1 / 0 y, **salten o no**, dejan RLO = 1, /ER = 0, OR = 0 y STA = 1.
- **`SPBI` / `SPBIN`**: saltan según RB y dejan /ER = 0, OR = 0, STA = 1.
- **`SPO`** (OV), **`SPS`** (OS, y lo borra), **`SPZ`**, **`SPN`**, **`SPP`**, **`SPM`**, **`SPPZ`**, **`SPMZ`**, **`SPU`**: saltan según A1/A0.
- **`LOOP`**: ACU1-L −= 1 (en 16 bits) y salta si es ≠ 0. Con 0 de entrada da 65535 vueltas de más.
- **`SPL`**: va seguido de *k* instrucciones `SPA` y de su meta. Si ACU1-LL < k salta al `SPA` número ACU1-LL; si no, a la meta.

### 6.12 Bloques

- **`BE`, `BEA`**: fin de bloque.
- **`BEB`**: fin de bloque si RLO = 1. Si no, deja RLO = 1, /ER = 0 y OR = 0.
- **`AUF DB n` / `AUF DI n`**: abren el DB. Una dirección completa (`DB1.DBW 0`) también abre el DB.
- **`UC FCn`**: llamada incondicional. **`CC FCn`**: llamada si RLO = 1. **`CALL FCn`** sin parámetros = `UC`.
- Cada llamada tiene su propia área L y, al entrar y al salir, pone /ER = 0, OR = 0 y OS = 0.
- La profundidad máxima de llamadas es 16. Los `CALL` con parámetros (`:=`) y los FB con DB de instancia son de la Fase 4.

### 6.13 MCR

- `MCRA` activa el área MCR y `MCRD` la desactiva.
- `MCR(` mete el RLO en la pila MCR (8 niveles) y `)MCR` lo saca.
- Con el área activa y algún 0 en la pila: `=` y `T` escriben 0, y `S`/`R` no actúan.

### 6.14 Direccionamiento indirecto

- **Por memoria**: `MW [MD 30]` o `E [MD 2]`. El puntero (MD, LD, DBD o DID) contiene `byte × 8 + bit`.
- **Por registro, dentro del área**: `MW [AR1, P#2.0]` usa `(AR1 & 0xFFFFFF) + desplazamiento`.
- En accesos a byte, palabra o doble palabra, el bit tiene que ser 0 (si no → STOP).
- El indirecto **entre áreas** (`W [AR1, P#0.0]` con el área dentro de AR1) es de la Fase 4.

### 6.15 Decisiones del simulador (documentar en la ayuda de la app)

Donde la CPU real no está definida o el detalle no aporta nada al examen:

1. **Al empezar cada OB1**, la palabra de estado y ACU1/ACU2 valen 0. En la CPU real arrastran valores anteriores.
2. **`L -5`** (constante INT) carga 16 bits con ACU1-H = 0, igual que `L MW`. Para un DINT hay que usar `L L#-5`.
3. **`NOT`** pone OR = 0: invierte la expresión completa.
4. **`RND` redondea al par en x,5**, según el manual de AWL. Si cae en el examen, conviene comprobarlo en una CPU real.
5. **Temporizadores**: se actualizan al principio del ciclo en pasos de `ciclo_ms`. Un temporizador arrancado con valor 0 termina en el ciclo siguiente. **SS** se reinicia con cada flanco aunque ya haya terminado (Q = 0 mientras cuenta). En **SA**, con S = 1, Q sigue a S por nivel.
6. **`)`** no restaura RB.
7. **STA** después de `=`, `S` o `R` es el valor del bit tras la instrucción.
8. Los **datos L** empiezan a 0. Fase 3: opción «modo realista» que los llena con basura aleatoria para practicar la trampa §9.17 de `01`.
9. El **vigilante de ciclo** cuenta instrucciones (1 000 000), no milisegundos.
10. **No hay OB de error del usuario**: todo error lleva a STOP con el mensaje correspondiente.
11. `X`/`XN` justo después de un `O` sin operando no tiene un significado práctico. Se aplica la fórmula del §6.1.

---

## 7. KOP

### 7.1 Modelo de datos (TypeScript)

```ts
type Operando = string;            // texto AWL normalizado: "E 0.0", "MW 30", "T 1", "S5T#5S", '"Marcha"'
type Id = string;                  // único dentro del programa (para el mapa de origen)

type Elem =                                                     // elementos de la lógica (en serie o paralelo)
  | { k: 'NA'; id: Id; op: Operando }                            // --| |--
  | { k: 'NC'; id: Id; op: Operando }                            // --|/|--
  | { k: 'NOT'; id: Id }                                         // --|NOT|--
  | { k: 'P' | 'N'; id: Id; mem: Operando }                      // --(P)-- / --(N)--  flanco del RLO
  | { k: 'POS' | 'NEG'; id: Id; op: Operando; mem: Operando }    // cuadro de flanco de un operando
  | { k: 'CON'; id: Id; op: Operando }                           // --(#)--  conector
  | { k: 'CMP'; id: Id; fn: FnCmp; in1: Operando; in2: Operando }// cuadro comparador (va en serie)
  | { k: 'SER'; id: Id; items: Elem[] }                          // serie (Y)
  | { k: 'PAR'; id: Id; ramas: Elem[] };                         // paralelo (O), ≥ 2 ramas

type FnCmp = `${'=='|'<>'|'>'|'<'|'>='|'<='}${'I'|'D'|'R'}`;

type Salida =
  | { k: 'BOB' | 'S' | 'R'; id: Id; op: Operando }               // ( ) (S) (R)   — R admite T n / Z n
  | { k: 'SAVE'; id: Id }
  | { k: 'SI'|'SV'|'SE'|'SS'|'SA'; id: Id; t: Operando; tw: Operando }   // bobinas de temporizador
  | { k: 'ZV' | 'ZR'; id: Id; z: Operando } | { k: 'SZ'; id: Id; z: Operando; zw: Operando }
  | { k: 'JMP' | 'JMPN'; id: Id; meta: string } | { k: 'RET'; id: Id } | { k: 'CALL'; id: Id; bloque: string }
  | Cuadro;

type Cuadro =
  | { k: 'TEMP'; id: Id; tipo: 'S_IMPULS'|'S_VIMP'|'S_EVERZ'|'S_SEVERZ'|'S_AVERZ';
      t: Operando; tw: Operando; pinR?: Elem; dual?: Operando; dez?: Operando; q?: Rama[] }
  | { k: 'CONT'; id: Id; tipo: 'Z_VORW'|'Z_RUECK'|'ZAEHLER'; z: Operando;
      pinZR?: Elem; pinS?: Elem; zw?: Operando; pinR?: Elem; dual?: Operando; dez?: Operando; q?: Rama[] }
  | { k: 'BIEST'; id: Id; tipo: 'SR' | 'RS'; op: Operando; pin2: Elem; q?: Rama[] }   // pin2 = R en SR, S en RS
  | { k: 'BOX'; id: Id; fn: FnBox; p: Record<string, Operando>; eno?: Rama[] };       // MOVE, ADD_I, I_BCD…

type FnBox = 'MOVE'|'ADD_I'|'SUB_I'|'MUL_I'|'DIV_I'|'ADD_DI'|'SUB_DI'|'MUL_DI'|'DIV_DI'|'MOD_DI'
  |'ADD_R'|'SUB_R'|'MUL_R'|'DIV_R'|'ABS'|'SQR'|'SQRT'|'EXP'|'LN'|'SIN'|'COS'|'TAN'|'ASIN'|'ACOS'|'ATAN'
  |'BCD_I'|'I_BCD'|'BCD_DI'|'DI_BCD'|'I_DI'|'DI_R'|'ROUND'|'TRUNC'|'CEIL'|'FLOOR'
  |'INV_I'|'INV_DI'|'NEG_I'|'NEG_DI'|'NEG_R'
  |'WAND_W'|'WOR_W'|'WXOR_W'|'WAND_DW'|'WOR_DW'|'WXOR_DW'
  |'SHL_W'|'SHR_W'|'SHR_I'|'SHL_DW'|'SHR_DW'|'SHR_DI'|'ROL_DW'|'ROR_DW';

interface Rama { pre?: Elem; salida: Salida }          // pre = contactos entre el punto de bifurcación y la salida

interface SegmentoKOP {
  id: Id; titulo?: string; comentario?: string;
  meta?: string;                                       // LABEL al principio del segmento
  entrada: Elem;                                       // SER; vacía (items = []) = unida a la barra
  salidas: Rama[];                                     // ≥ 1
}
type Segmento = { lang: 'KOP'; kop: SegmentoKOP } | { lang: 'AWL'; id: Id; titulo?: string; comentario?: string; awl: string };
interface Bloque   { nombre: string; segmentos: Segmento[] }          // 'OB1', 'OB100', 'FC1'…
interface Programa { bloques: Bloque[]; simbolos: { nombre: string; dir: Operando; tipo: string; comentario?: string }[] }
```

**Pin principal**: la lógica de `entrada` alimenta el primer pin del cuadro.
- TEMP → S
- CONT → ZV (en Z_VORW y ZAEHLER) o ZR (en Z_RUECK)
- BIEST → S en SR y R en RS
- BOX → EN

El resto de pines booleanos (`pinR`, `pinZR`, `pinS`, `pin2`) tienen su propia lógica.

### 7.2 Reglas de validación

1. Todo operando está relleno. Uno vacío se muestra en rojo como `??.?`.
2. El tipo del operando corresponde al elemento: los contactos y las bobinas llevan un bit, T o Z (`R` admite T/Z); `CMP…I` lleva palabras o INT; `…R` lleva MD o REAL; `tw` es un S5TIME o una palabra; `zw` es `C#` o una palabra.
3. `NOT`, `P`, `N` y `CON` no pueden ser el primer elemento de la cadena: necesitan lógica a su izquierda.
4. Un `PAR` tiene al menos 2 ramas y ninguna vacía.
5. Las salidas `JMP`, `JMPN`, `RET` y `CALL` van solas en su segmento.
6. Las metas son únicas en el bloque y no empiezan por `_`.
7. Avisos (no errores): una misma bobina `( )` en dos segmentos (§9.4); una marca de flanco usada dos veces.

### 7.3 Edición

- **Selección**: un elemento, una salida o un rango contiguo dentro de una serie (Mayús + clic).
- **Operaciones** (en `kop/edit.ts`, todas puras y con deshacer/rehacer):
  - Insertar en serie antes o después.
  - **Rama paralela**: envuelve el rango seleccionado en un `PAR` con una rama nueva con un contacto `??.?`.
  - Añadir otra rama al `PAR`.
  - Añadir una salida en paralelo.
  - Cambiar NA ↔ NC.
  - Borrar. Normaliza el árbol: un `SER` de 1 elemento se sustituye por ese elemento; un `PAR` de 1 rama se deshace; un `SER` anidado en otro se aplana.
- **Atajos de teclado**: **F2** contacto NA, **F3** contacto NC, **F7** bobina, **F8** abrir rama (= rama paralela sobre la selección), **F9** cerrar rama, **Ctrl+K** catálogo de elementos. El catálogo se agrupa por tipo de operación: operaciones lógicas con bits, comparación, conversión, contadores, temporizadores, saltos, enteros, coma flotante, transferencia, control del programa, desplazamiento y rotación, bits de estado, lógica de palabras.
- **Edición de operandos** en el sitio, con autocompletado de símbolos y direcciones.
- **Móvil**: tocar un elemento lo selecciona y la paleta aparece en una hoja inferior.

### 7.4 Maquetación y dibujo

Rejilla de celdas (por ejemplo, 96 × 56 px). Tamaños:
- Contacto, NOT, P/N, CON: 1 × 1.
- CMP, POS/NEG: 2 × 3.
- `SER`: suma de anchos × máximo de altos.
- `PAR`: máximo de anchos × suma de altos.

Colocación recursiva: una serie de izquierda a derecha; un paralelo de arriba abajo, con un conector vertical a la izquierda y otro a la derecha, y cable horizontal de relleno en las ramas cortas. Las salidas van **alineadas en la columna derecha**. Si hay varias, se apilan con un conector vertical en el punto de bifurcación y sus `pre` delante.

Los cuadros (TEMP 3 × 5, CONT 3 × 7, BOX 3 × n) llevan los pines de entrada a la izquierda y los de salida a la derecha. La lógica de cada pin secundario se dibuja en su fila, a la izquierda del pin.

Convenciones de dibujo (compatibles con los esquemas ASCII de `01`/`02`):
- Operando encima del elemento y símbolo debajo en gris.
- Barra de alimentación izquierda vertical.
- Título y comentario del segmento arriba.

**Estados** (en línea): cable con corriente **verde continuo y más grueso**; sin corriente, **azul discontinuo**; no ejecutado (saltado), **gris**. El grosor y el trazo distinguen los estados sin depender solo del color.

### 7.5 Compilación KOP → AWL (normativo en cuanto al resultado)

El AWL generado no tiene que coincidir letra por letra con el que escribiría una persona, pero **debe ser equivalente** y legible. Cada instrucción lleva el `id` del elemento KOP del que viene (mapa de origen).

```text
segmento(s):
  si s.meta: la meta se asigna a la primera instrucción del segmento
  si s.entrada vacía y la salida no es JMP/CALL: emitir SET
  si no: serie(s.entrada.items, primero = true)
  si ninguna rama tiene pre: para cada rama → salida(rama.salida)
  si no: tmp = nuevo bit L (L 20.0, L 20.1…; en OB1 las temporales empiezan en LB20)
         emitir "= tmp";  para cada rama: "U tmp"; serie(rama.pre.items, false); salida(rama.salida)

serie(items, primero):
  para cada e (i = índice); ini = primero && i == 0:
    NA → U op         NC → UN op        NOT → NOT        P → FP mem      N → FN mem
    POS/NEG → U( / U op / FP|FN mem / )
    CON → = op / U op                                         (re-lee el bit para seguir la cadena)
    CMP → ini ? (L in1 / L in2 / fn) : (U( / L in1 / L in2 / fn / ))
    SER → serie(e.items, ini)
    PAR → ini ? ramasO(e) : (U( / ramasO(e) / ))

ramasO(par): para cada rama r:
    NA → O op   NC → ON op   PAR → ramasO(r)
    CMP → O( / L in1 / L in2 / fn / )
    SER → O( / serie(r.items, true) / )

salida(o):
  BOB → = op     S → S op     R → R op     SAVE → SAVE
  SI…SA → L tw / SI…SA t        ZV → ZV z   ZR → ZR z   SZ → L zw / S z
  JMP → (entrada vacía ? SPA : SPB) meta     JMPN → SPBN meta     RET → BEB
  CALL → (entrada vacía ? UC : CC) bloque
  TEMP → L tw / S?  t ; [pinR: serie(pinR, true) / R t] ; [dual: L t / T dual] ; [dez: LC t / T dez]
         [q: para cada rama: U t ; serie(pre, false) ; salida]
  CONT → (ZV|ZR) z ; [pinZR: serie / ZR z] ; [pinS: serie / L zw / S z] ; [pinR: serie / R z]
         [dual: L z / T dual] ; [dez: LC z / T dez] ; [q: U z …]
  BIEST SR → S op ; serie(pin2) / R op ; [q: U op …]
  BIEST RS → R op ; serie(pin2) / S op ; [q: U op …]
  BOX  → SPBNB _nnn / <cuerpo> / <fin> / _nnn: U BIE ; [eno: ramas]   (_nnn = _001, _002… por bloque)
```

Cuerpo y fin de cada cuadro BOX:

| Cuadro | Cuerpo | Fin (pone RB = ENO) |
|---|---|---|
| `MOVE` | `L IN / T OUT` | `SET / SAVE / CLR` |
| `ADD_I` `SUB_I` `MUL_I` `DIV_I` (y `_DI`, `MOD_DI`, `_R`) | `L IN1 / L IN2 / +I… / T OUT` | `UN OV / SAVE / CLR` |
| `ABS` `SQR` `SQRT` `EXP` `LN` `SIN`…`ATAN` | `L IN / fn / T OUT` | `UN OV / SAVE / CLR` |
| `I_BCD` `DI_BCD` `ROUND` `TRUNC` `CEIL` `FLOOR` `NEG_I` `NEG_DI` | `L IN / ITB|DTB|RND|TRUNC|RND+|RND-|NEGI|NEGD / T OUT` | `UN OV / SAVE / CLR` |
| `BCD_I` `BCD_DI` `I_DI` `DI_R` `INV_I` `INV_DI` `NEG_R` | `L IN / BTI|BTD|ITD|DTR|INVI|INVD|NEGR / T OUT` | `SET / SAVE / CLR` |
| `WAND_W`…`WXOR_DW` | `L IN1 / L IN2 / UW|OW|XOW|UD|OD|XOD / T OUT` | `SET / SAVE / CLR` |
| `SHL_W` `SHR_W` `SHR_I` `SHL_DW` `SHR_DW` `SHR_DI` `ROL_DW` `ROR_DW` | `L N / L IN / SLW|SRW|SSI|SLD|SRD|SSD|RLD|RRD / T OUT` | `SET / SAVE / CLR` |

**Ejemplos esperados** (equivalentes a los de `02`):

```text
E06 (enclavamiento)               →  O E 0.0 / O A 4.0 / U E 0.1 / = A 4.0
      [PAR(NA E0.0, NA A4.0), NA E0.1] → ( )A4.0       (PAR al principio: O sin paréntesis)
E05  [NA E0.0, PAR(NA E0.1, NA E0.2)] → ( )A4.1  →  U E 0.0 / U( / O E 0.1 / O E 0.2 / ) / = A 4.1
E04  [PAR(SER(E0.0,E0.1), SER(E0.2,E0.3))] → ( )  →  O( / U E 0.0 / U E 0.1 / ) / O( / U E 0.2 / U E 0.3 / ) / = A 4.0
E12  TEMP S_EVERZ T1 (S = NA E0.0, TW = S5T#5S, R = NA E0.1, DUAL MW10, DEZ MW12, Q → ( )A4.0)
     →  U E 0.0 / L S5T#5S / SE T 1 / U E 0.1 / R T 1 / L T 1 / T MW 10 / LC T 1 / T MW 12 / U T 1 / = A 4.0
E20  [NA E2.0, CMP >I MW30 500] → ( )A5.6  →  U E 2.0 / U( / L MW 30 / L 500 / >I / ) / = A 5.6
MOVE con EN = E0.0, IN = MW10, OUT = MW12, ENO → ( )A4.0
     →  U E 0.0 / SPBNB _001 / L MW 10 / T MW 12 / SET / SAVE / CLR / _001: U BIE / = A 4.0
```

**Prueba obligatoria**: para cada ejercicio con modelo KOP, `compilar(kop)` debe superar las pruebas del ejercicio en el núcleo.

### 7.6 Flujo de corriente en línea (estado del programa)

1. Al ejecutar el segmento, la traza guarda para cada instrucción su `id` de origen y el estado que deja (STA, RLO…).
2. **Condición de cada contacto** = STA de su instrucción `U`/`UN`/`O`/`ON` (el valor real del bit en ese momento). Un contacto conduce si NA y STA = 1, o NC y STA = 0. Lo mismo para P/N y POS/NEG (RLO de salida de su `FP`/`FN`) y para CMP (resultado de la comparación).
3. **Flujo**: se evalúa el árbol con esas condiciones: `flujo_salida(SER) = cada elemento con la entrada del anterior`; `flujo_salida(PAR) = O de las ramas`; `contacto: salida = entrada ∧ conduce`; `NOT: salida = ¬entrada`. La barra izquierda siempre tiene corriente.
4. **Salidas**: una bobina tiene corriente si su entrada la tiene. En los cuadros, Q/ENO es el RLO tras `U t` / `U z` / `U BIE` en la traza.
5. Los elementos de un segmento **no ejecutado** (por un salto) se pintan de gris.
6. Si una instrucción se ejecuta varias veces en el ciclo (bucles), se usa la **última** ejecución.

### 7.7 AWL → KOP (Fase 4)

Se reconoce el patrón inverso de §7.5 por segmento. Si un segmento no encaja (acumuladores sueltos, `O` sin operando en posición rara, saltos internos), se queda en AWL y se muestra el aviso «Este segmento no tiene representación en KOP».

---

## 8. Interfaz

### 8.1 Pantallas

```text
Inicio ─┬─ Aprender        (01 navegable por capítulos, con «Probar» en cada bloque awl)
        ├─ Ejemplos        (02-E: ver, ejecutar, modificar)
        ├─ Practicar ──┬── Predice el resultado (Q)
        │              ├── Traza (T)
        │              ├── Traduce KOP ↔ AWL (C)
        │              ├── Programa (P)
        │              ├── Cronograma (R)
        │              └── Teoría (M)
        ├─ Examen          (mezcla con tiempo y nota)
        ├─ Simulador libre (programa en blanco)
        └─ Progreso / Ajustes (nemotécnica, ciclo_ms, remanencia, tema)
```

### 8.2 Simulador (escritorio)

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ Práctica PLC · E12 Retardo a la conexión                   Nemotécnica: DE ▾  │
├────────────────────────────────────┬──────────────────────────────────────────┤
│ OB1 ▾  Seg. 1 «Temporizador» [KOP|AWL] │ CPU  [RUN ●]  SF ○  FRCE ○              │
│                                    │ ⏵ Tiempo real  ⏸  ⏭ ciclo  ⏭ instrucción  │
│   editor KOP o AWL                 │ ciclo 1 234 · t = 12,34 s · 10 ms/ciclo    │
│   (con «Observar»: colores en KOP, ├──────────────────────────────────────────┤
│    columnas RLO/STA/ACU1… en AWL)  │ ENTRADAS  [E0.0 Marcha ⏺] [E0.1 Paro NC ⏺] │
│                                    │ SALIDAS   ● A4.0 Motor   ○ A4.1           │
│                                    │ ANALÓG.   PEW256 ▕████░░░░▏ 13824         │
│                                    ├──────────────────────────────────────────┤
│                                    │ [Variables] [T/Z] [Cronograma] [Pal. estado] │
│                                    │  MW 10   DEC   400                        │
│                                    │  MW 12   S5T   S5T#4S                     │
├────────────────────────────────────┴──────────────────────────────────────────┤
│ ✔ Compilado · ⚠ A 4.0 se asigna en dos sitios (líneas 3 y 9) — ver §9.1 de la teoría │
└───────────────────────────────────────────────────────────────────────────────┘
```

- **Entradas**: cada E se configura como **pulsador NA** (1 mientras se pulsa), **pulsador NC** (1 en reposo y 0 mientras se pulsa), **interruptor** (cambia con cada clic) o **sensor**. Atajos de teclado configurables (por ejemplo, 1–8 → E0.0–E0.7). Etiqueta con el símbolo.
- **Salidas**: LED por bit; display de 7 segmentos opcional para AW en BCD; barra para PAW.
- **Analógicas**: deslizador 0..27648 (con rebase hasta 32767) y campo numérico.
- **Tabla de variables (VAT)**: operando + formato (BOOL, BIN, HEX, DEC, BCD, REAL, S5TIME, TIME, CHAR) + valor. Se puede editar («Forzar valor» una vez) y, en la Fase 3, **forzar de forma permanente**: se reaplica en cada ciclo después de leer la PAE y se enciende el LED FRCE.
- **Panel T/Z**: cada T usado muestra tipo, estado (parado, contando, terminado), tiempo restante con barra, base y Q. Cada Z muestra valor y Q.
- **Cronograma (analizador lógico)**: se eligen señales (bits, o palabras como valor). Guarda en un búfer circular una muestra por ciclo (o por intervalo) y tiene zoom, cursor con lectura de tiempo y exportación a PNG o CSV. Es imprescindible para entender los temporizadores.
- **Palabra de estado**: vista en vivo de /ER RLO STA OR OS OV A1 A0 RB, ACU1, ACU2, AR1, AR2 y los DB abiertos (en hexadecimal y decimal).

### 8.3 Editor AWL

- CodeMirror 6 con resaltado (nemónico, operando, constante, comentario y meta), autocompletado de nemónicos con su descripción breve (sacada de `01`), y errores en vivo (§5.6).
- Columna «Observar»: **RLO | STA | ACU1 | ACU2** y, opcionalmente, /ER, OR, A1A0, OV y OS, con formato DEC/HEX por columna. Solo tienen valor las líneas ejecutadas en el último ciclo (o en el punto de pausa). En los bucles se muestra la última ejecución y «×n».
- **Puntos de parada** por línea (Fase 3) y botón «Paso de instrucción», que resalta la línea actual.

### 8.4 Móvil (≥ 360 px)

Pestañas: Programa · E/S · Variables · Cronograma. Los botones de E/S son grandes y el KOP se puede desplazar en horizontal con zoom de pellizco.

---

## 9. Modos de práctica y corrección

### 9.1 Modos

| Modo | Fuente en el banco | Qué hace el alumno | Cómo se corrige |
|---|---|---|---|
| **Ejemplos** | `tipo: ejemplo` | Lee, ejecuta y modifica | Botón «Comprobar» que ejecuta las pruebas |
| **Predice** | `tipo: predice` | Ve el código y las entradas de cada paso y escribe los valores de `esperar` | Compara con la ejecución y luego muestra la traza |
| **Traza** | `tipo: traza` | Rellena la tabla de `filas` (0/1 o números) | Celda a celda, con explicación (§9.5) |
| **Traduce** | `tipo: traduce` | Escribe el AWL de un KOP o dibuja el KOP de un AWL | Equivalencia (§9.3) + pruebas |
| **Programa** | `tipo: programa` | Programa desde el enunciado | Pruebas + equivalencia frente a la solución + avisos (§9.4) |
| **Cronograma** | `tipo: cronograma` | Dibuja la salida intervalo a intervalo (clic = cambiar 0/1) | Compara con la simulación; los fallos se pintan en rojo |
| **Teoría** | `tipo: teoria` (`preguntas`) | Elige una opción (barajadas) | Inmediata, con la explicación |
| **Examen** | Mezcla | N preguntas de tipos elegidos, con tiempo | Nota sobre 10 y revisión al final |

Para los tipos **predice** y **programa**, el markdown trae la solución dentro de `<details>`: la app muestra el texto **hasta** `<details>` y el resto solo después de responder.

### 9.2 Corrección por pruebas

Se ejecuta la prueba del ejercicio (§10.2) sobre el programa del alumno.
- **Nota** = comprobaciones correctas / total.
- Cada fallo se describe en lenguaje natural a partir del paso. Por ejemplo: «Paso 4: tras poner E0.1 = 0 y ejecutar 1 ciclo, A4.0 debería valer 0 y vale 1».
- Botón «Ver en el simulador»: carga el programa, reproduce los pasos hasta el que falla y abre el cronograma.

### 9.3 Equivalencia de dos programas (alumno frente a solución)

1. **Señales**:
   - Entradas = todos los bits y palabras de E y PE que lee cualquiera de los dos programas, más los M o MW marcados como entrada en el ejercicio.
   - Observables = todo lo que escribe la solución en A y PA, más los M marcados como salida (por defecto, solo A).
2. **Combinacional** (ninguno de los dos usa T, Z, FP/FN, S/R, ni lee bits que él mismo escribe): se prueban **todas** las combinaciones si hay 12 entradas o menos; si hay más, 4096 al azar. Un ciclo por combinación.
3. **Secuencial**: 20 recorridos × 300 pasos con una semilla fija. En cada paso, cada entrada cambia con probabilidad 0,1 y se avanzan 1 ciclo (70 %), 10 ciclos (20 %) o 50–500 ms (10 %). Las palabras de entrada toman valores al azar de entre los que aparecen en las constantes de los dos programas ±1 (por ejemplo, para `>I 500`: 499, 500 y 501). Las dos CPU reciben lo mismo y se comparan los observables tras cada paso.
4. **Contraejemplo**: la secuencia mínima de cambios de entrada hasta la primera diferencia (se reduce quitando cambios mientras la diferencia se mantenga). Se muestra como cronograma: «Con esta secuencia tu A4.0 se enciende y el de la solución no».

### 9.4 Avisos didácticos (análisis estático)

| Id | Detecta | Mensaje (resumen) | Enlace |
|---|---|---|---|
| L01 | `=` del mismo bit en dos sitios | «A 4.0 se asigna en dos sitios: solo cuenta la última» | `01` §9.1 |
| L02 | Comparación con /ER = 1 fuera de paréntesis (en la traza, `er_antes` = 1 en un `>I`…) | «La comparación sustituye al RLO: ponla entre U( … )» | §7.11 |
| L03 | Misma marca en dos `FP`/`FN`, o una marca de flanco que también se escribe en otro sitio | «Cada flanco necesita su propia marca» | §9.16 |
| L04 | Un temporizador arrancado en más de un sitio | «T 1 se arranca en dos sitios» | §6.6 |
| L05 | `L <entero>` justo antes de `SI/SV/SE/SS/SA` | «Para tiempos usa S5T#…» | §3.3 |
| L06 | Lectura de L antes de escribirla en el bloque | «Variable temporal sin inicializar» | §9.17 |
| L07 | Uso solapado de MW n y MW n+1 (o MD) | «MW 10 y MW 11 comparten MB 11» | §2.2 |
| L08 | `UN E` sobre una entrada configurada como pulsador NC | «Un paro NC se programa con contacto NA» | §1.3 |
| L09 | `LOOP` cuyo contador puede valer 0 (una carga sin comprobar antes) | «Si el contador es 0, LOOP da 65535 vueltas de más» | §7.15 |
| L10 | Una salida que se escribe pero nunca cambia en las pruebas | Pista suave | — |

### 9.5 Explicaciones automáticas de la traza

Para cada fila se genera una frase según la instrucción y el estado. Ejemplos:
- `U E 0.2` con `er_antes` = 0 y OR = 0 → «Primera consulta (/ER = 0): RLO := E0.2 = 1».
- Igual con OR = 1 → «El bit OR está a 1 (un grupo anterior dio 1): el resultado se queda en 1».
- `O` sin operando → «Cierra el grupo Y: OR := RLO = 0; la siguiente instrucción será primera consulta».
- `)` → «Se recupera el RLO de antes del paréntesis (1) y se combina: 1 ∧ ¬(1) = 0».
- `>I` → «Compara ACU2 (10) > ACU1 (5): sí → RLO := 1. La comparación sustituye al RLO anterior».
- `SPB` no tomado → «No salta porque RLO = 0, pero SPB deja RLO = 1 y /ER = 0».
- `+I` con OV → «30000 + 10000 = 40000 no cabe en INT → queda −25536; OV = OS = 1».

### 9.6 Examen

- **Configuración**: número de preguntas (5–20), tipos, temas (categorías A–O) y tiempo límite.
- **Puntuación**: proporcional por pregunta. Las de traza y cronograma se puntúan por celdas.
- Al final: nota sobre 10, revisión de cada pregunta con la solución y el historial guardado.

### 9.7 Progreso

- Por ejercicio se guarda: estado (sin ver, intentado, superado), mejor nota, número de intentos y fecha.
- **Repaso**: los fallados vuelven al cabo de 1, 3 y 7 días.
- Exportar e importar el progreso en JSON.

---

## 10. Banco de ejercicios

### 10.1 Esquema de `src/content/banco_ejercicios.json`

```ts
interface Banco {
  formato: 'banco-kop-awl-v1'; fuente: string;
  convenciones: { ciclo_ms_por_defecto: 10; orden_del_ciclo: string[]; tipos_de_ejercicio: Record<string, string> };
  ejercicios: Ejercicio[];
}
interface Ejercicio {
  id: string;                         // E01, Q04, C02, P03, M01, T02, R01…
  titulo: string; categoria: string;  // "D. Temporizadores"
  tipo: 'ejemplo' | 'predice' | 'traduce' | 'programa' | 'teoria' | 'traza' | 'cronograma';
  awl: string | null;                 // primer bloque awl de la sección (solución o código del enunciado)
  kop_ascii: string | null;           // primer esquema text (KOP en ASCII o cronograma dibujado)
  prueba: Prueba | null;
  traza: { inicial: Record<string, Valor>; filas: FilaTraza[] } | null;
  cronograma: { paso_ms: number; ciclo_ms?: number; entradas: Record<string, string>; salidas: Record<string, string> } | null;
  preguntas: { id: string; pregunta: string; opciones: string[]; correcta: number; explicacion: string }[] | null;
  markdown: string;                   // la sección completa para mostrarla (enunciado, explicación, <details>)
  kop?: SegmentoKOP[];                // Fase 2: modelo KOP de la solución (a añadir)
}
type Valor = number | string;         // string = constante AWL ("W#16#0500") o REAL
interface FilaTraza { i: string; er_antes?: 0|1; rlo?: 0|1; sta?: 0|1; or?: 0|1; ov?: 0|1; os?: 0|1;
                      cc1?: 0|1; cc0?: 0|1; br?: 0|1; acu1?: number; acu2?: number; acu1_int?: number; acu2_int?: number }
```

### 10.2 Semántica de las pruebas (normativo)

**Prueba de pasos**
- `ciclo_ms`: por defecto 10.
- `inicial`: se escribe antes de cualquier ciclo.
- Cada paso, en este orden:
  1. **`poner`**: escribe valores. Los bits y palabras de E y PE van a la **periferia** (llegan a la PAE en el siguiente ciclo). El resto (M, MW, MD, A, DB) se escribe directamente en memoria.
  2. **`pulso: X`** con `veces: n`: n veces (X = 1, un ciclo; X = 0, un ciclo).
  3. **Ciclos**: `ciclos: n`, o `tiempo_ms: t` → ⌈t / ciclo_ms⌉ ciclos. Si el paso no tiene ni `ciclos`, ni `tiempo_ms`, ni `pulso`, se ejecuta **1** ciclo.
  4. **`esperar`**: compara. **`esperar_estado`**: `RUN` o `STOP`.

**Claves** con la forma `operando[:TIPO]`:
- Un bit da 0 o 1 (E se lee de la PAE y A de la PAA).
- Byte → sin signo; palabra → INT; doble palabra → DINT.
- `:WORD`, `:DWORD` y `:BYTE` → sin signo. `:INT` y `:DINT` → con signo. `:REAL` → tolerancia 0,001.
- `Tn` → Q; `Tn:VALOR` → valor restante. `Zn` → Q; `Zn:VALOR` → valor.
- Un valor de texto es una constante AWL (`"W#16#0124"`).

**Traza**: una CPU nueva, se escribe `inicial` y se ejecuta **un** ciclo registrando la traza del OB1. Debe tener el mismo número de filas. Se comparan solo las claves presentes. `er_antes` es el /ER **antes** de la instrucción; el resto, el estado **después**. Los acumuladores `acu1`/`acu2` son de 32 bits con signo y `acu1_int`/`acu2_int` son la parte baja como INT.

**Cronograma**: cada carácter es un intervalo de `paso_ms`. Al empezar cada intervalo se escriben las entradas; se ejecutan `paso_ms / ciclo_ms / 2` ciclos, se **leen las salidas** y se ejecuta el resto del intervalo.

### 10.3 Añadir ejercicios

1. Escribir la sección en `src/content/ejemplos_KOP_AWL.md`: `### ID — Título`, enunciado, `text` (KOP), `awl` y `yaml`.
2. Ejecutar `python3 tools/interprete_referencia.py test src/content/ejemplos_KOP_AWL.md` hasta que dé 100 %.
3. Ejecutar `export` para regenerar `src/content/banco_ejercicios.json`.
4. (Fase 2) Añadir `kop` y comprobar que compilado pasa la misma prueba.

La app también puede ofrecer un **editor de ejercicios** para el profesor o el propio alumno: guarda el programa actual y graba la prueba a partir de una sesión del simulador («grabar pasos»).

---

## 11. Plantas virtuales (Fase 4, opcional)

Pequeñas animaciones conectadas a la E/S, que hacen más tangibles los ejercicios:

| Planta | E/S | Comportamiento |
|---|---|---|
| Motor marcha/paro | E0.0 marcha NA, E0.1 paro NC, A4.0 motor | El motor gira si A4.0 = 1 |
| Depósito (P01) | A4.0 bomba, E0.2 sonda de mínimo, E0.3 sonda de máximo | El nivel sube 5 %/s con la bomba y baja 2 %/s por consumo; las sondas dependen del nivel |
| Semáforo (E28) | A4.0/A4.1/A4.2 | Luces |
| Aparcamiento (E18) | E1.0 entrada, E1.1 salida, MW30, A5.0 «COMPLETO» | Coches que llegan con un botón; barrera; display |
| Estrella-triángulo (P04) | A4.0 KM1, A4.1 KM2, A4.2 KM3 | **Cortocircuito** (STOP de la planta y aviso) si KM2 y KM3 están a la vez |
| Cinta con piezas (P03) | E1.0 sensor, A5.0 aviso | Piezas que pasan delante del sensor |

---

## 12. Pruebas y criterios de aceptación

1. **Núcleo**: Vitest ejecuta todo `src/content/banco_ejercicios.json` (pasos, traza y cronograma) y las pruebas portadas de `SELFTESTS` y `COMPILE_ERRORS` de `04`. Todo verde en CI.
2. **Pruebas diferenciales** (recomendado): un generador de programas AWL aleatorios (bits, palabras, temporizadores, saltos hacia delante) los ejecuta en el núcleo TS y en `04` (`python3` desde un script de CI) y compara la memoria tras N ciclos.
3. **KOP**: para cada modelo KOP, compilado pasa las pruebas del ejercicio, y maquetar → serializar → leer da el mismo modelo.
4. **Interfaz**: los flujos principales (ejecutar E12 y ver el temporizador; resolver T01; responder M01–M05; examen de 5 preguntas) con pruebas e2e (Playwright).
5. **Rendimiento** (§3.4) y **funcionamiento sin conexión** después de la primera carga.
6. **Accesibilidad**: navegación con teclado en el simulador, contraste AA, estados KOP distinguibles sin color.

---

## 13. Mensajes y textos (español)

- **Estado de la CPU**:
  - «RUN»
  - «STOP — <motivo>»
  - «Arranque (OB100)»
  - «Borrado total (MRES): se ha borrado toda la memoria»
- **Compilación**: los de §5.6. **Ejecución**: los de §4.5.
- **Avisos**: los de §9.4.
- **Corrección**:
  - «¡Correcto!»
  - «3 de 4 comprobaciones superadas»
  - «Tu programa no es equivalente a la solución: mira el cronograma»
- **Glosario** de la interfaz: el de `01` §12 (PAE, PAA, RLO, /ER, STA, RB, ACU, segmento…). Mostrar el término alemán o inglés como ayuda emergente (RLO = VKE, RB = BIE = BR, KOP = LAD, AWL = STL, FUP = FBD).
