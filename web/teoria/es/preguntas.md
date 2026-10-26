# Preguntas frecuentes de cada página

> Bloque «Preguntas frecuentes» del final de cada página de teoría de la web.
> - «## id» es el id de la página en `web/teoria/paginas.ts`. Debajo, cada «### ¿Pregunta?» lleva su respuesta en Markdown.
> - Respuestas cortas y directas: es lo que busca la gente y lo que leen los buscadores.
> - Muchas salen del banco de preguntas de teoría de la app (M01–M24, en `src/content/ejemplos_KOP_AWL.md`).

## intro

### ¿Qué es un PLC o autómata programable?

Es un ordenador industrial que gobierna máquinas e instalaciones: lee pulsadores y sensores por sus entradas, ejecuta un programa en un ciclo que se repite sin parar y activa motores, válvulas o pilotos por sus salidas. Sustituye a los automatismos cableados con relés.

### ¿Qué diferencia hay entre un PLC y un Arduino?

El PLC está hecho para la industria: entradas y salidas de 24 V, resistencia al ruido eléctrico y a las vibraciones, ejecución cíclica predecible, lenguajes normalizados (IEC 61131-3) y repuestos durante muchos años. Un Arduino es una placa de microcontrolador pensada para aprender y hacer prototipos, y se programa en C++.

### ¿Qué lenguaje de PLC conviene aprender primero?

KOP (esquema de contactos), porque se lee como un esquema eléctrico. Después, AWL para entender cómo trabaja la CPU por dentro, y más adelante texto estructurado (ST) para los cálculos y GRAFCET para las secuencias.

### ¿Necesito un autómata real para aprender a programarlo?

No. Con un simulador puedes escribir programas en KOP y AWL, accionar las entradas y ver cómo responden las salidas, los temporizadores y los contadores. Cuando trabajes con un autómata real, llegarás con el programa ya probado.

## ciclo

### ¿Qué es el ciclo de scan de un PLC?

Es la vuelta que la CPU repite sin parar: lee las entradas en la imagen de proceso (PAE), ejecuta el OB1 de arriba abajo y copia la imagen de salidas (PAA) a las salidas físicas. Después atiende las comunicaciones y empieza otra vez.

### Si asigno la misma salida en dos sitios, ¿qué valor llega a la salida?

El de la última asignación que se ejecuta. La PAA se escribe al final del ciclo, así que la última asignación sobrescribe a las anteriores. Para juntar condiciones, usa una O o bobinas Set y Reset.

### ¿Por qué el pulsador de paro se programa con un contacto NA?

Porque el paro se cablea como contacto NC: en reposo la entrada vale 1, y el contacto NA del programa solo pregunta «¿vale 1?». Si se rompe el cable, la entrada cae a 0 y la máquina se para, que es lo seguro.

### ¿Qué OB se ejecuta una sola vez al arrancar la CPU?

El OB100, en el rearranque completo al pasar de STOP a RUN. Sirve para inicializar. Después empieza el ciclo del OB1.

## memoria

### ¿Qué bytes forman la palabra de marcas MW 10?

MB10 y MB11. Una palabra son 2 bytes empezando en la dirección indicada: MB10 es el byte alto y MB11, el bajo. Por eso las palabras se usan de 2 en 2 (MW10, MW12…).

### ¿Por qué EW 0 vale 256 si solo está activa la entrada E 0.0?

Porque el byte de dirección más baja es el más significativo: EB0 es el byte alto de EW0, y E0.0 es su bit 8. Si solo estuviera activa E1.0, EW0 valdría 1.

### ¿Qué valor da una entrada analógica a 10 V o a 20 mA?

27648, el final del rango nominal. Por encima está el rango de rebase, hasta 32511, y el valor 32767 indica desbordamiento o rotura de hilo.

### ¿Qué son las marcas remanentes?

Las que conservan su valor tras un corte de alimentación o un paso de STOP a RUN. Se configuran en las propiedades de la CPU; en muchas CPU vienen por defecto MB0..MB15.

## tipos

### ¿Qué es el BCD y para qué se usa en los autómatas?

Es una forma de guardar números en la que cada grupo de 4 bits es una cifra decimal del 0 al 9: `W#16#0123` en BCD vale 123. Lo usan las ruedas de dígitos, los displays y los valores de tiempo y de contaje.

### ¿Cómo se guarda S5T#5S en el acumulador?

Como `W#16#0500`: base de tiempo de 10 ms (bits 13-12 = 00) y el valor 500 en BCD.

### ¿Por qué `L 500` no sirve como valor de tiempo?

