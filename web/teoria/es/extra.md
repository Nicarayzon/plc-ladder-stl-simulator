# Teoría que solo está en la web

> Apartados de las páginas de la web que no salen en «Aprender» de la app: la introducción a los PLC, las secuencias con GRAFCET, la presentación de los ejercicios resueltos y las guías paso a paso de KOP y AWL.
> - Los ejemplos que van dentro del texto se ponen con «<!-- probar: id -->» (`MINIS` en `web/teoria/ejemplos-web.ts`), y las figuras, con «<!-- figura -->».
> - Cada apartado empieza con «### <código> <título>» (I.1, S.1, P.1, K.1, A.1…). Los códigos los usa `web/teoria/paginas.ts`, igual que los números de la referencia.
> - Si cambias algo aquí, actualiza también `web/teoria/en/extra.md` y `web/teoria/de/extra.md`.

---

### I.1 ¿Qué es un PLC?

Un **PLC** (controlador lógico programable) o **autómata programable** es un ordenador pensado para gobernar máquinas e instalaciones industriales. Hace siempre lo mismo, sin parar:

1. **Lee las entradas**: pulsadores, interruptores, finales de carrera, sensores de presencia, sondas de nivel o de temperatura.
2. **Ejecuta el programa**: decide qué hacer según el estado de las entradas, el tiempo transcurrido y lo que recuerda (marcas, temporizadores y contadores).
3. **Escribe las salidas**: arranca motores mediante contactores, abre válvulas, enciende pilotos o mueve cilindros.

A esta repetición se le llama **ciclo de scan**, y suele durar pocos milisegundos (§1.1).

Antes de los PLC, la lógica de una máquina se construía **cableando relés**: para cambiar el funcionamiento había que recablear el armario. Con un PLC, el cableado de entradas y salidas se queda igual y lo que cambia es el **programa**.

### I.2 Partes de un PLC

| Parte | Para qué sirve |
|---|---|
| **Fuente de alimentación** | Convierte la tensión de la red en los 24 V DC que usan la CPU y los módulos |
| **CPU** | Ejecuta el programa y guarda los datos: imagen de proceso, marcas, temporizadores, contadores y bloques de datos (§2.1) |
| **Entradas digitales** | Leen señales de todo o nada (0 o 1), normalmente de 24 V |
| **Salidas digitales** | Activan contactores, electroválvulas o pilotos, por transistor o por relé |
| **Entradas y salidas analógicas** | Leen o generan valores continuos, como 0..10 V o 4..20 mA, que la CPU ve como números de 0 a 27648 (§2.3) |
| **Comunicaciones** | Conectan con el ordenador de programación, con las pantallas táctiles (HMI) y con otros autómatas |

En los **PLC compactos** todo va en una misma caja: la CPU con sus entradas y salidas integradas. En los **modulares**, cada parte es un módulo que se monta en un bastidor junto a la CPU, y se añaden los que hagan falta.

### I.3 PLC, relés y microcontroladores

| | Lógica cableada (relés) | PLC | Microcontrolador (por ejemplo, Arduino) |
|---|---|---|---|
| Cambiar el funcionamiento | Recablear | Cambiar el programa | Cambiar el programa |
| Entorno | Industrial | Industrial: resiste ruido eléctrico, vibraciones y temperatura | Laboratorio, prototipos y aprendizaje |
| Entradas y salidas | Contactos y bobinas | 24 V, módulos normalizados | 3,3 o 5 V: necesitan adaptación para la industria |
| Lenguajes | — | Normalizados (IEC 61131-3): KOP, FUP, AWL, texto estructurado, GRAFCET | C o C++ |
| Ejecución | Inmediata | Cíclica y predecible (ciclo de scan) | La que programes |

Un microcontrolador sirve para aprender electrónica y para prototipos. En una máquina industrial se usa un PLC porque está preparado para ese entorno, lo entiende cualquier técnico de mantenimiento y se puede sustituir y reparar durante muchos años.

### I.4 Lenguajes de programación de los PLC

La norma **IEC 61131-3** define los lenguajes de programación de los autómatas. Los nombres alemanes (KOP, FUP, AWL) son los más usados en la formación en español:

