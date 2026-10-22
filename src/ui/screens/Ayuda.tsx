import { Markdown } from '../common/Markdown';
import { version as APP_VERSION } from '../../../package.json';

const AYUDA = `# Ayuda

## El simulador

- **Ciclo de scan**: en cada ciclo se actualizan los temporizadores, se copia la periferia de entradas a la PAE, se ejecuta el OB100 (solo en el primer ciclo tras pasar a RUN) y el OB1, y se copia la PAA a las salidas.
- **Tiempo simulado**: cada ciclo dura el tiempo de ciclo de *Ajustes* (10 ms por defecto). «×1» va en tiempo real; «×10» y «×100» aceleran. «Ciclo» ejecuta un ciclo completo y «Instr.» una sola instrucción (la línea siguiente se resalta en amarillo y la pila de llamadas y paréntesis se ve en la pestaña **CPU**).
- **RUN / STOP**: pasar de STOP a RUN es un rearranque completo: se borran la PAA, las marcas, temporizadores y contadores no remanentes y se ejecuta el OB100. **MRES** lo borra todo, incluidos los DB.
- **Errores de ejecución** (BCD no válido, acceso fuera de rango, bucle infinito…): la CPU pasa a STOP, se enciende **SF** y el mensaje indica la línea.
- **Observar**: en AWL se ve RLO, STA, ACU1 y ACU2 tras cada línea ejecutada en el último ciclo (las líneas atenuadas no se ejecutaron, por ejemplo por un salto; «×n» indica que se ejecutó varias veces). En KOP, el cable verde y grueso tiene corriente, el azul discontinuo no, y el gris no se ejecutó.
- **Puntos de parada**: clic en el margen izquierdo de una línea AWL, o en el punto del encabezado de un segmento KOP. La CPU se para *antes* de esa instrucción.
- **Tabla de variables** (clic derecho en OB1 → Insertar nuevo objeto → Tabla de variables): se abre en una ventana «Var - VAT_1» dentro de la app, que se queda encima aunque sigas escribiendo código (se mueve arrastrando su título y se minimiza a la barra de título), o abajo, junto a **Señales E/S**: el botón ↓ de su título la acopla abajo y el botón ⧉ de abajo la vuelve a sacar. Las **lentes** (Observar variable, Ctrl+F7) abren la tabla y leen los valores cada medio segundo; otro clic pausa la lectura. En «Valor de forzado» se escribe el valor en el formato de la fila: **Activar valores de forzado** lo escribe una vez (las entradas se escriben en la periferia, así que se mantienen) y **Forzar variable** (Ctrl+F9) lo mantiene en cada ciclo mientras está pulsado y enciende **FRCE**.
- **Analizador lógico**: añade señales (bits, palabras, \`T 1\`, \`T 1:VALOR\`, \`Z 1:VALOR\`, \`MD 4:REAL\`). Clic = cursor A, Mayús + clic = cursor B (se muestra Δt), rueda = zoom, arrastrar = desplazar. Se puede pausar automáticamente con un disparo y exportar a CSV o PNG.

## Proyectos (simulador libre)

A la izquierda del simulador libre está el explorador de proyectos. **«Nuevo»** crea un proyecto (una carpeta) con el nombre que elijas; dentro creas el **OB1**, y si los necesitas, el OB100 y las FC. Con clic derecho en una carpeta puedes renombrar, duplicar, exportar o borrar el proyecto; con clic derecho en un bloque, borrarlo o renombrarlo. La flecha ‹ oculta el explorador.

## Hardware y marca de ciclo

El botón **Hardware** (junto a RUN/STOP/MRES en el simulador libre) configura el hardware del proyecto. Con «Añadir» se pone la estación **CPU compacta**, y en sus propiedades se activa la **marca de ciclo** y se elige el byte de marcas (por defecto MB0). Cada bit de ese byte oscila solo, con pulso y pausa iguales:

| Bit | Marca (byte 0) | Periodo | Frecuencia |
|---|---|---|---|
| 0 | M 0.0 | 0,1 s | 10 Hz |
| 1 | M 0.1 | 0,2 s | 5 Hz |
| 2 | M 0.2 | 0,4 s | 2,5 Hz |
| 3 | M 0.3 | 0,5 s | 2 Hz |
| 4 | M 0.4 | 0,8 s | 1,25 Hz |
| 5 | M 0.5 | 1 s | 1 Hz |
| 6 | M 0.6 | 1,6 s | 0,625 Hz |
| 7 | M 0.7 | 2 s | 0,5 Hz |

Se usan como cualquier marca, por ejemplo un intermitente de 1 s: \`U M 0.5\` / \`= A 124.7\`. No escribas en ese byte desde el programa: la CPU lo sobrescribe en cada ciclo. La configuración se guarda con el proyecto.

## Entradas y salidas

En el simulador libre hay dos filas de interruptores de palanca (arriba = 1, abajo = 0): **E124.0–E124.7**, que también se accionan con las teclas 1–8, y **E125.0–E125.7**, que solo se accionan con el ratón. Las salidas **A124.0–A124.7** y **A125.0–A125.7** son pilotos, en dos filas. Además aparecen las demás entradas y salidas que use tu programa.

- **Clic** o **tecla 1–8** (solo E124): sube o baja el interruptor, que se queda así.
- **Mayús + clic** o **Mayús + tecla**: funciona como pulsador NA: vale 1 solo mientras lo mantienes y luego vuelve a como estaba. Aunque sea muy corto, dura al menos un ciclo.
- **Clic derecho en una entrada**: convertirla en pulsador NA o NC, o **quitarla del panel**.
- **Clic derecho en una salida**: **quitarla del panel**.
- «Mostrar entradas quitadas» y «Mostrar salidas quitadas» las recuperan.
- **Todas a 0** baja todos los interruptores.

En los ejercicios, el panel muestra las entradas que usa el ejercicio y un selector «Clic en una entrada: Pulsador / Interruptor».

## Editor KOP

| Acción | Tecla |
|---|---|
| Contacto NA | **F2** o ⌥1 |
| Contacto NC | **F3** o ⌥2 |
| Bobina (con una salida seleccionada: salida en paralelo) | **F7** o ⌥7 |
| Abrir rama paralela sobre la selección | **F8** o ⌥8 |
| Añadir otra rama al paralelo | **F9** o ⌥9 |
| Catálogo de elementos | **⌘K** |
| Editar el operando | **Intro** o doble clic (Tab pasa al siguiente) |
| Borrar | **⌫** |
| Moverse por el esquema | flechas |
| Deshacer / rehacer | ⌘Z / ⇧⌘Z |

En el Mac las teclas F necesitan **fn**; por eso existen también ⌥1…⌥9. Los pines sin conectar de los cuadros (R, S, ZR, Q, ENO) se conectan con un clic en el círculo. Para saltar a un segmento, escribe su **meta** en la barra del segmento.

## Símbolos y nemotécnica

En la pestaña **Símbolos** se definen nombres para las direcciones; en el código se escriben entre comillas: \`U "Nombre"\`. No son obligatorios: se puede programar directamente con direcciones como \`U E 124.0\` y \`= A 124.0\`. El botón **DE/EN** cambia la nemotécnica del programa (alemana: U, E, A, Z; inglesa: A, I, Q, C) y puede convertir el código. Ojo: \`SE\` en inglés es \`SV\` en alemán, y \`SD\` en inglés es \`SE\` en alemán.

## Decisiones del simulador

Donde la CPU real no está definida o el detalle no aporta nada al examen, el simulador hace lo siguiente:

1. Al empezar cada OB1, la palabra de estado y ACU1/ACU2 valen 0 (en la CPU real arrastran valores anteriores).
2. \`L -5\` (constante INT) carga 16 bits con ACU1-H = 0, igual que \`L MW\`. Para un DINT hay que usar \`L L#-5\`.
3. \`NOT\` pone OR = 0: invierte la expresión completa.
4. \`RND\` redondea al par en x,5 (2,5 → 2; 3,5 → 4).
5. Los temporizadores se actualizan al principio del ciclo en pasos del tiempo de ciclo. Un temporizador arrancado con valor 0 termina en el ciclo siguiente. **SS** se reinicia con cada flanco aunque ya haya terminado. En **SA**, con S = 1, Q sigue a S.
6. \`)\` no restaura RB.
7. STA después de \`=\`, \`S\` o \`R\` es el valor del bit tras la instrucción.
8. Los datos locales (L) empiezan a 0 (salvo con el «modo realista» de *Ajustes*).
9. El vigilante de ciclo cuenta instrucciones (1 000 000), no milisegundos.
10. No hay OB de error del usuario: cualquier error lleva a STOP con su mensaje.
11. El KOP se traduce a un AWL equivalente (ver la pestaña «AWL generado»). Las ramas de salida con contactos usan bits temporales a partir de \`L 20.0\`, y los cuadros usan metas internas \`_001\`, \`_002\`… (por eso en AWL no se pueden usar metas que empiecen por \`_\`).
12. No se admiten \`CALL\` con parámetros, FB con DB de instancia ni direccionamiento indirecto entre áreas.

## Corrección de los ejercicios

- **Pruebas**: cada ejercicio tiene una secuencia de pasos (poner entradas, ejecutar ciclos o esperar un tiempo) y los valores esperados. La nota es la proporción de comprobaciones superadas. «Ver en el simulador» reproduce los pasos hasta el que falla.
- **Equivalencia**: en *Traduce* y *Programa* tu programa se compara con la solución. Si es combinacional se prueban todas las combinaciones de entradas; si tiene memoria, temporizadores o flancos, 20 recorridos aleatorios de 300 pasos. Si no es equivalente se muestra la secuencia más corta encontrada que da un resultado distinto.
- **Avisos** (L01–L09): doble asignación de una bobina, comparación que sustituye al RLO, marca de flanco repetida, temporizador arrancado en dos sitios, tiempo cargado sin S5T#, variable local sin inicializar, palabras solapadas, paro NC programado con contacto NC y LOOP con contador 0.

## Copias de seguridad

Todo se guarda en este ordenador. En **Progreso** puedes exportar una copia completa (progreso, programas y ajustes) e importarla en otro equipo. En el **Simulador libre** puedes exportar cada programa como proyecto (.json) o como fuente AWL (.awl, el formato de texto con \`ORGANIZATION_BLOCK\` y \`FUNCTION\`), e importar fuentes AWL con ese formato.

## Actualizaciones

En el menú **Automatizacion ▸ Buscar actualizaciones…** (en Windows, **Ayuda ▸ Buscar actualizaciones…**) la app compara su versión con la última publicada en GitHub. Solo se conecta cuando lo pides. Si hay una nueva, **Actualizar** abre su página en el navegador: descarga el instalador de tu sistema y ejecútalo para reemplazar la versión anterior (en macOS, sal de la app, abre el .dmg y arrastra Automatizacion a Aplicaciones eligiendo «Reemplazar»). Tus proyectos se conservan.

## Abrir la aplicación en macOS

La aplicación no está firmada por Apple. Si macOS no deja abrirla la primera vez:

- Abre **Ajustes del Sistema → Privacidad y seguridad** y pulsa **«Abrir igualmente»** junto al aviso de Automatizacion, o
- en el Terminal: \`xattr -dr com.apple.quarantine /Applications/Automatizacion.app\`

*Automatizacion ${APP_VERSION} — práctica de KOP y AWL.*
`;

export function AyudaScreen() {
  return <div className="page"><div className="page-narrow" style={{ maxWidth: 860 }}><Markdown text={AYUDA} /></div></div>;
}