Porque 500 en binario es `W#16#01F4`, que contiene la cifra F y no es un BCD válido. Al arrancar el temporizador hay un error y la CPU pasa a STOP. Hay que escribir `L S5T#5S`.

### ¿Cómo paso un número INT a REAL?

En dos pasos: `ITD` (INT a DINT) y después `DTR` (DINT a REAL). En KOP, con los cuadros `I_DI` y `DI_R`. No existe una conversión directa de INT a REAL.

## bloques

### ¿Qué diferencia hay entre un FC y un FB?

El FB tiene memoria propia: un DB de instancia donde guarda sus variables estáticas (STAT), que conservan el valor entre llamadas. Un FC solo tiene variables temporales, que se pierden al terminar.

### ¿Qué OB ejecuta el programa principal?

El OB1, que la CPU ejecuta cíclicamente. El OB100 es el arranque, el OB35 la alarma cíclica y el OB80 el error de tiempo.

### ¿Qué pasa si hay un error y su OB no está programado?

La CPU pasa a STOP. Por ejemplo, un BCD no válido llama al OB121: si el OB121 no está cargado, la CPU se para.

## kop

### ¿Qué es KOP o Ladder?

Es el lenguaje gráfico de los autómatas que se parece a un esquema eléctrico: la corriente sale de una barra a la izquierda, pasa por contactos y llega a bobinas a la derecha. En inglés se llama Ladder (LAD o LD).

### ¿Qué diferencia hay entre un contacto NA y uno NC en KOP?

El contacto NA `--| |--` conduce cuando su bit vale 1, y el NC `--|/|--` cuando vale 0. Los dos solo preguntan el estado del bit: no saben cómo está cableado el pulsador real.

### ¿A qué equivalen dos contactos en serie o en paralelo?

En serie, a una función Y (AND): la corriente solo pasa si conducen los dos. En paralelo, a una función O (OR): basta con que conduzca uno.

## awl

### ¿Qué es el RLO en AWL?

El resultado lógico de la operación: el bit de la palabra de estado donde se va acumulando el resultado de las instrucciones lógicas (`U`, `O`, `X`…). Las asignaciones `=`, `S` y `R` lo escriben en un operando.

### ¿Para qué sirve el bit /ER (primera consulta)?

Indica si la siguiente instrucción lógica empieza una cadena nueva. Con /ER = 0, la siguiente `U`, `O` o `X` copia el operando en el RLO en lugar de combinarlo con él.

### ¿Por qué `U a / O b / U c` no calcula «a o (b y c)»?

Porque AWL evalúa de forma secuencial: calcula (a ∨ b) ∧ c. Para obtener a ∨ (b ∧ c) hay que usar `O` sin operando o paréntesis.

### ¿Cuántos paréntesis anidados admite AWL?

Siete niveles. Si se superan, hay un error y la CPU pasa a STOP.

### ¿Qué hace la instrucción SET en AWL?

Pone el RLO a 1 y cierra la cadena lógica (/ER = 0). No pone a 1 ningún operando: para eso está `S`.

## setreset

### ¿Qué es un enclavamiento o autorretención?

Un circuito en el que la salida se mantiene encendida a través de su propio contacto: el pulsador de marcha la enciende y, al soltarlo, el contacto de la propia salida la mantiene hasta que se pulsa el paro.

### Si un bit tiene Set y Reset activos a la vez, ¿cuál gana?

La instrucción que se ejecuta la última. Con el Reset detrás, gana el paro; con el Set detrás, gana la marcha. La prioridad la da el orden, no el tipo de bobina.

### ¿Qué instrucción AWL equivale a la bobina (S) de KOP?

`S`. No hay que confundirla con `SET`, que pone el RLO a 1, ni con `SE`, que arranca un temporizador.

### ¿Qué diferencia hay entre los biestables SR y RS?

Con las dos entradas a 1, el SR da prioridad al reset (Q = 0) y el RS al set (Q = 1).

## flancos

### ¿Qué es un flanco positivo en un autómata?

El cambio de una señal de 0 a 1. Un detector de flanco da 1 solo durante el ciclo en que ocurre ese cambio, aunque la señal se quede a 1 después. El flanco negativo es el cambio de 1 a 0.

### ¿Por qué cada flanco necesita su propia marca?

Porque la marca de flanco guarda el estado del ciclo anterior. Si dos `FP` comparten la misma marca, cada uno pisa lo que guarda el otro y los dos fallan.

### ¿Cómo hago que un mismo pulsador encienda y apague una lámpara?

Con un telerruptor: un flanco positivo del pulsador y un enclavamiento que cambia el estado de la salida en cada flanco (ejemplo E11). Sin el flanco, la salida cambiaría en cada ciclo mientras se mantiene pulsado.