| Lenguaje | También llamado | Cómo es | Para qué va bien |
|---|---|---|---|
| **KOP** | Esquema de contactos, Ladder (LD, LAD) | Gráfico, como un esquema eléctrico de contactos y bobinas | Lógica de bits, enclavamientos y temporizadores. Lo entienden enseguida los electricistas |
| **FUP** | Diagrama de funciones (FBD) | Gráfico, con cuadros lógicos Y, O, biestables… como en electrónica digital | La misma lógica que KOP, dibujada con puertas lógicas |
| **AWL** | Lista de instrucciones (STL, IL) | Texto, una instrucción por línea, muy cerca de cómo trabaja la CPU | Entender la CPU por dentro, programas existentes, exámenes |
| **Texto estructurado** | ST | Texto parecido a Pascal, con `IF`, `FOR` y fórmulas | Cálculos, bucles y tratamiento de datos |
| **GRAFCET** | Diagrama funcional secuencial (SFC) | Gráfico, con etapas y transiciones | Secuencias de pasos (§S.1) |

Un mismo programa puede escribirse en KOP o en AWL: el editor traduce cada segmento KOP a AWL (§8.1). No todo el AWL tiene dibujo en KOP, pero todo el KOP tiene su AWL.

### I.5 ¿Qué lenguaje aprender?

- **Empieza por KOP.** Se lee como un esquema eléctrico y enseña lo esencial: contactos, bobinas, enclavamientos, flancos, temporizadores y contadores.
- **Aprende AWL para entender la CPU.** Con AWL ves el RLO, los acumuladores y el orden en que se ejecuta cada instrucción, y entiendes por qué un programa hace lo que hace. La norma IEC 61131-3 lo dejó como obsoleto en su edición de 2013 y en los equipos nuevos se usa cada vez menos, pero sigue en muchísimas máquinas en funcionamiento y en los exámenes de formación profesional y de ingeniería.
- **Después, texto estructurado (ST)**, para los cálculos y el tratamiento de datos, y **GRAFCET** para las secuencias.

---

### S.1 Qué es una secuencia

Muchas máquinas trabajan **por pasos**: un semáforo pasa de verde a ámbar y a rojo, una prensa baja, espera y sube, una lavadora llena, lava, vacía y centrifuga. Cada paso dura hasta que se cumple una condición (un tiempo, un sensor, un pulsador) y entonces empieza el siguiente.

Programar una secuencia con contactos sueltos se complica enseguida. Es mucho más claro **dibujarla primero como un GRAFCET** y traducirlo después a KOP o AWL con un método fijo.

### S.2 GRAFCET: etapas y transiciones

Un **GRAFCET** es un diagrama de etapas y transiciones:

- **Etapa**: un estado de la máquina. Se dibuja como un cuadrado numerado. La **etapa inicial**, la que está activa al arrancar, se dibuja con doble cuadrado.
- **Acción**: lo que se hace mientras la etapa está activa (encender una salida, arrancar un temporizador). Se escribe en un rectángulo a la derecha de la etapa.
- **Transición**: la condición para pasar de una etapa a la siguiente. Se dibuja como una raya horizontal entre las dos etapas, con su condición al lado.

**Reglas de evolución**:

1. Una transición se **franquea** cuando la etapa anterior está activa **y** se cumple su condición.
2. Al franquearla, se **activa** la etapa siguiente y se **desactiva** la anterior.
3. Varias transiciones que se puedan franquear a la vez se franquean a la vez.

<!-- figura -->

### S.3 De GRAFCET a KOP y AWL con marcas de etapa

El método más usado asigna **una marca a cada etapa** (por ejemplo, M20.0, M20.1, M20.2…), que vale 1 mientras la etapa está activa. Cada transición se programa con **Set y Reset**:

```awl
// Transición de la etapa 1 (M20.0) a la etapa 2 (M20.1)
      U     M 20.0          // la etapa 1 está activa
      U     T 10            // y se cumple la condición: han pasado los 5 s
      S     M 20.1          // activa la etapa 2
      R     M 20.0          // desactiva la etapa 1
```

En KOP es lo mismo: un contacto de la etapa, en serie con la condición, y dos bobinas en paralelo, `(S)` sobre la etapa siguiente y `(R)` sobre la actual.

El programa completo tiene siempre la misma estructura:

1. **Etapa inicial**: se activa al arrancar, en el OB100, o cuando no hay ninguna etapa activa.
2. **Transiciones**: un segmento por transición, con su Set y su Reset.
3. **Paro**: si hace falta, un segmento que hace Reset de todas las etapas.
4. **Salidas (acciones)**: al final, cada salida se asigna **una sola vez** a partir de las marcas de etapa. Si una salida actúa en varias etapas, se juntan con O: `O M 20.1 / O M 20.3 / = A 4.0`.

Las salidas van al final por la **doble asignación** (§1.2): si una misma salida se asignara en varias etapas, solo valdría la última.

**Temporizadores en las etapas**: el temporizador arranca con la propia marca de etapa (`U M 20.0 / L S5T#5S / SE T 10`) y su salida es la condición de la transición (`U T 10`). Al desactivarse la etapa, el temporizador se para solo.

### S.4 Consejos

- **Comprueba que solo hay una etapa activa** en una secuencia lineal. Si en el simulador se encienden dos marcas de etapa a la vez, falta un Reset.
- **Cuidado con la evolución en cascada.** Si la condición de la transición siguiente ya se cumple, la secuencia puede avanzar dos etapas en el mismo ciclo, porque el programa se ejecuta de arriba abajo. Para evitarlo, programa las transiciones en orden inverso (de la última a la primera) o calcula primero todas las transiciones en marcas auxiliares y aplica después los Set y Reset.
- **Usa un rango de marcas solo para las etapas**, por ejemplo M20.0..M29.7, y un temporizador distinto para cada etapa que lo necesite.

---

### P.1 Cómo usar estos ejercicios

Son ejercicios típicos de clase y de examen, resueltos y comprobados con pruebas automáticas en el simulador. En cada uno:

1. Lee el enunciado e intenta resolverlo antes de mirar nada. Si te atascas, abre la **pista** de «Solución».
2. Compara tu programa con la solución en KOP y en AWL.
3. Pruébalo en el panel: acciona las entradas y comprueba que las salidas hacen lo que pide el enunciado.

Los ejercicios usan pulsadores y sensores con direcciones absolutas. Los paros están cableados como **NC**, así que empiezan a 1 (§1.3).

---

### K.1 Cómo se lee un esquema KOP

Un programa en KOP se dibuja como un **esquema eléctrico de contactos y bobinas**, y se lee igual:

- El programa se divide en **segmentos**. Cada segmento es una «línea» del esquema, con su lógica y su salida.
- A la izquierda está la **barra de alimentación**: de ella sale la «corriente».
- La corriente avanza **de izquierda a derecha** a través de los **contactos**. Cada contacto deja pasar la corriente o la corta según el valor de un bit (una entrada, una salida, una marca…).
- A la derecha está la **bobina**: si le llega corriente, escribe un 1 en su bit; si no le llega, escribe un 0.

Esa «corriente» no es electricidad de verdad: es el **resultado lógico** que la CPU calcula al ejecutar el segmento, un 1 o un 0. En AWL se llama **RLO** (§7.3). En el simulador, el tramo por el que pasa corriente se ve en **verde continuo** y el que no, en **azul discontinuo**.

Pruébalo: activa la entrada E 0.0 y mira cómo la corriente atraviesa el contacto y llega a la bobina, que enciende la salida A 4.0.

<!-- probar: na -->

### K.2 Contacto normalmente abierto (NA)

El contacto NA `--| |--` **pregunta: «¿este bit vale 1?»**

| Bit del contacto | ¿Conduce? |
|---|---|
| 0 | No: corta la corriente |
| 1 | Sí: deja pasar la corriente |

Funciona como un pulsador normalmente abierto: cuando el bit vale 1, «cierra» el circuito. Es el contacto más usado: sirve para leer pulsadores, sensores, marcas y también salidas. En AWL equivale a la instrucción `U` (§A.2).

### K.3 Contacto normalmente cerrado (NC)

El contacto NC `--|/|--` **pregunta: «¿este bit vale 0?»**. Es el NA al revés:

| Bit del contacto | ¿Conduce? |
|---|---|
| 0 | Sí: deja pasar la corriente |
| 1 | No: corta la corriente |

Pruébalo: con E 0.0 a 0 el piloto está encendido. Al activar E 0.0, el contacto se abre y el piloto se apaga.

<!-- probar: nc -->

En AWL equivale a `UN` (§A.3).

