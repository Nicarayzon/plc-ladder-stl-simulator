# Referencia de KOP y AWL

> **Para qué sirve este documento**
> - Material de estudio para el examen.
> - Especificación funcional del simulador de la app de práctica. Todo lo que aquí se describe como *comportamiento* es lo que el simulador debe reproducir.
>
> **Convenciones**
> - Nemotécnica **alemana**, la más habitual en español: `U`, `O`, `E`, `A`, `M`, `Z`... Las equivalencias en inglés están en el §11.
> - CPU de referencia: una **CPU con 2 acumuladores**. Las diferencias con las CPU de 4 acumuladores se indican cuando importan.
> - "KOP" = esquema de contactos (a veces se escribe "COP"). En inglés es LAD.
> - "AWL" = lista de instrucciones. En inglés es STL.
> - En los esquemas KOP en ASCII, `|` es la barra de alimentación izquierda.

---

## Índice

1. [Cómo funciona el autómata](#1-cómo-funciona-el-autómata)
2. [Áreas de memoria (operandos)](#2-áreas-de-memoria-operandos)
3. [Tipos de datos y constantes](#3-tipos-de-datos-y-constantes)
4. [Direccionamiento simbólico](#4-direccionamiento-simbólico)
5. [Estructura del programa (bloques)](#5-estructura-del-programa-bloques)
6. [KOP — esquema de contactos](#6-kop--esquema-de-contactos)
7. [AWL — lista de instrucciones](#7-awl--lista-de-instrucciones)
8. [Equivalencias KOP ↔ AWL](#8-equivalencias-kop--awl)
9. [Errores típicos y trampas de examen](#9-errores-típicos-y-trampas-de-examen)
10. [Convención de memoria para las prácticas](#10-convención-de-memoria-para-las-prácticas)
11. [Nemotécnica alemán ↔ inglés](#11-nemotécnica-alemán--inglés)
12. [Glosario](#12-glosario)

---

## 1. Cómo funciona el autómata

### 1.1 El ciclo de scan

La CPU ejecuta el programa de forma cíclica. En cada ciclo:

1. **Lee las entradas.** Copia el estado de las entradas físicas en la **imagen de proceso de entradas (PAE)**.
2. **Ejecuta el programa.** Corre el **OB1** y todos los bloques que este llama (FC, FB...), instrucción por instrucción y de arriba abajo.
3. **Escribe las salidas.** Copia la **imagen de proceso de salidas (PAA)** en las salidas físicas.
4. **Tareas internas.** Atiende las comunicaciones (PG, HMI) y el autodiagnóstico, y vuelve al paso 1.

```text
   ┌────────────┐   ┌───────────────────┐   ┌─────────────┐   ┌──────────────┐
──►│ Leer PAE   │──►│ Ejecutar OB1      │──►│ Escribir PAA│──►│ Comunicación │──┐
   │ (entradas) │   │ (programa usuario)│   │ (salidas)   │   │ autodiagnóst.│  │
   └────────────┘   └───────────────────┘   └─────────────┘   └──────────────┘  │
        ▲                                                                       │
        └───────────────────────────────────────────────────────────────────────┘
```

El tiempo de ciclo está vigilado. Por defecto el límite es **150 ms** y se configura en las propiedades de la CPU. Si se supera, se llama al OB80, y si el OB80 no existe la CPU pasa a STOP. Un bucle infinito (por ejemplo, un salto hacia atrás que nunca termina) provoca exactamente eso.

Los temporizadores cuentan el tiempo de forma **asíncrona** al programa: los actualiza el sistema operativo, no el ciclo.

### 1.2 Consecuencias prácticas (muy preguntadas)

| Hecho | Consecuencia |
|---|---|
| La PAE se lee una vez al inicio del ciclo | Durante todo el ciclo una entrada vale lo mismo, aunque cambie físicamente a mitad del ciclo |
| La PAA se escribe al final | Si se asigna la misma salida dos veces, **solo cuenta la última** (doble asignación) |
| El programa se ejecuta en orden | Lo que calcula un segmento lo ven **los segmentos siguientes en el mismo ciclo**. Los anteriores no lo ven hasta el **ciclo siguiente** |
| Las salidas se pueden leer | `U A 4.0` lee la PAA, es decir, lo último que escribió el programa. Así se hace el enclavamiento |
| Periferia directa (`PEW`, `PAW`) | Se salta la imagen de proceso: lee o escribe el módulo en ese mismo instante |

### 1.3 Cableado de seguridad: contacto físico ≠ contacto del programa

- Un **contacto del programa** solo **pregunta** el estado de un bit: si vale 1 o si vale 0. No sabe cómo está cableado el pulsador.
- Los pulsadores de **paro**, las setas de emergencia y los finales de carrera de seguridad se cablean **normalmente cerrados (NC)**. En reposo la entrada está a 1. Si se rompe el cable, la entrada cae a 0 y la máquina se para (seguridad intrínseca).
- Por eso **un paro NC se programa con un contacto NA** (`U E 0.1`): el motor puede funcionar mientras la entrada valga 1.

| Pulsador físico | Estado de la entrada en reposo | Contacto en el programa para "funcionar si NO está pulsado" |
|---|---|---|
| Marcha NA | 0 | — (se usa NA `U` para "si está pulsado") |
| Paro **NC** | **1** | **NA** (`U E 0.1`) |
| Paro NA (no recomendado) | 0 | NC (`UN E 0.1`) |

### 1.4 Estados de la CPU y arranque

- **Modos**: RUN, RUN-P (RUN con programación), STOP y MRES (borrado total). Se seleccionan con el selector de modo de la CPU.
- **LEDs de estado**:
  - SF: error de sistema.
  - BF: error de bus.
  - DC5V: alimentación.
  - FRCE: forzado activo.
  - RUN y STOP: modo actual.
- **Arranque (rearranque completo / arranque en caliente)**: se ejecuta **OB100** una vez y después empieza el ciclo de OB1. En este arranque:
  - Las marcas, temporizadores y contadores **no remanentes** se ponen a 0.
  - La PAA se pone a 0.
  - Los datos **remanentes** conservan su valor.

---

## 2. Áreas de memoria (operandos)

### 2.1 Resumen

| Área | Alemán | Inglés | Contenido | Acceso desde el programa | Accesos posibles |
|---|---|---|---|---|---|
| Entradas | **E** | I | Imagen de proceso de entradas (PAE) | Lectura. También se puede escribir, pero se sobrescribe en el siguiente ciclo | `E`, `EB`, `EW`, `ED` |
| Salidas | **A** | Q | Imagen de proceso de salidas (PAA) | Lectura y escritura | `A`, `AB`, `AW`, `AD` |
| Marcas | **M** | M | Memoria interna de uso general | Lectura y escritura | `M`, `MB`, `MW`, `MD` |
| Temporizadores | **T** | T | Temporizadores (por ejemplo, T0..T255) | Instrucciones de temporizador | `T n` |
| Contadores | **Z** | C | Contadores (0..999) | Instrucciones de contador | `Z n` |
| Bloques de datos | **DB / DI** | DB / DI | Datos globales (DB) o de instancia (DI) | Lectura y escritura | `DBX`, `DBB`, `DBW`, `DBD` / `DIX`... |
| Datos locales | **L** | L | Variables temporales del bloque en ejecución | Lectura y escritura | `L`, `LB`, `LW`, `LD` |
| Periferia | **PE / PA** | PI / PQ | Acceso directo a los módulos, sin imagen de proceso | Lectura (PE) y escritura (PA) | `PEB`, `PEW`, `PED`, `PAB`, `PAW`, `PAD` (**no hay acceso a bit**) |

### 2.2 Bit, byte, palabra y doble palabra

| Formato | Tamaño | Ejemplo | Lectura del ejemplo |
|---|---|---|---|
| Bit | 1 bit | `E 0.3` | Entrada, byte 0, bit 3 (bits de 0 a 7) |
| Byte (B) | 8 bits | `MB 10` | Byte de marcas 10 |
| Palabra (W) | 16 bits | `MW 10` | Bytes MB10 y MB11 |
| Doble palabra (D) | 32 bits | `MD 10` | Bytes MB10, MB11, MB12 y MB13 |

**Orden de bytes (big-endian)**: el byte de **dirección más baja es el más significativo**.

```text
                     MD 10
 ┌──────────────────────────────────────────────┐
 │        MW 10          │        MW 12         │
 ├───────────┬───────────┼───────────┬──────────┤
 │   MB 10   │   MB 11   │   MB 12   │  MB 13   │
 │ (bits 31…24)│(bits 23…16)│(bits 15…8)│(bits 7…0)│   ← posición dentro de MD10
 └───────────┴───────────┴───────────┴──────────┘
   MW10 = MB10·256 + MB11        (MB10 es el byte ALTO de MW10)
```

Posición de cada bit dentro de una palabra, por ejemplo `EW 0`:

| Bit de `EW 0` | 15 | 14 | … | 8 | 7 | … | 0 |
|---|---|---|---|---|---|---|---|
| Bit físico | E0.7 | E0.6 | … | **E0.0** | E1.7 | … | **E1.0** |

> **Trampa clásica**: si solo `E 0.0` = 1, entonces `EW 0` = 256 (W#16#0100), no 1. Si solo `E 1.0` = 1, `EW 0` = 1.

**Solapamientos**: `MW 10` y `MW 11` comparten el byte `MB 11`. Para no pisar datos, las palabras se usan de 2 en 2 (`MW10`, `MW12`...) y las dobles palabras de 4 en 4 (`MD20`, `MD24`...).

### 2.3 Direcciones de E/S

- **Direccionamiento por slot (por defecto)**: en el bastidor 0, el slot 1 es la fuente, el slot 2 la CPU, el slot 3 el módulo IM y los slots 4 a 11 los módulos de señales.
  - Módulos **digitales**: byte inicial = (slot − 4) × 4. Por ejemplo, el slot 4 ocupa E0.0..E3.7 y el slot 5 empieza en el byte 4.
  - Módulos **analógicos**: dirección inicial = 256 + (slot − 4) × 16. Por ejemplo, el slot 4 ocupa PEW256..PEW270.
- **CPU compactas** (muy habituales en los entrenadores): la E/S integrada suele estar en E124.0..E126.7, A124.0..A125.7 y analógicas PEW752.. / PAW752... Compruébalo siempre en la **configuración del hardware**, porque se puede cambiar.
- **Valores analógicos**: el rango nominal es **0..27648**, que corresponde por ejemplo a 0..10 V o a 4..20 mA. Por encima de 27648 hay rango de rebase (hasta 32511). El valor **32767** indica desbordamiento o rotura de hilo.

### 2.4 Marcas (M)

Las marcas son la "memoria RAM de bits" del programador. Se usan como:

- **Marcas auxiliares**: resultados intermedios que se usan en varios sitios.
- **Marcas de etapa**: en secuencias y GRAFCET, cada etapa es una marca activada con S y desactivada con R.
- **Marcas de flanco**: memoria que necesitan `FP` y `FN`. **Una marca distinta por cada flanco, y no se reutiliza para nada más.**
- **Valores numéricos**: `MW` para INT, `MD` para DINT o REAL.

**Marcas remanentes**: conservan su valor tras un corte de alimentación o un paso STOP→RUN. Se configuran en *Propiedades de la CPU → Remanencia*. En muchas CPU vienen por defecto **MB0..MB15**.

**Marcas de ciclo**: en *Propiedades de la CPU → Ciclo/marca de ciclo* se elige un byte, por ejemplo MB100. Sus bits oscilan solos:

| Bit | 7 | 6 | 5 | 4 | 3 | 2 | 1 | 0 |
|---|---|---|---|---|---|---|---|---|
| Periodo (s) | 2,0 | 1,6 | 1,0 | 0,8 | 0,5 | 0,4 | 0,2 | 0,1 |
| Frecuencia (Hz) | 0,5 | 0,625 | 1 | 1,25 | 2 | 2,5 | 5 | 10 |

Ejemplo: con MB100 como marca de ciclo, `M 100.5` parpadea a 1 Hz (0,5 s encendido y 0,5 s apagado).

### 2.5 Datos locales (L) y bloques de datos (DB)

- **L (temporales)**: existen solo mientras se ejecuta el bloque. **Al empezar el bloque su valor es indefinido**, así que hay que escribirlos antes de leerlos. En el OB1, los 20 primeros bytes (LB0..LB19) contienen la información de arranque del OB, por lo que las temporales del usuario empiezan en LB20.
- **DB globales**: se accede con la dirección completa (`DB1.DBW 0`) o abriendo antes el DB (`AUF DB 1`) y usando después `DBW 0`, `DBX 2.0`, etc.
- **DB de instancia (DI)**: es la memoria propia de cada llamada a un FB. Ahí se guardan sus parámetros y sus variables estáticas (STAT).

---

## 3. Tipos de datos y constantes

### 3.1 Tipos simples

| Tipo | Bits | Rango | Constante de ejemplo (AWL) |
|---|---|---|---|
| BOOL | 1 | 0 / 1 | (los bits no se cargan con `L`) |
| BYTE | 8 | 0..255 | `B#16#1F` |
| WORD | 16 | 0..FFFF | `W#16#00FF`, `2#0000000011111111`, `C#123` (BCD), `B#(1,2)` |
| DWORD | 32 | 0..FFFF FFFF | `DW#16#00010000`, `B#(1,2,3,4)` |
| CHAR | 8 | carácter ASCII | `'A'` |
| INT | 16 | −32768..32767 | `123`, `-5` |
| DINT | 32 | −2147483648..2147483647 | `L#100000`, `L#-1` |
| REAL | 32 | ±1,175495e−38..±3,402823e+38 (IEEE 754) | `1.5`, `2.764800e+004` |
| S5TIME | 16 | 0 ms..2 h 46 min 30 s | `S5T#5S`, `S5T#1M30S`, `S5T#500MS` |
| TIME | 32 | ±24 días 20 h 31 min 23 s 647 ms (en ms) | `T#1M30S`, `T#500MS` |
| DATE | 16 | 1990-01-01..2168-12-31 (días desde 1990) | `D#2026-10-13` |
| TIME_OF_DAY | 32 | 0:00:00.000..23:59:59.999 (ms desde medianoche) | `TOD#12:30:00.000` |

- **Tipos compuestos**: DATE_AND_TIME (8 bytes en BCD), STRING[n] (n+2 bytes), ARRAY, STRUCT y UDT.
- **Tipos de parámetro**: TIMER, COUNTER, BLOCK_FC, BLOCK_FB, BLOCK_DB, POINTER (6 bytes) y ANY (10 bytes).

### 3.2 BCD (decimal codificado en binario)

En BCD cada grupo de 4 bits (nibble) es una cifra decimal del 0 al 9. Por ejemplo, `W#16#0123` en BCD vale **123**. Lo usan las ruedas de dígitos (preselectores), los displays y los valores de tiempo (S5TIME) y de contaje.

- **BCD de palabra (3 cifras con signo)**: los bits 11..0 son las tres cifras y los bits 15..12 el signo (`0000` positivo, `1111` negativo). Rango ±999.
- **BCD de doble palabra (7 cifras con signo)**: rango ±9 999 999.
- Una cifra de A a F **no es BCD válido**. Por ejemplo, `BTI` sobre `W#16#00A1` provoca un **error de conversión BCD** (OB121), y si el OB121 no existe la CPU pasa a STOP.

### 3.3 Formato interno de S5TIME

```text
 bit  15 14 | 13 12 | 11 … 8 | 7 … 4 | 3 … 0
      x  x  | base  | centenas| decenas| unidades   (valor 0..999 en BCD)
```

| Base (bits 13–12) | Resolución | Rango |
|---|---|---|
| 00 | 10 ms | 10 ms – 9 s 990 ms |
| 01 | 100 ms | 100 ms – 1 min 39 s 900 ms |
| 10 | 1 s | 1 s – 16 min 39 s |
| 11 | 10 s | 10 s – 2 h 46 min 30 s |

El editor elige automáticamente la base más fina en la que cabe el valor:

- `S5T#5S` = 500 × 10 ms → **W#16#0500**
- `S5T#12S` = 120 × 100 ms → **W#16#1120**
- `S5T#2M` = 120 × 1 s → **W#16#2120**

> **Trampa**: `L 500` **no** son 5 segundos. 500 en binario es W#16#01F4, que contiene la cifra F, así que no es BCD válido y provoca un error. Hay que escribir `L S5T#5S` o `L W#16#0500`.

### 3.4 REAL

Los REAL siguen el estándar IEEE 754 de 32 bits. Hay que tener en cuenta dos cosas:

- Para operar enteros con REAL hay que convertirlos antes: **INT → DINT → REAL** (`ITD` y luego `DTR`).
- No conviene comparar dos REAL con `==R`: es mejor comparar con un margen.

---

## 4. Direccionamiento simbólico

- La **tabla de símbolos** asigna a cada operando un nombre, un tipo de datos y un comentario. Por ejemplo: `"Marcha"` → E 0.0, BOOL, "Pulsador de marcha NA".
- En el código, los símbolos globales van **entre comillas dobles** (`U "Marcha"`) y las variables locales del bloque llevan **#** (`U #Paro`).
- En el editor: *Ver → Representación simbólica* y *Ver → Mostrar → Información del símbolo*.
- La app debería permitir usar símbolos (ver la especificación del simulador).

---

## 5. Estructura del programa (bloques)

### 5.1 Tipos de bloque

| Bloque | Qué es | Memoria propia |
|---|---|---|
| **OB** | Bloque de organización. Lo llama el sistema operativo: ciclo, arranque, alarmas o errores | Temporales (L) |
| **FC** | Función. Código con parámetros | No: solo temporales |
| **FB** | Bloque de función. Código con parámetros **y memoria** | Sí: un **DB de instancia** por cada llamada |
| **DB** | Bloque de datos (global o de instancia) | Son datos, siempre remanentes |
| **SFC / SFB** | Funciones y bloques del sistema que vienen en la CPU | — |
| **UDT** | Tipo de datos de usuario | — |

### 5.2 OB importantes

| OB | Cuándo se ejecuta |
|---|---|
| OB1 | Cíclicamente (programa principal) |
| OB10 | Alarma horaria (fecha y hora) |
| OB20 | Alarma de retardo |
| OB35 | Alarma cíclica (por defecto cada 100 ms) |
| OB40 | Alarma de proceso (flanco en un módulo con alarma) |
| OB80 | Error de tiempo (tiempo de ciclo excedido) |
| OB82 | Alarma de diagnóstico de un módulo |
| OB85 / OB86 / OB87 | Error de ejecución del programa / fallo de bastidor o periferia descentralizada / error de comunicación |
| OB100 | Arranque (rearranque completo) |
| OB121 | Error de programación (por ejemplo BCD no válido, bloque inexistente) |
| OB122 | Error de acceso a periferia |

> Si ocurre un error y el OB de error correspondiente **no está cargado**, la CPU pasa a **STOP**.

### 5.3 Declaración de variables de un bloque

| Sección | FC | FB | Para qué sirve |
|---|---|---|---|
| IN | ✓ | ✓ | Parámetros de entrada |
| OUT | ✓ | ✓ | Parámetros de salida |
| IN_OUT | ✓ | ✓ | Parámetros que se leen y se escriben |
| STAT | — | ✓ | Variables estáticas: se guardan en el DB de instancia y conservan su valor entre llamadas |
| TEMP | ✓ | ✓ | Temporales: indefinidas al empezar |

### 5.4 Llamadas

```text
// FC con parámetros (AWL)
      CALL  FC     1
       Marcha:=E0.0
       Paro  :=E0.1
       Motor :=A4.0

// FB con su DB de instancia
      CALL  FB     1 , DB     1
       Entrada:=E0.2
       Salida :=A4.1

// FC sin parámetros
      UC    FC     2              // llamada incondicional
      U     E      0.3
      CC    FC     3              // llamada condicional: solo si RLO = 1
```

Cómo se ve un FC genérico en una **fuente AWL** (un fichero de texto con los bloques; las instrucciones terminan en `;`):

```text
FUNCTION FC 1 : VOID
TITLE = Marcha-paro genérico
VAR_INPUT
  Marcha : BOOL ;
  Paro : BOOL ;
END_VAR
VAR_IN_OUT
  Motor : BOOL ;
END_VAR
BEGIN
NETWORK
TITLE = Enclavamiento
      U(    ;
      O     #Marcha;
      O     #Motor;
      )     ;
      U     #Paro;
      =     #Motor;
END_FUNCTION
```

En KOP una llamada es un **cuadro** con EN/ENO y los parámetros como patillas.

---

## 6. KOP — esquema de contactos

### 6.1 Conceptos y reglas

- **Segmento (Network)**: es la unidad de programa. Cada segmento tiene título, comentario y una red de elementos.
- **Barra de alimentación**: está a la izquierda. La "corriente" fluye de izquierda a derecha.
- **Contacto**: **pregunta** el estado de un bit.
  - NA `--| |--` conduce si el bit vale 1.
  - NC `--|/|--` conduce si el bit vale 0.
- **Serie** = Y (AND). **Paralelo** = O (OR).
- **Bobina**: **escribe** el resultado de la lógica que tiene a su izquierda (el RLO) en un bit.
- **Cuadro (box)**: es una función con entrada de habilitación **EN** y salida **ENO**. ENO = 1 si EN = 1 y la operación terminó sin error.

**Reglas de construcción**:

- Los elementos de salida (bobinas y cuadros finales) van a la derecha. Se pueden poner **varias bobinas en paralelo** al final de un segmento.
- El conector `--(#)--` y algunos cuadros pueden ir en medio de la rama.
- No se puede crear flujo de derecha a izquierda ni ramas sin cerrar.
- Un destino de salto (`LABEL`) siempre va **al principio de un segmento**.
- Si un segmento escrito en AWL no tiene representación gráfica, se queda en AWL al cambiar la vista.

**Observar en línea**: el flujo de corriente se ve en **verde continuo** y la ausencia de flujo en **azul discontinuo**.

### 6.2 Operaciones lógicas con bits

| Símbolo KOP | Nombre | Función | AWL |
|---|---|---|---|
| `--| |--` | Contacto NA | Conduce si el operando = 1 | `U op` |
| `--|/|--` | Contacto NC | Conduce si el operando = 0 | `UN op` |
| `--|NOT|--` | Invertir | Invierte el flujo de corriente (RLO) | `NOT` |
| `--( )` | Bobina | Operando := RLO | `= op` |
| `--(#)--` | Conector | Guarda el RLO intermedio en un bit y sigue | `= op` (en medio) |
| `--(S)` | Activar | Si RLO = 1 → operando := 1 | `S op` |
| `--(R)` | Desactivar | Si RLO = 1 → operando := 0 | `R op` |
| cuadro `SR` | Biestable con **prioridad a desactivar** | S activa, R desactiva; si ambas = 1 gana R | `U s / S op / U r / R op` |
| cuadro `RS` | Biestable con **prioridad a activar** | Si ambas = 1 gana S | `U r / R op / U s / S op` |
| `--(P)--` | Flanco positivo del RLO | 1 durante **un ciclo** cuando el RLO pasa de 0 a 1 | `FP marca` |
| `--(N)--` | Flanco negativo del RLO | 1 durante un ciclo cuando el RLO pasa de 1 a 0 | `FN marca` |
| cuadro `POS` / `NEG` | Flanco de un operando | Detecta el flanco de un bit concreto (con su marca M_BIT) | (código con `FP`/`FN`) |
| `--(SAVE)` | Guardar RLO | Copia el RLO en el bit RB (BR) | `SAVE` |

### 6.3 Funciones lógicas con contactos

```text
 Y (AND)                          O (OR)
     E0.0     E0.1     A4.0           E0.0               A4.0
 |---| |------| |------( )        |---| |----+-----------( )
                                  |   E0.1   |
                                  |---| |----+

 NAND                             NOR
     E0.0     E0.1           A4.0      E0.0              A4.0
 |---| |------| |----|NOT|---( )   |---| |----+--|NOT|---( )
                                   |   E0.1   |
                                   |---| |----+

 O-exclusiva (XOR): a·b̄ + ā·b
     E0.0     E0.1     A4.2
 |---| |------|/|---+--( )
 |   E0.0     E0.1  |
 |---|/|------| |---+
```

| a | b | AND | OR | NAND | NOR | XOR | XNOR |
|---|---|---|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 1 | 1 | 0 | 1 |
| 0 | 1 | 0 | 1 | 1 | 0 | 1 | 0 |
| 1 | 0 | 0 | 1 | 1 | 0 | 1 | 0 |
| 1 | 1 | 1 | 1 | 0 | 0 | 0 | 1 |

### 6.4 Bobinas, enclavamiento y biestables

**Enclavamiento (autorretención)** — marcha y paro con prioridad al paro:

```text
     E0.0 (Marcha)  E0.1 (Paro, NC cableado)   A4.0 (Motor)
 |---| |------+-------| |-----------------------( )
 |            |
 |   A4.0     |
 |---| |------+
```

**Set/Reset con bobinas**: el que se ejecuta **el último** tiene prioridad.

```text
     E0.0           A4.0
 |---| |------------(S)
     E0.1           A4.0
 |---|/|------------(R)          ← R va después: prioridad a desactivar
```

**Cuadro SR / RS**:

```text
                 A4.0                               A4.0
             +---------+                        +---------+
     E0.0    |   SR    |                E0.1    |   RS    |
 |---| |-----|S       Q|---           |---|/|---|R       Q|---
     E0.1    |         |                E0.0    |         |
 |---|/|-----|R        |              |---| |---|S        |
             +---------+                        +---------+
 SR: ambas = 1 → Q = 0             RS: ambas = 1 → Q = 1
```

> **Una bobina `( )` por operando.** Si el mismo bit tiene dos bobinas `( )`, solo vale la última (§9). Las bobinas `S` y `R` del mismo bit sí pueden aparecer varias veces: es lo normal.

### 6.5 Flancos

`--(P)--` lleva encima una **marca de flanco** donde guarda el RLO del ciclo anterior. Su salida vale 1 solo en el ciclo en que el RLO pasa de 0 a 1.

```text
     E0.0     M10.0        M10.1
 |---| |-------(P)---------( )        M10.1 = impulso de un ciclo al pulsar E0.0
```

Cronograma (cada carácter representa un ciclo):

```text
 E0.0   ___‾‾‾‾‾‾‾‾____‾‾‾‾___
 (P)    ___‾___________‾______      un ciclo al subir
 (N)    ___________‾_______‾__      un ciclo al bajar
```

Usos típicos: contar pulsaciones, el **telerruptor** (un solo pulsador que enciende y apaga) y ejecutar una acción una sola vez.

### 6.6 Temporizadores

**Cuadros y patillas** (nombres alemanes; los ingleses entre paréntesis):

```text
                 T1
             +-----------+
   E0.0      | S_EVERZ   |                         A4.0
 |---| |-----|S         Q|-------------------------( )
             |           |
 S5T#5S -----|TW     DUAL|-- MW10   (tiempo restante en binario)
             |           |
   E0.1      |        DEZ|-- MW12   (tiempo restante en BCD con base)
 |---| |-----|R          |
             +-----------+
```

| Patilla | Significado |
|---|---|
| S | Arranque. Según el tipo, arranca por **flanco** o actúa por nivel |
| TW (TV) | Valor de tiempo en formato S5TIME |
| R | Reset: pone el temporizador a 0 y Q = 0. Tiene **prioridad** |
| Q | Estado del temporizador, igual que `U T1` |
| DUAL (BI) | Tiempo restante en binario, sin la base |
| DEZ (BCD) | Tiempo restante en BCD con la base (formato S5TIME) |

| Cuadro | Bobina | AWL | Tipo | Comportamiento |
|---|---|---|---|---|
| S_IMPULS (S_PULSE) | `(SI)` | `SI` | **Impulso** | Q = 1 desde el flanco de S, como máximo el tiempo TW. **Si S cae antes, Q = 0 inmediatamente** |
| S_VIMP (S_PEXT) | `(SV)` | `SV` | **Impulso prolongado** | Q = 1 durante todo TW aunque S caiga. Un nuevo flanco de S lo **reinicia** |
| S_EVERZ (S_ODT) | `(SE)` | `SE` | **Retardo a la conexión** | Q = 1 cuando ha pasado TW **y S sigue a 1**. Si S cae, se para y Q = 0 |
| S_SEVERZ (S_ODTS) | `(SS)` | `SS` | **Retardo a la conexión con memoria** | Arranca con el flanco de S y sigue contando aunque S caiga. Q = 1 al terminar y **se mantiene hasta un reset** |
| S_AVERZ (S_OFFDT) | `(SA)` | `SA` | **Retardo a la desconexión** | Q = 1 en cuanto S = 1. Al **caer** S, cuenta TW y luego Q = 0. Si S vuelve a 1 mientras cuenta, se para y Q sigue a 1 |

Cronogramas (TW = t):

```text
 SI   S  __‾‾‾‾‾‾‾‾‾‾‾‾‾____‾‾‾‾__________
      Q  __‾‾‾‾‾‾‾________‾‾‾‾__________     (Q dura t como máximo; si S cae antes, Q cae)
           |<-t->|

 SV   S  __‾‾_____________‾‾‾‾‾‾‾‾‾‾‾‾‾‾__
      Q  __‾‾‾‾‾‾‾________‾‾‾‾‾‾‾_______     (Q dura t aunque S caiga)
           |<-t->|          |<-t->|

 SE   S  __‾‾‾‾‾‾‾‾‾‾‾‾‾____‾‾‾‾‾__________
      Q  _________‾‾‾‾‾____________________   (el 2.º pulso es más corto que t → Q no se activa)
           |<-t->|

 SS   S  __‾‾_____________________________
      R  _____________________‾‾__________
      Q  _________‾‾‾‾‾‾‾‾‾‾‾‾______________ (se mantiene hasta R)
           |<-t->|

 SA   S  __‾‾‾‾‾‾____‾‾_______________
      Q  __‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾_______     (cuenta t desde la última bajada)
                         |<-t->|
```

**Bobinas de temporizador**: `T1 --(SE)` con el valor `S5T#5S` debajo. El reset se hace con una bobina `--(R)` sobre `T1`, y el estado se lee con un contacto `T1 --| |--`.

**Notas**:
- Cada temporizador (T1, T2...) se arranca **en un solo sitio** del programa.
- El valor TW se toma en el **flanco de arranque**.
- El tiempo baja de TW hasta 0. La precisión es la de la base.
- Si R = 1, el temporizador se queda parado aunque S = 1. Al soltar R, no vuelve a arrancar hasta que S tenga un **nuevo flanco**.

### 6.7 Contadores

```text
                 Z1
             +-----------+
   E1.0      | Z_VORW    |
 |---| |-----|ZV        Q|------------------( ) A5.1    (Q = 1 si valor > 0)
   E1.2      |           |
 |---| |-----|S      DUAL|-- MW20   (valor en binario)
 C#5 --------|ZW      DEZ|-- MW22   (valor en BCD)
   E1.3      |           |
 |---| |-----|R          |
             +-----------+
```

| Cuadro | Función |
|---|---|
| Z_VORW (S_CU) | Contador ascendente: +1 en cada **flanco positivo** de ZV |
| Z_RUECK (S_CD) | Contador descendente: −1 en cada flanco positivo de ZR |
| ZAEHLER (S_CUD) | Ascendente y descendente (tiene ZV y ZR) |

| Patilla | Significado |
|---|---|
| ZV / ZR (CU / CD) | Contar arriba / abajo (por flanco) |
| S | **Flanco** positivo → carga el valor ZW |
| ZW (PV) | Valor de preselección en BCD (`C#0`..`C#999`) |
| R | Reset por nivel → valor = 0 |
| Q | 1 si el valor es mayor que 0 |
| DUAL / DEZ | Valor actual en binario / en BCD |

- Rango **0..999**: no baja de 0 ni sube de 999.
- Mantener la entrada a 1 **no cuenta varias veces**: hace falta un flanco por cada unidad.
- Bobinas: `(ZV)`, `(ZR)`, `(SZ)` (cargar valor) y `(R)`.

### 6.8 Cuadros con EN/ENO

**Comparación** (actúan como un contacto: se ponen en serie o en paralelo):

```text
         E2.0       CMP >I                    A5.6
 |-------| |-------+-------+------------------( )
                   |  >I   |
           MW30 ---|IN1    |
           500  ---|IN2    |
                   +-------+
```

| Familia | Cuadros |
|---|---|
| Comparar INT | `CMP ==I`, `<>I`, `>I`, `<I`, `>=I`, `<=I` |
| Comparar DINT / REAL | igual con `D` / `R` |
| Transferencia | `MOVE` (IN → OUT, de 8, 16 o 32 bits) |
| Aritmética INT | `ADD_I`, `SUB_I`, `MUL_I`, `DIV_I` |
| Aritmética DINT | `ADD_DI`, `SUB_DI`, `MUL_DI`, `DIV_DI`, `MOD_DI` |
| Aritmética REAL | `ADD_R`, `SUB_R`, `MUL_R`, `DIV_R`, `ABS`, `SQR`, `SQRT`, `EXP`, `LN`, `SIN`, `COS`, `TAN`, `ASIN`, `ACOS`, `ATAN` |
| Conversión | `BCD_I`, `I_BCD`, `BCD_DI`, `DI_BCD`, `I_DI`, `DI_R`, `ROUND`, `TRUNC`, `CEIL`, `FLOOR`, `INV_I`, `INV_DI`, `NEG_I`, `NEG_DI`, `NEG_R` |
| Lógica de palabras | `WAND_W`, `WOR_W`, `WXOR_W`, `WAND_DW`, `WOR_DW`, `WXOR_DW` |
| Desplazamiento | `SHL_W`, `SHR_W`, `SHR_I`, `SHL_DW`, `SHR_DW`, `SHR_DI`, `ROL_DW`, `ROR_DW` |

- **ENO = 0** si EN = 0 o si hubo un error. Por ejemplo, `ADD_I` con desbordamiento o `I_BCD` fuera de ±999.
- Los cuadros se pueden **encadenar**: ENO de uno → EN del siguiente.
- No existe `I_R`: para pasar de INT a REAL hay que usar `I_DI` y después `DI_R`.

### 6.9 Control del programa

| Elemento | Función | AWL |
|---|---|---|
| `--(JMP)` con meta | Salta si RLO = 1. Si está unida directamente a la barra, salta siempre | `SPB` / `SPA` |
| `--(JMPN)` | Salta si RLO = 0 | `SPBN` |
| `LABEL` | Destino del salto, al principio de un segmento | `META:` |
| `--(CALL)` | Llama a un FC o SFC sin parámetros | `UC` / `CC` |
| `--(RET)` | Fin de bloque condicional | `BEB` |
| `--(OPN)` | Abrir un DB | `AUF` |
| `--(MCRA)`, `--(MCR<)`, `--(MCR>)`, `--(MCRD)` | Master Control Relay | `MCRA`, `MCR(`, `)MCR`, `MCRD` |

### 6.10 Bits de estado como contactos

Contactos `OV`, `OS`, `UO`, `BR`, `==0`, `<>0`, `>0`, `<0`, `>=0` y `<=0`. Consultan el resultado de la última operación aritmética o de comparación (§7.2).

---

## 7. AWL — lista de instrucciones

### 7.1 Formato

```text
[META:]  OPERACIÓN   OPERANDO        // comentario
 FIN:    U           E 0.0           // Y con la entrada 0.0
```

- Una instrucción por línea. El código se divide en **segmentos**, igual que en KOP.
- **Metas (etiquetas)**: hasta 4 caracteres, empiezan por letra y terminan en `:`.
- Comentarios con `//`. En las fuentes AWL cada instrucción termina en `;`.
- Los espacios entre área y dirección no importan: `E 0.0` es lo mismo que `E0.0`.

### 7.2 Registros de la CPU

| Registro | Tamaño | Uso |
|---|---|---|
| **ACU1**, **ACU2** | 32 bits | Acumuladores. `L` carga en ACU1 y lo anterior pasa a ACU2. Las operaciones trabajan con ACU2 (op) ACU1. Las CPU de 4 acumuladores tienen también ACU3 y ACU4 |
| **AR1**, **AR2** | 32 bits | Registros de direcciones (direccionamiento indirecto) |
| **DB / DI** | 16 bits | Número del DB global y del DB de instancia abiertos |
| **Palabra de estado** | 16 bits (se usan 9) | Ver tabla |

**Palabra de estado**:

| Bit | Nombre (es / de) | Inglés | Significado |
|---|---|---|---|
| 0 | **/ER** | /FC | **Primera consulta**. 0 = la siguiente operación lógica empieza una cadena nueva. 1 = cadena en curso |
| 1 | **RLO** (VKE) | RLO | **Resultado lógico** de la cadena |
| 2 | **STA** | STA | **Estado** del último bit consultado (su valor real, antes de invertir) |
| 3 | **OR** | OR | Memoria para "Y antes de O" (§7.4) |
| 4 | **OS** | OS | Desbordamiento **memorizado**. Se pone a 0 con `SPS`, al llamar a un bloque y al terminar un bloque |
| 5 | **OV** | OV | Desbordamiento en la **última** operación aritmética |
| 6 | **A0** | CC0 | Código de condición 0 |
| 7 | **A1** | CC1 | Código de condición 1 |
| 8 | **RB** (BIE) | BR | Resultado binario. Se usa para ENO y `SAVE` |

**Significado de A1/A0 (CC1/CC0)**:

| A1 | A0 | Tras aritmética | Tras comparación (ACU2 frente a ACU1) | Tras desplazamiento |
|---|---|---|---|---|
| 0 | 0 | resultado = 0 | ACU2 = ACU1 | último bit desplazado = 0 |
| 0 | 1 | resultado < 0 | ACU2 < ACU1 | — |
| 1 | 0 | resultado > 0 | ACU2 > ACU1 | último bit desplazado = 1 |
| 1 | 1 | división por 0 / REAL no válido | no ordenable (REAL no válido) | — |

### 7.3 Lógica de bits: RLO, primera consulta y STA

Cada instrucción lógica combina **el RLO actual** con **el bit del operando**:

| Instrucción | Si /ER = 0 (primera consulta) | Si /ER = 1 (cadena en curso) |
|---|---|---|
| `U op` (Y) | RLO := op | RLO := RLO ∧ op |
| `UN op` (Y-No) | RLO := ¬op | RLO := RLO ∧ ¬op |
| `O op` (O) | RLO := op | RLO := RLO ∨ op |
| `ON op` (O-No) | RLO := ¬op | RLO := RLO ∨ ¬op |
| `X op` (O-exclusiva) | RLO := op | RLO := RLO ⊕ op |
| `XN op` (O-exclusiva-No) | RLO := ¬op | RLO := RLO ⊕ ¬op |

Después de cualquiera de ellas: **/ER := 1** y **STA := valor del operando**.

**Instrucciones que cierran la cadena (/ER := 0)** sin cambiar el RLO:
- `=`, `S` y `R`.
- Las de temporizadores (`SI`, `SV`, `SE`, `SS`, `SA`, `R T`, `FR T`).
- Las de contadores (`ZV`, `ZR`, `S Z`, `R Z`).

Por eso **se pueden encadenar varias asignaciones** con el mismo RLO:

```awl
      U     E 0.0
      U     E 0.1
      =     A 4.0      // A4.0 := E0.0 ∧ E0.1
      =     A 4.1      // A4.1 recibe el mismo RLO
      S     M 0.0      // y también activa M0.0 si es 1
```

**Instrucciones que NO tocan el RLO ni /ER**: `L`, `T`, la aritmética, la conversión, `TAK`, `INC`, `DEC`... Una cadena lógica puede continuar "por encima" de ellas:

```awl
      U     E 0.0
      L     MW 10      // no afecta al RLO
      T     MW 12      // se ejecuta SIEMPRE (T no depende del RLO)
      =     A 4.0      // A4.0 := E0.0
```

**Operaciones directas sobre el RLO**:

| Instrucción | Efecto |
|---|---|
| `NOT` | RLO := ¬RLO |
| `SET` | RLO := 1 (y /ER := 0) |
| `CLR` | RLO := 0 (y /ER := 0) |
| `SAVE` | RB := RLO |

### 7.4 "Y antes de O": `O` sin operando y paréntesis

AWL evalúa **de forma secuencial**: `U E0.0 / O E0.1 / U E0.2` calcula **(E0.0 ∨ E0.1) ∧ E0.2**, no E0.0 ∨ (E0.1 ∧ E0.2). Para agrupar hay dos herramientas.

**a) `O` sin operando** separa grupos Y que se combinan con O:

```awl
      U     E 0.0
      U     E 0.1
      O                 // (E0.0 ∧ E0.1)  ∨ ...
      U     E 0.2
      U     E 0.3
      =     A 4.0       // A4.0 = (E0.0 ∧ E0.1) ∨ (E0.2 ∧ E0.3)
```

Funcionamiento interno: `O` guarda el resultado del primer grupo en el bit **OR** y pone /ER = 0. Mientras OR = 1, las siguientes `U` y `UN` dejan el RLO a 1, porque el resultado ya está decidido. `=` pone OR := 0.

**b) Paréntesis**: `U(`, `UN(`, `O(`, `ON(`, `X(`, `XN(` ... `)`.

```awl
      U     E 0.0
      U(                // E0.0 ∧ ( ... )
      O     E 0.1
      O     E 0.2
      )
      =     A 4.1       // A4.1 = E0.0 ∧ (E0.1 ∨ E0.2)
```

- Al abrir el paréntesis se guardan en la **pila de anidamiento** el RLO, el bit OR y la operación pendiente, y se empieza una cadena nueva (/ER = 0).
- Al cerrar con `)` se recupera lo guardado y se combina con el RLO del interior.
- Se admiten **hasta 7 niveles** de anidamiento.

### 7.5 Asignación, Set y Reset

| Instrucción | Efecto | Prioridad |
|---|---|---|
| `= op` | op := RLO, siempre | — |
| `S op` | si RLO = 1 → op := 1 (si RLO = 0 no hace nada) | — |
| `R op` | si RLO = 1 → op := 0 | — |

Cuando un mismo bit tiene `S` y `R`, **gana la que se ejecuta la última**:

```awl
      U     E 0.0           // marcha
      S     A 4.0
      U     E 0.1           // paro
      R     A 4.0           // R al final → prioridad a desactivar (paro)
```

### 7.6 Flancos

| Instrucción | Pseudocódigo |
|---|---|
| `FP m` | `ant := m; m := RLO; RLO := RLO ∧ ¬ant` |
| `FN m` | `ant := m; m := RLO; RLO := ¬RLO ∧ ant` |

```awl
      U     E 0.0
      FP    M 10.0          // M10.0 = marca de flanco (exclusiva)
      =     M 10.1          // M10.1 = 1 solo en el ciclo del flanco
```

### 7.7 Temporizadores en AWL

```awl
      U     E 0.0           // condición de arranque (RLO)
      L     S5T#5S          // valor de tiempo → ACU1
      SE    T 1             // retardo a la conexión (SI, SV, SE, SS o SA)
      U     E 0.1
      R     T 1             // reset
      L     T 1             // tiempo restante en binario (sin base) → ACU1
      T     MW 10
      LC    T 1             // tiempo restante en BCD con base (S5TIME) → ACU1
      T     MW 12
      U     T 1             // estado Q del temporizador
      =     A 4.0
```

| Instrucción | Función |
|---|---|
| `SI T n` | Arranca como impulso (S_IMPULS) |
| `SV T n` | Arranca como impulso prolongado (S_VIMP) |
| `SE T n` | Arranca como retardo a la conexión (S_EVERZ) |
| `SS T n` | Arranca como retardo a la conexión con memoria (S_SEVERZ) |
| `SA T n` | Arranca como retardo a la desconexión (S_AVERZ) |
| `R T n` | Reset si RLO = 1 |
| `FR T n` | Habilitar: un flanco permite rearrancar sin flanco en la entrada de arranque (uso raro) |
| `U T n` / `UN T n` / `O T n`... | Consulta el estado Q del temporizador |
| `L T n` / `LC T n` | Carga el tiempo restante en binario / en BCD |

La instrucción de arranque **usa el valor de ACU1** en el momento del flanco. Por eso el `L S5T#…` va justo antes.

### 7.8 Contadores en AWL

```awl
      U     E 1.0
      ZV    Z 1             // +1 en flanco positivo
      U     E 1.1
      ZR    Z 1             // −1 en flanco positivo
      U     E 1.2
      L     C#5             // valor en BCD
      S     Z 1             // flanco → carga 5
      U     E 1.3
      R     Z 1             // reset (por nivel)
      L     Z 1             // valor en binario
      T     MW 20
      LC    Z 1             // valor en BCD
      T     MW 22
      U     Z 1             // 1 si valor > 0
      =     A 5.1
```

### 7.9 Carga y transferencia

| Instrucción | Efecto |
|---|---|
| `L op` | **ACU2 := ACU1; ACU1 := op**. Un byte o una palabra se cargan en la parte baja de ACU1 y el resto se rellena con **ceros** (sin extender el signo) |
| `T op` | op := parte baja de ACU1 (1, 2 o 4 bytes según el operando). **Se ejecuta siempre, sea cual sea el RLO**. No modifica los acumuladores |
| `LC T n` / `LC Z n` | Carga en BCD el valor de un temporizador o contador |
| `L STW` / `T STW` | Lee o escribe la palabra de estado |
| `L DBNO` / `L DBLG` | Número / longitud del DB abierto |

```awl
      L     MW 10           // ACU1 = MW10              ACU2 = (anterior)
      L     MW 12           // ACU1 = MW12              ACU2 = MW10
      +I                    // ACU1 = MW10 + MW12       ACU2 = MW10 (con 2 ACU no cambia)
      T     MW 14           // MW14 := ACU1-L
```

> **T es incondicional.** Para transferir solo si se cumple una condición hay que saltar por encima: `U E0.0 / SPBN NO / L 5 / T MW10 / NO: NOP 0`.
>
> **Ceros, no signo.** `L MW 10` con MW10 = −1 (W#16#FFFF) deja ACU1 = DW#16#0000FFFF. Para tratarlo como DINT hay que usar `ITD`.

### 7.10 Aritmética

| Instrucción | Operación | Resultado |
|---|---|---|
| `+I`, `-I` | ACU2-L ± ACU1-L (INT) | ACU1-L |
| `*I` | ACU2-L × ACU1-L | **ACU1 entero, como DINT** (OV = 1 si no cabe en INT) |
| `/I` | ACU2-L ÷ ACU1-L | **Cociente en ACU1-L, resto en ACU1-H** |
| `+D`, `-D`, `*D` | DINT | ACU1 |
| `/D` | DINT, cociente entero | ACU1 (el resto se pierde) |
| `MOD` | Resto DINT | ACU1. El signo del resto es el del dividendo |
| `+R`, `-R`, `*R`, `/R` | REAL | ACU1 |
| `ABS`, `SQR`, `SQRT`, `EXP`, `LN`, `SIN`, `COS`, `TAN`, `ASIN`, `ACOS`, `ATAN` | Funciones REAL sobre ACU1 (ángulos en radianes) | ACU1 |
| `+ cte` | ACU1 + constante | ACU1. **No modifica la palabra de estado** |
| `INC n` / `DEC n` | Suma o resta n **solo al byte bajo** de ACU1 (ACU1-LL) | Sin acarreo y sin bits de estado |

- Con 2 acumuladores, el ACU2 **no cambia** tras la operación.
- La división entera **trunca hacia 0**: `-17 /I 5` da cociente −3 y resto −2.

**Bits de estado tras `+I`** (las demás operaciones INT y DINT siguen la misma idea):

| Resultado matemático | Valor guardado | A1 | A0 | OV | OS |
|---|---|---|---|---|---|
| = 0 | 0 | 0 | 0 | 0 | — |
| −32768 ≤ r < 0 | r | 0 | 1 | 0 | — |
| 0 < r ≤ 32767 | r | 1 | 0 | 0 | — |
| r > 32767 (desbordamiento positivo) | r − 65536 (queda negativo) | 0 | 1 | **1** | **1** |
| r < −32768 (desbordamiento negativo) | r + 65536 (queda positivo) | 1 | 0 | **1** | **1** |
| r = −65536 | 0 | 0 | 0 | **1** | **1** |

Ejemplo: 30000 + 10000 → se guarda **−25536**, con OV = 1 y OS = 1.

- **División por 0**: A1 = A0 = 1, OV = OS = 1. El resultado no es válido.
- **REAL**: un resultado infinito pone OV y OS a 1. Un resultado no válido (NaN) pone además A1 = A0 = 1.

### 7.11 Comparación

`==I`, `<>I`, `>I`, `<I`, `>=I`, `<=I` comparan **ACU2 con ACU1**: `L a / L b / >I` significa "a > b". Las variantes `…D` comparan DINT y las `…R` comparan REAL.

- El resultado (1 o 0) **se escribe en el RLO y sustituye al anterior**: no se combina con él. Para usarlo en serie con contactos hay que meterlo **entre paréntesis**:

```awl
      U     E 2.0
      U(
      L     MW 30
      L     500
      >I
      )
      =     A 5.6           // A5.6 = E2.0 ∧ (MW30 > 500)
```

- La comparación también pone A1/A0 (§7.2), pone OV = 0 y deja /ER = 1. La cadena puede continuar con `U`, `O`...

### 7.12 Conversión

| AWL | KOP | Conversión | Notas |
|---|---|---|---|
| `BTI` | `BCD_I` | BCD de 3 cifras → INT (ACU1-L) | Cifra no válida → error BCD (OB121) |
| `ITB` | `I_BCD` | INT → BCD de 3 cifras | Fuera de ±999 → OV = OS = 1 y no convierte |
| `BTD` | `BCD_DI` | BCD de 7 cifras → DINT | |
| `DTB` | `DI_BCD` | DINT → BCD de 7 cifras | |
| `ITD` | `I_DI` | INT → DINT (extiende el signo) | |
| `DTR` | `DI_R` | DINT → REAL | Por encima de 2²⁴ puede perder precisión |
| `RND` | `ROUND` | REAL → DINT, redondeando al más próximo | En el caso exacto de x,5 el manual de AWL indica redondeo al par |
| `TRUNC` | `TRUNC` | REAL → DINT truncando hacia 0 | 3,9 → 3 ; −3,9 → −3 |
| `RND+` | `CEIL` | REAL → DINT hacia +∞ | 3,2 → 4 ; −3,2 → −3 |
| `RND-` | `FLOOR` | REAL → DINT hacia −∞ | 3,2 → 3 ; −3,2 → −4 |
| `INVI` / `INVD` | `INV_I` / `INV_DI` | Complemento a 1 (invierte los bits) | |
| `NEGI` / `NEGD` | `NEG_I` / `NEG_DI` | Complemento a 2 (cambia el signo) | |
| `NEGR` | `NEG_R` | Cambia el signo de un REAL | |
| `CAW` | — | Intercambia los 2 bytes de ACU1-L | |
| `CAD` | — | Invierte el orden de los 4 bytes de ACU1 | |

**Escalado analógico típico** (0..27648 → 0..100 %):

```awl
      L     PEW 256         // valor bruto (INT)
      ITD                   // INT → DINT
      DTR                   // DINT → REAL
      L     2.764800e+004
      /R
      L     1.000000e+002
      *R
      T     MD 60           // % en REAL
```

### 7.13 Lógica de palabras y desplazamientos

| Instrucción | Efecto |
|---|---|
| `UW`, `OW`, `XOW` | ACU1-L := ACU1-L (Y / O / O-exclusiva) ACU2-L. Si llevan constante (`UW W#16#00FF`), operan con la constante |
| `UD`, `OD`, `XOD` | Lo mismo con 32 bits |
| `SLW n` / `SRW n` | Desplaza ACU1-L n bits a la izquierda / derecha, rellenando con 0 |
| `SSI n` | Desplaza ACU1-L a la derecha manteniendo el signo |
| `SLD n` / `SRD n` / `SSD n` | Desplazamientos de 32 bits |
| `RLD n` / `RRD n` | Rota ACU1 n bits a la izquierda / derecha |
| `RLDA` / `RRDA` | Rota 1 bit pasando por A1 |

- Sin operando, el número de posiciones se toma de ACU2-LL.
- Tras la lógica de palabras: A1 = (resultado ≠ 0), A0 = 0 y OV = 0.
- Tras un desplazamiento: A1 = último bit que ha salido.

Ejemplo: aislar el byte bajo de una palabra con `L MW 10 / UW W#16#00FF / T MW 12`.

### 7.14 Operaciones con acumuladores

| Instrucción | Qué hace |
|---|---|
| `TAK` | Intercambia ACU1 y ACU2 |
| `PUSH` | ACU2 := ACU1 |
| `POP` | ACU1 := ACU2 |
| `ENT`, `LEAVE` | Solo en CPU con 4 acumuladores |
| `INC n`, `DEC n` | Byte bajo de ACU1 (0..255) |
| `+ n` | Suma una constante a ACU1 |
| `NOP 0`, `NOP 1` | No hacen nada (se usan como destino de salto) |

### 7.15 Saltos

| Instrucción | Salta si… | Efecto en los bits de estado |
|---|---|---|
| `SPA meta` | siempre | ninguno |
| `SPB meta` | RLO = 1 | **Siempre** deja RLO := 1, /ER := 0, OR := 0, STA := 1 (salte o no) |
| `SPBN meta` | RLO = 0 | Igual que SPB |
| `SPBB meta` | RLO = 1 (antes copia el RLO a RB) | Igual que SPB, y RB := RLO |
| `SPBNB meta` | RLO = 0 (antes copia el RLO a RB) | Igual que SPBN, y RB := RLO |
| `SPBI` / `SPBIN` | RB = 1 / RB = 0 | — |
| `SPO` | OV = 1 | — |
| `SPS` | OS = 1 | Pone OS := 0 |
| `SPZ` | resultado = 0 (A1 = 0, A0 = 0) | — |
| `SPN` | resultado ≠ 0 | — |
| `SPP` | resultado > 0 (A1 = 1, A0 = 0) | — |
| `SPM` | resultado < 0 (A1 = 0, A0 = 1) | — |
| `SPPZ` | resultado ≥ 0 | — |
| `SPMZ` | resultado ≤ 0 | — |
| `SPU` | no válido (A1 = 1, A0 = 1) | — |
| `LOOP meta` | ACU1-L := ACU1-L − 1; salta si ≠ 0 | — |
| `SPL meta` | Lista de saltos según ACU1-LL (varios `SPA` seguidos) | — |

> **Trampa**: si `SPB` no salta, el RLO queda a **1**. `U E0.0 / SPB X / = A4.0` pone A4.0 = 1 cuando E0.0 = 0.
>
> **Trampa con `LOOP`**: si ACU1-L vale 0 al llegar a `LOOP`, pasa a 65535 y el cuerpo del bucle se repite otras 65535 veces. Hay que comprobar antes que el contador sea mayor que 0.

**Bucle con `LOOP`**:

```awl
      L     5
SIG:  T     MW 10           // contador del bucle
      // ... cuerpo del bucle (usa MW10) ...
      L     MW 10
      LOOP  SIG             // MW10−1; repite mientras sea ≠ 0
```

### 7.16 Bits de estado como operandos

`U OV`, `U OS`, `U BIE` (RB), `U ==0`, `U <>0`, `U >0`, `U <0`, `U >=0`, `U <=0` y `U UO` (no ordenable). También funcionan con `UN`, `O`, `ON`, `X` y `XN`.

```awl
      L     MW 40
      L     MW 42
      +I
      T     MW 44
      U     OV              // ¿desbordó esta suma?
      =     M 1.0
```

### 7.17 Fin de bloque y llamadas

| Instrucción | Efecto |
|---|---|
| `BE` | Fin de bloque |
| `BEA` | Fin de bloque incondicional |
| `BEB` | Fin de bloque si RLO = 1. Si RLO = 0 sigue, con RLO := 1 y /ER := 0 |
| `CALL` | Llamada con parámetros (§5.4) |
| `UC` / `CC` | Llamada incondicional / condicional, sin parámetros |

### 7.18 Bloques de datos

```awl
      AUF   DB 1            // abre el DB1 como DB global
      L     DBW 0           // DB1.DBW0
      T     MW 10
      U     DB1.DBX 2.0     // dirección completa (también abre el DB1)
      =     A 4.0
```

### 7.19 Direccionamiento indirecto (avanzado)

- **Por memoria**: la dirección está en una marca o en un dato, en formato puntero. Por ejemplo: `L MW [MD 30]` o `U E [MD 34]`.
- **Por registro**: `LAR1 P#M 100.0` y luego `L MW [AR1, P#2.0]`.
- Formato del puntero de área (32 bits): número de byte × 8 + número de bit. Por ejemplo, `P#10.0` equivale a 80.

Ejemplo: sumar MW100..MW118 recorriéndolos con un puntero.

```awl
      L     P#100.0
      T     MD 30           // puntero al primer elemento
      L     0
      T     MW 40           // suma = 0
      L     10              // 10 elementos
SIG:  T     MW 34
      L     MW 40
      L     MW [MD 30]
      +I
      T     MW 40
      L     MD 30
      L     P#2.0           // siguiente palabra
      +D
      T     MD 30
      L     MW 34
      LOOP  SIG
```

### 7.20 MCR (Master Control Relay)

- `MCRA` activa el área MCR y `MCRD` la desactiva.
- Dentro de `MCR(` … `)MCR`, si la condición que precede a `MCR(` es 0, todas las asignaciones `=` y las transferencias `T` escriben 0. Las `S` y `R` no actúan.
- **No sustituye a un circuito de emergencia cableado.**

### 7.21 Método de traza (para resolver ejercicios a mano)

Se anota, línea a línea, el estado de /ER, RLO, STA y OR. Ejemplo con E0.0 = 1, E0.1 = 0, E0.2 = 1 y E0.3 = 1:

| Instrucción | /ER antes | STA | RLO después | OR | Comentario |
|---|---|---|---|---|---|
| `U E 0.0` | 0 | 1 | 1 | 0 | Primera consulta: RLO := 1 |
| `U E 0.1` | 1 | 0 | 0 | 0 | 1 ∧ 0 |
| `O` | 1 | 1 | 0 | 0 | OR := RLO (0); /ER := 0 |
| `U E 0.2` | 0 | 1 | 1 | 0 | Primera consulta del 2.º grupo |
| `U E 0.3` | 1 | 1 | 1 | 0 | 1 ∧ 1 |
| `= A 4.0` | 1 | 1 | 1 | 0 | **A4.0 = 1**; /ER := 0 (STA = valor escrito) |

Con E0.0 = E0.1 = 1 y E0.2 = E0.3 = 0: tras `O`, el bit OR = 1. Las dos `U` siguientes dejan el RLO a 1, así que A4.0 = 1.

---

## 8. Equivalencias KOP ↔ AWL

### 8.1 Elementos

| KOP | AWL |
|---|---|
| Contacto NA en serie | `U op` |
| Contacto NC en serie | `UN op` |
| Primer contacto de un paralelo de contactos sueltos | `O op` (o `U op`) |
| Contacto NA / NC en paralelo | `O op` / `ON op` |
| Bobina `( )` | `= op` |
| `(S)` / `(R)` | `S op` / `R op` |
| `NOT` | `NOT` |
| `(#)` | `= op` (y la lógica sigue) |
| `(P)` / `(N)` | `FP m` / `FN m` |
| Comparador en serie | `U(` `L` `L` `>I` `)` |
| Bobina de temporizador `(SE)` | `L S5T#…` + `SE T n` |
| Salto `(JMP)` / `(JMPN)` | `SPB` / `SPBN` (o `SPA` si va directo a la barra) |
| `(RET)` | `BEB` |

### 8.2 Patrones de serie y paralelo

| Esquema | AWL |
|---|---|
| a ∧ b | `U a / U b` |
| a ∨ b | `O a / O b` |
| (a ∨ b) ∧ c | `O a / O b / U c` (secuencial) o `U( / O a / O b / ) / U c` |
| a ∧ (b ∨ c) | `U a / U( / O b / O c / )` |
| (a ∧ b) ∨ (c ∧ d) | `U a / U b / O / U c / U d` o `U( / U a / U b / ) / O( / U c / U d / )` |
| a ∧ ((b ∧ c) ∨ d) | `U a / U( / U b / U c / O d / )` |
| a ∧ (b ∨ (c ∧ d)) | `U a / U( / O b / O( / U c / U d / ) / )` |
| Varias bobinas en paralelo | lógica + `= x / = y / = z` |

### 8.3 Cuadros con EN/ENO

Al traducir un cuadro con EN a AWL, el editor genera un salto que se lo salta si EN = 0, y ajusta RB para que ENO refleje si hubo error. Esquema simplificado de `ADD_I` con EN:

```awl
      U     E 0.0           // EN
      SPBNB _001            // si EN = 0 → saltar (y RB := 0)
      L     MW 10
      L     MW 12
      +I
      T     MW 14
      UN    OV              // sin desbordamiento…
      SAVE                  // …RB := 1
      CLR
_001: U     BIE             // ENO = RB
      =     A 4.0
```

> No todo el AWL se puede convertir a KOP. Por ejemplo: saltos dentro de un segmento, operaciones con acumuladores (`TAK`, `+I` sueltos), direccionamiento indirecto o `O` sin operando en posiciones raras. Esos segmentos se quedan en AWL.

---

## 9. Errores típicos y trampas de examen

1. **Doble asignación**: `= A4.0` en dos sitios. Solo cuenta la última. Para juntar condiciones hay que usar `O` o `S`/`R`.
2. **AWL secuencial**: `U a / O b / U c` = (a ∨ b) ∧ c. Para a ∨ (b ∧ c) hace falta `O` sin operando o paréntesis.
3. **La comparación sustituye el RLO**: en serie con contactos, siempre entre `U( … )`.
4. **`T` es incondicional**: no depende del RLO.
5. **`SPB` no tomado deja RLO = 1.**
6. **Paro NC → contacto NA en el programa** (§1.3).
7. **El temporizador necesita flanco**: si la condición ya está a 1 cuando termina un reset, no rearranca hasta que vuelva a 0 y otra vez a 1.
8. **`L 500` no es un tiempo**: hay que usar `S5T#5S`. Un valor no BCD da error y la CPU pasa a STOP.
9. **Orden de bytes**: `E0.0` es el bit 8 de `EW0`; `MW10` = MB10 (alto) + MB11 (bajo).
10. **Solapamiento**: `MW10` y `MW11` comparten `MB11`.
11. **`L MW` no extiende el signo**: para pasar a DINT hay que usar `ITD`.
12. **`INC`/`DEC` solo actúan sobre el byte bajo**: `L 255 / INC 1` da 0, no 256.
13. **`*I` deja un DINT en ACU1**; **`/I` deja el resto en ACU1-H**.
14. **Desbordamiento**: 30000 + 10000 = −25536, con OV = 1.
15. **Contadores**: mantener la entrada a 1 no cuenta varias veces. El rango es 0..999.
16. **Marca de flanco compartida**: usar la misma marca para dos `FP` hace que fallen los dos.
17. **Temporales (L) sin inicializar**: tienen valores basura.
18. **Orden de los segmentos**: una marca calculada después de usarla llega con un ciclo de retraso.
19. **`LOOP` con contador 0**: da 65535 vueltas de más.
20. **Set/Reset**: la prioridad la da el orden de ejecución, no el tipo de bobina.

---

## 10. Convención de memoria para las prácticas

Para que todos los ejercicios de la app sean coherentes:

| Rango | Uso |
|---|---|
| E0.0..E3.7 | Pulsadores e interruptores (E0.1 = **paro NC** en los ejemplos de marcha y paro) |
| EW2 | Rueda de dígitos BCD (ejemplos de conversión) |
| A4.0..A7.7 | Pilotos, motores y displays (AW6 = display BCD) |
| PEW256 | Entrada analógica 0..27648 |
| M0.0..M9.7 | Marcas auxiliares |
| M10.0..M19.7 | Marcas de flanco |
| M20.0..M29.7 | Marcas de etapa (secuencias) |
| MW30..MW98 | Valores INT |
| MD100.. | Valores DINT o REAL |
| MB200 | Marca de ciclo (si se activa en el simulador) |
| T1..T20, Z1..Z10 | Temporizadores y contadores de los ejercicios |

---

## 11. Nemotécnica alemán ↔ inglés

| Alemán | Inglés (internacional) | Alemán | Inglés |
|---|---|---|---|
| `U` | `A` | `SPA` | `JU` |
| `UN` | `AN` | `SPB` | `JC` |
| `O` / `ON` | `O` / `ON` | `SPBN` | `JCN` |
| `X` / `XN` | `X` / `XN` | `SPBB` / `SPBNB` | `JCB` / `JNB` |
| `U(` / `UN(` | `A(` / `AN(` | `SPBI` / `SPBIN` | `JBI` / `JNBI` |
| `=`, `S`, `R`, `NOT`, `SET`, `CLR`, `SAVE` | iguales | `SPO` / `SPS` | `JO` / `JOS` |
| `FP` / `FN` | `FP` / `FN` | `SPZ` / `SPN` | `JZ` / `JN` |
| `SI` | `SP` | `SPP` / `SPM` | `JP` / `JM` |
| `SV` | `SE` | `SPPZ` / `SPMZ` | `JPZ` / `JMZ` |
| `SE` | `SD` | `SPU` / `SPL` | `JUO` / `JL` |
| `SS` | `SS` | `BE` / `BEB` / `BEA` | `BE` / `BEC` / `BEU` |
| `SA` | `SF` | `AUF` | `OPN` |
| `ZV` / `ZR` | `CU` / `CD` | `UW` / `UD` | `AW` / `AD` |
| `E` / `A` (operandos) | `I` / `Q` | `BIE` | `BR` |
| `PE` / `PA` | `PI` / `PQ` | `Z` (contador) | `C` |
| `S5T#`, `C#`, `L#`... | iguales | `KOP` / `FUP` / `AWL` | `LAD` / `FBD` / `STL` |

Cuidado con las confusiones: `SE` en alemán es retardo a la conexión, pero en inglés es impulso prolongado. `A` en alemán es una salida, pero en inglés es la instrucción Y.

---

## 12. Glosario

| Término | Significado |
|---|---|
| PAE / PAA | Imagen de proceso de entradas / de salidas |
| RLO (VKE) | Resultado lógico de la operación |
| /ER | Bit de primera consulta |
| STA | Bit de estado (valor del último operando consultado) |
| RB (BIE, BR) | Resultado binario (ENO, `SAVE`) |
| ACU1 / ACU2 | Acumuladores |
| Segmento | Network: unidad de programa en KOP/AWL |
| Enclavamiento | Autorretención de una salida con su propio contacto |
| Flanco | Cambio 0→1 (positivo) o 1→0 (negativo) |
| Remanente | Que conserva su valor tras un corte de alimentación o un STOP→RUN |
| OB / FC / FB / DB | Bloque de organización / función / bloque de función / bloque de datos |
| BCD | Decimal codificado en binario |
| S5TIME | Formato de tiempo de los temporizadores (base + 3 cifras BCD) |