## temporizadores

### ¿Qué diferencia hay entre los temporizadores SE y SS?

Los dos son retardos a la conexión. SE solo activa Q si S sigue a 1 todo el tiempo; si S cae antes, se para. SS sigue contando aunque S caiga y, al terminar, mantiene Q a 1 hasta que se hace un reset.

### ¿Qué temporizador mantiene Q a 1 todo el tiempo aunque S caiga antes?

SV, el impulso prolongado (S_VIMP). El impulso SI, en cambio, se corta si S cae antes de tiempo.

### ¿Qué temporizador activa Q en cuanto S = 1 y lo mantiene un tiempo después de que S caiga?

SA, el retardo a la desconexión (S_AVERZ): el tiempo empieza a contar en el flanco negativo de S.

### ¿Por qué mi temporizador no vuelve a arrancar después de un reset?

Porque necesita un flanco nuevo en S. Si la condición de arranque ya estaba a 1 cuando terminó el reset, tiene que volver a 0 y otra vez a 1.

## contadores

### ¿Cuál es el rango de valores de un contador?

De 0 a 999, porque el valor se guarda en 3 cifras BCD. No baja de 0 ni sube de 999.

### ¿Por qué el contador solo suma 1 aunque mantenga pulsado el botón?

Porque cuenta flancos, no niveles: para sumar otra unidad, la entrada tiene que volver a 0 y luego a 1.

### ¿Cómo leo el valor de un contador en AWL?

Con `L Z 1` obtienes el valor en binario y con `LC Z 1`, en BCD. `U Z 1` devuelve 1 si el valor es mayor que 0.

## marcaciclo

### Con MB100 como marca de ciclo, ¿qué bit oscila a 1 Hz?

`M 100.5`, que tiene un periodo de 1 s. Los periodos de los bits 0 a 7 son 0,1 / 0,2 / 0,4 / 0,5 / 0,8 / 1 / 1,6 / 2 s.

### ¿Puedo escribir en el byte de la marca de ciclo?

No: la CPU lo sobrescribe en cada ciclo, así que lo que escriba el programa se pierde. El programa solo debe leerlo.

### ¿Uso la marca de ciclo o temporizadores para un intermitente?

La marca de ciclo, si te vale una de sus frecuencias y no importa en qué punto empieza el parpadeo. Temporizadores, si necesitas tiempos de encendido y apagado distintos o que el parpadeo empiece justo al activarse la condición (ejemplo E17).

## secuencias

### ¿Qué es un GRAFCET?

Un diagrama que describe una secuencia como etapas (estados de la máquina) unidas por transiciones (las condiciones para pasar de una etapa a la siguiente). Cada etapa lleva sus acciones, por ejemplo encender una salida.

### ¿Cómo se programa un GRAFCET en KOP o AWL?

Con una marca por etapa. Cada transición se programa con la etapa actual en serie con su condición: Set de la etapa siguiente y Reset de la actual. Las salidas se asignan al final, una sola vez, a partir de las marcas de etapa.

### ¿Cómo se activa la etapa inicial?

En el arranque, desde el OB100, o con una condición que la active cuando no hay ninguna etapa activa, como en el semáforo del ejemplo E28.

### ¿Por qué las salidas de una secuencia se asignan al final del programa?

Para no caer en la doble asignación: si una misma salida se asignara en varias etapas, solo valdría la última. Al final se juntan con O las etapas en las que está activa.

## aritmetica

### ¿Qué pasa si una suma de INT se sale de rango?

El resultado da la vuelta: 30000 + 10000 deja −25536 en el acumulador y se activan los bits de desbordamiento OV y OS. La CPU no se para.

### ¿Depende la instrucción T del RLO?

No. `L` y `T` se ejecutan siempre, valga lo que valga el RLO. Para transferir solo cuando se cumple una condición, hay que saltar por encima con `SPBN`.

### ¿Qué deja /I en el acumulador?

El cociente en la parte baja (ACU1-L) y el resto en la parte alta (ACU1-H). Por ejemplo, `L 17 / L 5 / /I` deja 3 abajo y 2 arriba.

### ¿Por qué una comparación en serie con un contacto va entre paréntesis?

Porque la comparación sustituye el RLO, no se combina con él. Dentro de `U( … )` se calcula aparte y después se combina con el contacto.

## conversiones

### ¿Cómo escalo una entrada analógica a porcentaje?

Convierte el valor a REAL (`ITD` y `DTR`), divide entre 27648 y multiplica por 100. Con 13824 en la entrada, el resultado es 50,0 %.