> **No confundas el contacto del programa con el pulsador real.** El contacto del programa solo pregunta por el valor del bit; no sabe cómo está cableado el pulsador. Un pulsador de paro se cablea NC (da 1 en reposo) y en el programa se pregunta con un contacto **NA** (§1.3).

### K.4 Contactos en serie: la función Y (AND)

Cuando pones contactos **uno detrás de otro**, la corriente solo llega a la bobina si **conducen todos**. Es la función **Y**:

| E 0.0 | E 0.1 | A 4.0 |
|---|---|---|
| 0 | 0 | 0 |
| 0 | 1 | 0 |
| 1 | 0 | 0 |
| 1 | 1 | **1** |

Pruébalo: A 4.0 solo se enciende con las dos entradas activadas.

<!-- probar: y -->

En serie puedes mezclar contactos NA y NC. Por ejemplo, «marcha **y no** hay alarma» es un NA de la marcha en serie con un NC de la alarma:

<!-- probar: y-no -->

### K.5 Contactos en paralelo: la función O (OR)

Cuando pones contactos en **ramas paralelas**, la corriente llega a la bobina si conduce **al menos una** de las ramas. Es la función **O**:

| E 0.0 | E 0.1 | A 4.0 |
|---|---|---|
| 0 | 0 | 0 |
| 0 | 1 | **1** |
| 1 | 0 | **1** |
| 1 | 1 | **1** |

Sirve, por ejemplo, para encender una luz desde dos pulsadores distintos. Pruébalo:

<!-- probar: o -->

Una rama paralela también puede tener un contacto NC: aquí A 4.0 se enciende si E 0.0 vale 1 **o** si E 0.1 vale 0.

<!-- probar: o-no -->

### K.6 Combinar serie y paralelo

Los esquemas reales mezclan las dos cosas, y se leen igual que un circuito eléctrico: la corriente tiene que **pasar por alguna de las ramas paralelas y después por los contactos en serie**.

En este ejemplo, A 4.0 = (E 0.0 **o** E 0.1) **y** E 0.2. Pruébalo: activa E 0.2 y, después, una de las otras dos.

<!-- probar: combinado -->

Así se construyen casi todos los automatismos. Por ejemplo, la marcha y paro con enclavamiento es «(marcha **o** el propio motor) **y** paro» (§6.4). Para pasar una combinación así a AWL se usan paréntesis o `O` sin operando (§7.4 y §8.2).

### K.7 Bobinas, Set, Reset y NOT

A la derecha del segmento van los elementos que **escriben** el resultado:

- **Bobina `( )`**: escribe el resultado siempre: 1 si le llega corriente, 0 si no. Cada operando debe tener **una sola bobina** en todo el programa; si tiene dos, solo cuenta la última (§1.2).
- **Varias bobinas en paralelo** al final de un segmento reciben la misma corriente: todas valen lo mismo.
- **Set `(S)`** y **Reset `(R)`**: si les llega corriente, ponen el bit a 1 o a 0; si no, **no hacen nada** y el bit conserva su valor. Sirven para «recordar» (§6.4).
- **NOT `--|NOT|--`**: invierte la corriente. Lo que llega como 1 sale como 0, y al revés.

Pruébalo: con E 0.0, las dos bobinas del primer segmento se encienden a la vez; la del segundo hace lo contrario, por el NOT.

<!-- probar: bobinas -->

---

### A.1 Cómo se lee un programa AWL

En AWL el programa se escribe **en texto**, con una instrucción por línea. Cada línea tiene una **operación** y, casi siempre, un **operando**:

| Línea | Operación | Operando | Se lee |
|---|---|---|---|
| `U E 0.0` | `U` (Y) | `E 0.0` | «y la entrada 0.0» |
| `UN E 0.1` | `UN` (Y no) | `E 0.1` | «y no la entrada 0.1» |
| `= A 4.0` | `=` (asignar) | `A 4.0` | «el resultado, a la salida 4.0» |

La CPU ejecuta las líneas **de arriba abajo**. Las instrucciones lógicas van calculando un resultado, el **RLO** (resultado lógico), que es lo mismo que la «corriente» de KOP: cada instrucción combina el RLO con su operando, y al final `=` lo escribe en una salida.

Ejemplo, línea a línea, con E 0.0 = 1 y E 0.1 = 0:

| Instrucción | Qué hace | RLO después |
|---|---|---|
| `U E 0.0` | Primera instrucción de la cadena: copia E 0.0 | 1 |
| `U E 0.1` | 1 Y 0 | 0 |
| `= A 4.0` | Escribe el RLO en A 4.0 | A 4.0 = 0 |

La **primera** instrucción lógica después de una asignación no combina nada: **copia** su operando en el RLO. Es la «primera consulta» (§7.3).

### A.2 U: Y (AND)

`U` significa **«y además este bit vale 1»**. Combina el RLO con el operando mediante una **Y**: el resultado solo sigue a 1 si el operando vale 1.

- En KOP equivale a un **contacto NA en serie**.
- Varias `U` seguidas: el resultado es 1 solo si **todas** se cumplen.

<!-- probar: y -->

### A.3 UN: Y negada (AND NOT)

`UN` significa **«y además este bit vale 0»**. Es una Y con el operando invertido: RLO := RLO ∧ ¬operando.

- En KOP equivale a un **contacto NC en serie**.
- Es la forma de escribir condiciones como «marcha **y no** hay alarma»:

<!-- probar: y-no -->

### A.4 O: O (OR)

`O` significa **«o este bit vale 1»**. Combina el RLO con el operando mediante una **O**: el resultado es 1 si se cumple alguna de las condiciones.

- En KOP equivale a un **contacto NA en paralelo**.
- Para un paralelo de contactos sueltos se escribe `O` también en la primera línea (`O E 0.0 / O E 0.1`), aunque `U E 0.0 / O E 0.1` daría lo mismo: la primera instrucción solo copia el operando.

<!-- probar: o -->

### A.5 ON: O negada (OR NOT)

`ON` significa **«o este bit vale 0»**: RLO := RLO ∨ ¬operando. En KOP equivale a un **contacto NC en paralelo**.

<!-- probar: o-no -->

### A.6 X y XN: O-exclusiva

`X` es la **O-exclusiva**: el resultado es 1 si **solo uno** de los dos vale 1, y 0 si valen lo mismo. `XN` es lo contrario: 1 cuando los dos valen lo mismo.

| E 0.0 | E 0.1 | `X E 0.0 / X E 0.1` | `X E 0.0 / XN E 0.1` |
|---|---|---|---|
| 0 | 0 | 0 | 1 |
| 0 | 1 | 1 | 0 |
| 1 | 0 | 1 | 0 |
| 1 | 1 | 0 | 1 |

Un uso típico es la **luz conmutada** de un pasillo: dos interruptores, uno en cada extremo, y cualquiera de los dos cambia el estado de la luz. En KOP no hay contacto de O-exclusiva: se dibuja con dos ramas (§6.3), como en este esquema.

<!-- probar: xor -->

### A.7 =, S y R: escribir el resultado

Cuando la lógica está calculada, hay que escribir el RLO en algún sitio:

| Instrucción | Qué hace | En KOP |
|---|---|---|
| `= A 4.0` | A 4.0 := RLO, siempre (1 o 0) | Bobina `( )` |
| `S A 4.0` | Si RLO = 1, A 4.0 := 1. Si RLO = 0, no hace nada | Bobina `(S)` |
| `R A 4.0` | Si RLO = 1, A 4.0 := 0. Si RLO = 0, no hace nada | Bobina `(R)` |

- Después de `=`, `S` o `R`, la cadena se cierra: la siguiente `U` u `O` empieza una lógica nueva.
- Se pueden escribir varias `=` seguidas para asignar el mismo resultado a varias salidas.
- Con `S` y `R` el bit «recuerda» su valor. Pruébalo: un impulso en E 0.0 enciende A 4.0, que sigue encendida al soltar E 0.0, hasta que E 0.1 la apaga.

<!-- probar: set-reset -->

### A.8 NOT, SET y CLR

Estas tres instrucciones no tienen operando y actúan **directamente sobre el RLO**:

| Instrucción | Qué hace | Ejemplo de uso |
|---|---|---|
| `NOT` | Invierte el RLO | `U E 0.0 / U E 0.1 / NOT / = A 4.0` es una NAND |
| `SET` | Pone el RLO a 1 | Escribir un 1 fijo: `SET / = M 0.0` |
| `CLR` | Pone el RLO a 0 | Escribir un 0 fijo: `CLR / = M 0.0` |

> **Cuidado con `SET`**: no pone a 1 ningún operando, solo el RLO. Para activar un bit se usa `S`.