### ¿Qué diferencia hay entre RND y TRUNC?

`RND` redondea al entero más próximo (3,6 → 4) y `TRUNC` corta la parte decimal hacia 0 (3,6 → 3). `RND+` redondea hacia arriba y `RND-` hacia abajo.

### Con MW10 = −1, ¿por qué `L MW 10` no deja −1 en el acumulador de 32 bits?

Porque `L` rellena con ceros la parte alta, sin extender el signo: ACU1 queda en `DW#16#0000FFFF`. Para tratarlo como DINT negativo hay que usar `ITD`.

## saltos

### ¿Cómo quedan el RLO y el /ER cuando un SPB no salta?

RLO = 1 y /ER = 0. `SPB` y `SPBN` siempre dejan el RLO a 1 y cierran la cadena, salten o no. Por eso una asignación justo detrás de un `SPB` que no salta escribe un 1.

### ¿Cómo se hace un bucle en AWL?

Con `LOOP`: resta 1 a la parte baja de ACU1 y salta a la meta mientras no llegue a 0. Comprueba antes que el contador no sea 0, porque pasaría a 65535 y el bucle se repetiría 65535 veces.

### ¿Cómo hago que una transferencia se ejecute solo si se cumple una condición?

Saltando por encima de ella: `U E0.0 / SPBN NO / L 5 / T MW10 / NO: NOP 0`. `T` no depende del RLO, así que no basta con poner la condición delante.

## indirecto

### ¿Qué es el direccionamiento indirecto en AWL?

Usar una dirección que está guardada en otra parte, en lugar de escribirla fija en el código. Por ejemplo, `L MW [MD 30]` carga la palabra cuya dirección contiene MD30. Sirve para recorrer tablas en un bucle.

### ¿Cómo se calcula un puntero P#?

Número de byte × 8 + número de bit. `P#10.0` vale 80 y `P#2.0`, 16: por eso, sumar `P#2.0` a un puntero lo avanza una palabra.

### ¿Sustituye el MCR a una parada de emergencia?

No. El MCR solo hace que, en una zona del programa, las asignaciones `=` y las transferencias `T` escriban 0. Una parada de emergencia tiene que ir cableada aparte, fuera del programa.

## equivalencias

### ¿Se puede pasar cualquier programa AWL a KOP?

No. Los saltos dentro de un segmento, las operaciones con acumuladores sueltas, el direccionamiento indirecto o `O` sin operando en posiciones raras no tienen dibujo en KOP, y esos segmentos se quedan en AWL. Al revés sí: todo el KOP tiene su AWL.

### ¿Cómo se escriben en AWL dos contactos en paralelo?

Con `O a / O b`. Si después van en serie con otro contacto, se añade `U c`: `O a / O b / U c` calcula (a ∨ b) ∧ c.

### ¿Cómo se pone una comparación en serie con un contacto en AWL?

Entre paréntesis: `U E 2.0 / U( / L MW 30 / L 500 / >I / )`.

## ejercicios

### ¿Cómo se programa un arranque estrella-triángulo en un PLC?

Con un contactor de línea enclavado, un temporizador de retardo a la conexión (SE) que arranca con la línea, la estrella mientras no ha terminado el tiempo y el triángulo cuando termina. Estrella y triángulo se bloquean entre sí para que nunca entren a la vez (ejercicio P04).

### ¿Cómo se controla un depósito con una sonda de mínimo y otra de máximo?

Con Set y Reset: Set de la bomba cuando el nivel baja del mínimo y Reset cuando llega al máximo o se pulsa el paro. Entre las dos sondas la bomba conserva su estado: es una histéresis (ejercicio P01).

### ¿Qué temporizador uso para el minutero de una escalera?

El impulso prolongado (SV): la luz dura el tiempo completo aunque se suelte el pulsador, y cada nueva pulsación vuelve a empezar la cuenta (ejercicio P02).

## nemotecnica

### ¿Qué diferencia hay entre la nemotécnica alemana y la inglesa?

Son dos formas de escribir las mismas instrucciones. En alemán, `U` es Y, `E` una entrada y `A` una salida; en inglés, `A` es Y, `I` una entrada y `Q` una salida. El programa es el mismo.

### ¿Cómo se escribe «SE T 1» en nemotécnica inglesa?

`SD T 1`, el retardo a la conexión. En inglés, `SE` es el impulso prolongado, que en alemán es `SV`.

### ¿Qué significan KOP, FUP y AWL?

Son las siglas alemanas de los lenguajes: KOP, esquema de contactos (en inglés LAD); FUP, diagrama de funciones (FBD), y AWL, lista de instrucciones (STL).
