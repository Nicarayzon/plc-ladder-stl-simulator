# Ejemplos KOP y AWL con pruebas

> **Cómo usar este archivo**
> - **Para estudiar**: cada ejemplo trae el enunciado, el esquema KOP (en ASCII), la solución en AWL y una explicación.
> - **Para la app**: cada ejemplo trae un bloque `yaml` con **pruebas ejecutables**. El simulador carga el **primer bloque `awl`** de la sección, aplica los pasos de la prueba y compara los resultados. Todos los resultados esperados se han verificado con el intérprete de referencia (`python3 tools/interprete_referencia.py test src/content/ejemplos_KOP_AWL.md`, desde `app/`). El mismo contenido está exportado en `banco_ejercicios.json`, que es lo que carga la app.
> - Las secciones M (teoría), N (trazas) y O (cronogramas) usan formatos propios, descritos al principio de cada sección.
> - Nemotécnica alemana y operandos según la convención del §10 de la referencia.

---

## Formato de las pruebas

```yaml
ciclo_ms: 10            # opcional (por defecto 10 ms por ciclo)
inicial: {E0.1: 1}      # valores antes del primer ciclo
pasos:
  - poner: {E0.0: 1}    # 1) escribe valores
    ciclos: 1           # 2) ejecuta ciclos (por defecto 1)
    esperar: {A4.0: 1}  # 3) comprueba
  - tiempo_ms: 4900     # ejecuta ceil(4900 / ciclo_ms) ciclos
    esperar: {A4.0: 0}
  - pulso: E1.0         # E1.0 = 1 durante 1 ciclo y = 0 durante 1 ciclo…
    veces: 3            # …repetido 3 veces
    esperar: {MW30: 3}
  - poner: {"EW2:WORD": "W#16#00A1"}
    esperar_estado: STOP   # la CPU debe haber pasado a STOP
```

**Claves de operando**: `operando[:TIPO]`.

| Operando | Tipo por defecto |
|---|---|
| Bit (`E0.0`, `M10.1`) | 0 / 1 |
| `T n` / `Z n` | Estado del temporizador o contador (0 / 1) |
| Byte (`MB`, `EB`, `AB`) | Entero sin signo |
| Palabra (`MW`, `EW`, `AW`, `PEW`) | INT con signo |
| Doble palabra (`MD`) | DINT |

- **Tipos explícitos**: `:WORD` (valor `"W#16#…"` o entero), `:REAL` (comparación con tolerancia 0,001), `:DINT`, `:INT`, `:BYTE`.
- **`Zn:VALOR` / `Tn:VALOR`**: valor del contador, o tiempo restante en unidades de la base.
- **`poner` sobre entradas** escribe las entradas *físicas*, que se copian a la PAE al empezar el siguiente ciclo.
- **Orden de cada ciclo del simulador**: actualizar temporizadores (+`ciclo_ms`) → leer PAE → ejecutar OB1 → escribir PAA.

---

## Índice

- **A. Lógica combinacional**: E01 – E05
- **B. Memoria y enclavamientos**: E06 – E09b
- **C. Flancos**: E10 – E11b
- **D. Temporizadores**: E12 – E17
- **E. Contadores**: E18 – E19
- **F. Comparación y aritmética**: E20 – E23
- **G. Conversiones**: E24 – E25
- **H. Saltos, bucles e indirecto**: E26 – E29
- **I. Secuencias**: E28
- **J. Preguntas tipo examen "¿qué vale…?"**: Q01 – Q14
- **K. Conversión KOP ↔ AWL**: C01 – C04
- **L. Ejercicios propuestos con solución**: P01 – P04
- **M. Preguntas de teoría (test)**: M01 – M24
- **N. Trazas (palabra de estado instrucción a instrucción)**: T01 – T05
- **O. Cronogramas de temporizadores**: R01 – R03

---

# A. Lógica combinacional

### E01 — Contacto NA y contacto NC

**Enunciado**: el piloto A4.0 se enciende cuando E0.0 = 1, y el piloto A4.1 cuando E0.0 = 0.
**Conceptos**: un contacto **pregunta** el estado de un bit (§1.3 y §6.2 de la referencia).

```text
     E0.0               A4.0
 |---| |----------------( )
     E0.0               A4.1
 |---|/|----------------( )
```

```awl
      U     E 0.0
      =     A 4.0
      UN    E 0.0
      =     A 4.1
```

```yaml
pasos:
  - poner: {E0.0: 0}
    esperar: {A4.0: 0, A4.1: 1}
  - poner: {E0.0: 1}
    esperar: {A4.0: 1, A4.1: 0}
```

### E02 — Y (serie) y O (paralelo)

**Enunciado**: A4.0 = E0.0 Y E0.1. A4.1 = E0.0 O E0.1.

```text
     E0.0     E0.1      A4.0
 |---| |------| |-------( )

     E0.0               A4.1
 |---| |----+-----------( )
 |   E0.1   |
 |---| |----+
```

```awl
// Segmento 1: Y
      U     E 0.0
      U     E 0.1
      =     A 4.0
// Segmento 2: O
      O     E 0.0
      O     E 0.1
      =     A 4.1
```

```yaml
pasos:
  - poner: {E0.0: 0, E0.1: 0}
    esperar: {A4.0: 0, A4.1: 0}
  - poner: {E0.0: 0, E0.1: 1}
    esperar: {A4.0: 0, A4.1: 1}
  - poner: {E0.0: 1, E0.1: 0}
    esperar: {A4.0: 0, A4.1: 1}
  - poner: {E0.0: 1, E0.1: 1}
    esperar: {A4.0: 1, A4.1: 1}
```

### E03 — NAND, NOR y O-exclusiva

**Enunciado**: A4.0 = NAND, A4.1 = NOR y A4.2 = XOR de E0.0 y E0.1.

```text
     E0.0     E0.1            A4.0
 |---| |------| |-----|NOT|---( )

     E0.0                     A4.1
 |---| |----+-------|NOT|-----( )
 |   E0.1   |
 |---| |----+

     E0.0     E0.1            A4.2
 |---| |------|/|-----+-------( )
 |   E0.0     E0.1    |
 |---|/|------| |-----+
```

```awl
// NAND
      U     E 0.0
      U     E 0.1
      NOT
      =     A 4.0
// NOR
      O     E 0.0
      O     E 0.1
      NOT
      =     A 4.1
// XOR (en AWL existe la instrucción X)
      X     E 0.0
      X     E 0.1
      =     A 4.2
```

```yaml
pasos:
  - poner: {E0.0: 0, E0.1: 0}
    esperar: {A4.0: 1, A4.1: 1, A4.2: 0}
  - poner: {E0.0: 0, E0.1: 1}
    esperar: {A4.0: 1, A4.1: 0, A4.2: 1}
  - poner: {E0.0: 1, E0.1: 0}
    esperar: {A4.0: 1, A4.1: 0, A4.2: 1}
  - poner: {E0.0: 1, E0.1: 1}
    esperar: {A4.0: 0, A4.1: 0, A4.2: 0}
```

### E04 — "Y antes de O" con `O` sin operando

**Enunciado**: A4.0 = (E0.0 ∧ E0.1) ∨ (E0.2 ∧ E0.3).
**Conceptos**: el bit OR y la primera consulta (§7.4 de la referencia).

```text
     E0.0     E0.1      A4.0
 |---| |------| |---+---( )
 |   E0.2     E0.3  |
 |---| |------| |---+
```

```awl
      U     E 0.0
      U     E 0.1
      O
      U     E 0.2
      U     E 0.3
      =     A 4.0
```

```yaml
pasos:
  - poner: {E0.0: 1, E0.1: 1, E0.2: 0, E0.3: 0}
    esperar: {A4.0: 1}
  - poner: {E0.0: 0, E0.1: 0, E0.2: 1, E0.3: 1}
    esperar: {A4.0: 1}
  - poner: {E0.0: 1, E0.1: 0, E0.2: 1, E0.3: 0}
    esperar: {A4.0: 0}
  - poner: {E0.0: 1, E0.1: 0, E0.2: 1, E0.3: 1}
    esperar: {A4.0: 1}
  - poner: {E0.0: 0, E0.1: 1, E0.2: 0, E0.3: 1}
    esperar: {A4.0: 0}
```

### E05 — Paréntesis: Y con un grupo O

**Enunciado**: A4.1 = E0.0 ∧ (E0.1 ∨ E0.2).

```text
     E0.0     E0.1           A4.1
 |---| |---+--| |----+-------( )
 |         |  E0.2   |
 |         +--| |----+
```

```awl
      U     E 0.0
      U(
      O     E 0.1
      O     E 0.2
      )
      =     A 4.1
```

```yaml
pasos:
  - poner: {E0.0: 1, E0.1: 0, E0.2: 0}
    esperar: {A4.1: 0}
  - poner: {E0.0: 1, E0.1: 1, E0.2: 0}
    esperar: {A4.1: 1}
  - poner: {E0.0: 1, E0.1: 0, E0.2: 1}
    esperar: {A4.1: 1}
  - poner: {E0.0: 0, E0.1: 1, E0.2: 1}
    esperar: {A4.1: 0}
```

---

# B. Memoria y enclavamientos

### E06 — Marcha y paro con enclavamiento (prioridad al paro)

**Enunciado**: E0.0 = marcha (pulsador NA). E0.1 = paro (**pulsador NC cableado**, así que vale 1 en reposo). A4.0 = motor.
**Conceptos**: autorretención, seguridad por cableado y prioridad al paro.

```text
     E0.0 Marcha   E0.1 Paro(NC)        A4.0 Motor
 |---| |------+-------| |---------------( )
 |            |
 |   A4.0     |
 |---| |------+
```

```awl
      U(
      O     E 0.0       // marcha
      O     A 4.0       // realimentación (enclavamiento)
      )
      U     E 0.1       // paro NC: 1 = no pulsado
      =     A 4.0
```

```yaml
inicial: {E0.1: 1}
pasos:
  - ciclos: 1
    esperar: {A4.0: 0}
  - poner: {E0.0: 1}
    esperar: {A4.0: 1}
  - poner: {E0.0: 0}
    esperar: {A4.0: 1}          # se mantiene por el enclavamiento
  - poner: {E0.1: 0}
    esperar: {A4.0: 0}          # paro pulsado
  - poner: {E0.1: 1}
    esperar: {A4.0: 0}          # al soltar el paro sigue parado
  - poner: {E0.0: 1, E0.1: 0}
    esperar: {A4.0: 0}          # las dos a la vez: gana el paro
```

### E07 — Marcha y paro con Set/Reset (prioridad al paro)

**Conceptos**: la prioridad la da el **orden**: la última instrucción gana.

```text
     E0.0                 A4.0
 |---| |------------------(S)
     E0.1 (NC)            A4.0
 |---|/|------------------(R)
```

```awl
      U     E 0.0
      S     A 4.0
      UN    E 0.1       // paro pulsado (E0.1 = 0)
      R     A 4.0       // R al final → prioridad al paro
```

```yaml
inicial: {E0.1: 1}
pasos:
  - poner: {E0.0: 1}
    esperar: {A4.0: 1}
  - poner: {E0.0: 0}
    esperar: {A4.0: 1}
  - poner: {E0.1: 0}
    esperar: {A4.0: 0}
  - poner: {E0.0: 1}
    esperar: {A4.0: 0}          # marcha y paro a la vez → 0
  - poner: {E0.1: 1}
    esperar: {A4.0: 1}
```

### E08 — Marcha y paro con prioridad a la marcha

**Enunciado**: igual que E07, pero si se pulsan los dos debe ganar la marcha.

```text
     E0.1 (NC)            A4.0
 |---|/|------------------(R)
     E0.0                 A4.0
 |---| |------------------(S)      ← S al final
```

```awl
      UN    E 0.1
      R     A 4.0
      U     E 0.0
      S     A 4.0
```

```yaml
inicial: {E0.1: 1}
pasos:
  - poner: {E0.0: 1, E0.1: 0}
    esperar: {A4.0: 1}          # las dos → gana la marcha
  - poner: {E0.0: 0}
    esperar: {A4.0: 0}          # el paro sigue pulsado
  - poner: {E0.1: 1, E0.0: 1}
    esperar: {A4.0: 1}
  - poner: {E0.0: 0}
    esperar: {A4.0: 1}
```

### E09 — Doble asignación (error típico)

**Enunciado**: se quiere que A4.0 se encienda con E0.0 **o** con E0.1. Este programa **está mal**.
**Conceptos**: la PAA se escribe al final del ciclo, así que solo cuenta la última asignación.

```awl
      U     E 0.0
      =     A 4.0
      U     E 0.1
      =     A 4.0       // sobrescribe la anterior
```

```yaml
pasos:
  - poner: {E0.0: 1, E0.1: 0}
    esperar: {A4.0: 0}          # ¡no se enciende!
  - poner: {E0.0: 0, E0.1: 1}
    esperar: {A4.0: 1}
```

### E09b — Doble asignación corregida

```text
     E0.0               A4.0
 |---| |----+-----------( )
 |   E0.1   |
 |---| |----+
```

```awl
      O     E 0.0
      O     E 0.1
      =     A 4.0
```

```yaml
pasos:
  - poner: {E0.0: 1, E0.1: 0}
    esperar: {A4.0: 1}
  - poner: {E0.0: 0, E0.1: 1}
    esperar: {A4.0: 1}
  - poner: {E0.0: 0, E0.1: 0}
    esperar: {A4.0: 0}
```

---

# C. Flancos

### E10 — Flanco positivo y negativo

**Enunciado**: M10.1 = impulso de un ciclo al pulsar E0.0. M10.3 = impulso de un ciclo al soltarlo.
**Conceptos**: cada flanco necesita **su propia** marca de flanco (M10.0 y M10.2).

```text
     E0.0     M10.0          M10.1
 |---| |-------(P)-----------( )
     E0.0     M10.2          M10.3
 |---| |-------(N)-----------( )
```

```awl
      U     E 0.0
      FP    M 10.0
      =     M 10.1
      U     E 0.0
      FN    M 10.2
      =     M 10.3
```

```yaml
pasos:
  - poner: {E0.0: 1}
    esperar: {M10.1: 1, M10.3: 0}
  - ciclos: 1
    esperar: {M10.1: 0}         # solo dura un ciclo
  - poner: {E0.0: 0}
    esperar: {M10.3: 1, M10.1: 0}
  - ciclos: 1
    esperar: {M10.3: 0}
```

### E11 — Telerruptor (un pulsador enciende y apaga)

**Enunciado**: cada pulsación de E0.0 cambia el estado de la lámpara A4.0.
**Conceptos**: flanco + autorretención con dos ramas.

```text
     E0.0     M10.0          M10.1
 |---| |-------(P)-----------( )

     M10.1    A4.0           A4.0
 |---| |------|/|-----+------( )
 |   M10.1    A4.0    |
 |---|/|------| |-----+
```

```awl
      U     E 0.0
      FP    M 10.0
      =     M 10.1      // impulso
      U     M 10.1
      UN    A 4.0
      O
      UN    M 10.1
      U     A 4.0
      =     A 4.0
```

```yaml
pasos:
  - pulso: E0.0
    esperar: {A4.0: 1}
  - poner: {E0.0: 1}
    ciclos: 5
    esperar: {A4.0: 0}          # cambia una sola vez aunque se mantenga pulsado
  - poner: {E0.0: 0}
    esperar: {A4.0: 0}
  - pulso: E0.0
    esperar: {A4.0: 1}
```

### E11b — Telerruptor con O-exclusiva (solo AWL)

```awl
      U     E 0.0
      FP    M 10.0
      =     M 10.1
      U     M 10.1
      X     A 4.0       // impulso XOR estado actual
      =     A 4.0
```

```yaml
pasos:
  - pulso: E0.0
    esperar: {A4.0: 1}
  - pulso: E0.0
    esperar: {A4.0: 0}
  - pulso: E0.0
    veces: 3
    esperar: {A4.0: 1}
```

---

# D. Temporizadores

### E12 — Retardo a la conexión (SE / S_EVERZ)

**Enunciado**: A4.0 se enciende 5 s después de activar E0.0, y solo si E0.0 sigue a 1. E0.1 hace reset. MW10 guarda el tiempo restante en binario y MW12 en BCD.

```text
                 T1
             +-----------+
   E0.0      | S_EVERZ   |                       A4.0
 |---| |-----|S         Q|-----------------------( )
 S5T#5S -----|TW     DUAL|-- MW10
   E0.1      |        DEZ|-- MW12
 |---| |-----|R          |
             +-----------+
```

```awl
      U     E 0.0
      L     S5T#5S
      SE    T 1
      U     E 0.1
      R     T 1
      L     T 1         // tiempo restante (binario, en unidades de 10 ms)
      T     MW 10
      LC    T 1         // tiempo restante en BCD con base
      T     MW 12
      U     T 1
      =     A 4.0
```

```yaml
pasos:
  - poner: {E0.0: 1}
    esperar: {A4.0: 0, MW10: 500, "MW12:WORD": "W#16#0500"}
  - tiempo_ms: 1000
    esperar: {A4.0: 0, MW10: 400, "MW12:WORD": "W#16#0400"}
  - tiempo_ms: 3900
    esperar: {A4.0: 0}
  - tiempo_ms: 200
    esperar: {A4.0: 1, MW10: 0}
  - poner: {E0.0: 0}
    esperar: {A4.0: 0}
  # una activación más corta que el tiempo no enciende la salida
  - poner: {E0.0: 1}
    tiempo_ms: 3000
    esperar: {A4.0: 0}
  - poner: {E0.0: 0}
    esperar: {A4.0: 0}
  - poner: {E0.0: 1}
    tiempo_ms: 4900
    esperar: {A4.0: 0}
  - tiempo_ms: 200
    esperar: {A4.0: 1}
  # reset con la condición mantenida
  - poner: {E0.1: 1}
    esperar: {A4.0: 0}
  - poner: {E0.1: 0}
    tiempo_ms: 6000
    esperar: {A4.0: 0}          # sin un flanco nuevo no rearranca
  - poner: {E0.0: 0}
    ciclos: 1
  - poner: {E0.0: 1}
    tiempo_ms: 5100
    esperar: {A4.0: 1}
```

### E13 — Retardo a la desconexión (SA / S_AVERZ)

**Enunciado**: el ventilador A4.1 funciona mientras E0.2 = 1 y sigue 3 s más después de apagarlo.

```text
                 T2
             +-----------+
   E0.2      | S_AVERZ   |                       A4.1
 |---| |-----|S         Q|-----------------------( )
 S5T#3S -----|TW         |
             +-----------+
```

```awl
      U     E 0.2
      L     S5T#3S
      SA    T 2
      U     T 2
      =     A 4.1
```

```yaml
pasos:
  - poner: {E0.2: 1}
    esperar: {A4.1: 1}          # se enciende sin retardo
  - poner: {E0.2: 0}
    esperar: {A4.1: 1}
  - tiempo_ms: 2800
    esperar: {A4.1: 1}
  - tiempo_ms: 300
    esperar: {A4.1: 0}
  # si vuelve a 1 mientras cuenta, el tiempo se anula
  - poner: {E0.2: 1}
    esperar: {A4.1: 1}
  - poner: {E0.2: 0}
    tiempo_ms: 1500
    esperar: {A4.1: 1}
  - poner: {E0.2: 1}
    tiempo_ms: 5000
    esperar: {A4.1: 1}
  - poner: {E0.2: 0}
    tiempo_ms: 2900
    esperar: {A4.1: 1}
  - tiempo_ms: 200
    esperar: {A4.1: 0}
```

### E14 — Impulso (SI / S_IMPULS)

**Enunciado**: A4.2 = 1 como máximo 2 s mientras E0.3 está pulsado.

```text
                 T3
             +-----------+
   E0.3      | S_IMPULS  |                       A4.2
 |---| |-----|S         Q|-----------------------( )
 S5T#2S -----|TW         |
             +-----------+
```

```awl
      U     E 0.3
      L     S5T#2S
      SI    T 3
      U     T 3
      =     A 4.2
```

```yaml
pasos:
  - poner: {E0.3: 1}
    esperar: {A4.2: 1}
  - tiempo_ms: 1800
    esperar: {A4.2: 1}
  - tiempo_ms: 300
    esperar: {A4.2: 0}          # se acaba aunque E0.3 siga pulsado
  - poner: {E0.3: 0}
    esperar: {A4.2: 0}
  - poner: {E0.3: 1}
    tiempo_ms: 500
    esperar: {A4.2: 1}
  - poner: {E0.3: 0}
    esperar: {A4.2: 0}          # al soltar antes de tiempo, Q cae enseguida
```

### E15 — Impulso prolongado (SV / S_VIMP)

**Enunciado**: un pulso corto en E0.4 mantiene A4.3 encendida 2 s. Un pulso nuevo reinicia el tiempo.

```text
                 T4
             +-----------+
   E0.4      | S_VIMP    |                       A4.3
 |---| |-----|S         Q|-----------------------( )
 S5T#2S -----|TW         |
             +-----------+
```

```awl
      U     E 0.4
      L     S5T#2S
      SV    T 4
      U     T 4
      =     A 4.3
```

```yaml
pasos:
  - poner: {E0.4: 1}
    esperar: {A4.3: 1}
  - poner: {E0.4: 0}
    tiempo_ms: 1800
    esperar: {A4.3: 1}          # sigue aunque E0.4 haya caído
  - tiempo_ms: 300
    esperar: {A4.3: 0}
  - pulso: E0.4
    esperar: {A4.3: 1}
  - tiempo_ms: 1500
    esperar: {A4.3: 1}
  - pulso: E0.4                 # redisparo
    esperar: {A4.3: 1}
  - tiempo_ms: 1800
    esperar: {A4.3: 1}
  - tiempo_ms: 300
    esperar: {A4.3: 0}
```

### E16 — Retardo a la conexión con memoria (SS / S_SEVERZ)

**Enunciado**: un pulso en E0.5 enciende A4.4 a los 3 s, y queda encendida hasta que se pulse el reset E0.6.

```text
                 T5
             +-----------+
   E0.5      | S_SEVERZ  |                       A4.4
 |---| |-----|S         Q|-----------------------( )
 S5T#3S -----|TW         |
   E0.6      |           |
 |---| |-----|R          |
             +-----------+
```

```awl
      U     E 0.5
      L     S5T#3S
      SS    T 5
      U     E 0.6
      R     T 5
      U     T 5
      =     A 4.4
```

```yaml
pasos:
  - poner: {E0.5: 1}
    esperar: {A4.4: 0}
  - poner: {E0.5: 0}
    tiempo_ms: 2800
    esperar: {A4.4: 0}          # sigue contando aunque E0.5 = 0
  - tiempo_ms: 300
    esperar: {A4.4: 1}
  - tiempo_ms: 10000
    esperar: {A4.4: 1}          # memorizado
  - poner: {E0.6: 1}
    esperar: {A4.4: 0}
  - poner: {E0.6: 0}
    tiempo_ms: 5000
    esperar: {A4.4: 0}
```

### E17 — Intermitente (1 s encendido / 1 s apagado) con dos temporizadores

**Enunciado**: mientras E0.7 = 1, el piloto A4.5 parpadea.
**Conceptos**: cada temporizador reinicia al otro. Alternativa: usar la marca de ciclo (§2.6 de la referencia).

```text
     E0.7     T7                 T6
 |---| |------|/|-----------+--------+
 |                          |S_EVERZ |
 |              S5T#1S -----|TW     Q|
 |                          +--------+
     T6                          T7
 |---| |--------------------+--------+
 |                          |S_EVERZ |
 |              S5T#1S -----|TW     Q|
 |                          +--------+
     T6                        A4.5
 |---| |-----------------------( )
```

```awl
      U     E 0.7
      UN    T 7
      L     S5T#1S
      SE    T 6         // tiempo apagado
      U     T 6
      L     S5T#1S
      SE    T 7         // tiempo encendido
      U     T 6
      =     A 4.5
```

```yaml
pasos:
  - poner: {E0.7: 1}
    esperar: {A4.5: 0}
  - tiempo_ms: 500
    esperar: {A4.5: 0}
  - tiempo_ms: 1000
    esperar: {A4.5: 1}
  - tiempo_ms: 1000
    esperar: {A4.5: 0}
  - tiempo_ms: 1000
    esperar: {A4.5: 1}
  - poner: {E0.7: 0}
    esperar: {A4.5: 0}
  - tiempo_ms: 3000
    esperar: {A4.5: 0}
```

---

# E. Contadores

### E18 — Aparcamiento de 10 plazas

**Enunciado**:
- E1.0 = coche que entra; E1.1 = coche que sale.
- E1.2 carga una ocupación inicial de 5; E1.3 pone el contador a cero.
- MW30 = ocupación. A5.0 = "COMPLETO" (ocupación ≥ 10). A5.1 = hay algún coche.

```text
                 Z1
             +-----------+
   E1.0      | ZAEHLER   |                       A5.1
 |---| |-----|ZV        Q|-----------------------( )
   E1.1      |           |
 |---| |-----|ZR         |
   E1.2      |           |
 |---| |-----|S      DUAL|-- MW30
 C#5 --------|ZW         |
   E1.3      |           |
 |---| |-----|R          |
             +-----------+
                CMP >=I                          A5.0
 |-------------+--------+------------------------( )
        MW30 --|IN1     |
        10   --|IN2     |
               +--------+
```

```awl
      U     E 1.0
      ZV    Z 1
      U     E 1.1
      ZR    Z 1
      U     E 1.2
      L     C#5
      S     Z 1
      U     E 1.3
      R     Z 1
      L     Z 1
      T     MW 30
      L     10          // ACU2 = ocupación, ACU1 = 10
      >=I
      =     A 5.0
      U     Z 1
      =     A 5.1
```

```yaml
pasos:
  - ciclos: 1
    esperar: {MW30: 0, A5.0: 0, A5.1: 0}
  - pulso: E1.0
    veces: 3
    esperar: {MW30: 3, A5.1: 1, A5.0: 0}
  - poner: {E1.0: 1}
    ciclos: 10
    esperar: {MW30: 4}          # mantenerla pulsada solo cuenta una vez
  - poner: {E1.0: 0}
    ciclos: 1
  - pulso: E1.1
    esperar: {MW30: 3}
  - pulso: E1.0
    veces: 7
    esperar: {MW30: 10, A5.0: 1}
  - pulso: E1.3
    esperar: {MW30: 0, A5.0: 0, A5.1: 0}
  - pulso: E1.2
    esperar: {MW30: 5, A5.1: 1}
  - pulso: E1.1
    veces: 7
    esperar: {MW30: 0, A5.1: 0}   # no baja de 0
```

### E19 — Cuenta atrás

**Enunciado**: E1.4 carga 3. Cada pulso de E1.5 descuenta 1. A5.2 = fin de la cuenta (valor 0). MW32 = valor en BCD.

```awl
      U     E 1.4
      L     C#3
      S     Z 2
      U     E 1.5
      ZR    Z 2
      UN    Z 2         // Q = 0 → valor = 0
      =     A 5.2
      LC    Z 2
      T     MW 32
```

```yaml
pasos:
  - ciclos: 1
    esperar: {A5.2: 1}
  - pulso: E1.4
    esperar: {A5.2: 0, "Z2:VALOR": 3, "MW32:WORD": "W#16#0003"}
  - pulso: E1.5
    veces: 2
    esperar: {A5.2: 0, "Z2:VALOR": 1}
  - pulso: E1.5
    esperar: {A5.2: 1, "Z2:VALOR": 0}
```

---

# F. Comparación y aritmética

### E20 — Comparación de nivel

**Enunciado**: MW30 = nivel en litros.
- A5.4 = nivel alto (> 500).
- A5.5 = nivel bajo (< 100).
- A5.6 = alarma de nivel alto, solo si E2.0 (habilitación) = 1.

**Conceptos**: la comparación **sustituye** el RLO, así que para combinarla con un contacto va entre paréntesis.

```text
               CMP >I                    A5.4
 |------------+-------+------------------( )
       MW30 --|IN1    |
       500  --|IN2    |
              +-------+
     E2.0      CMP >I                    A5.6
 |---| |------+-------+------------------( )
       MW30 --|IN1    |
       500  --|IN2    |
              +-------+
```

```awl
      L     MW 30
      L     500
      >I
      =     A 5.4
      L     MW 30
      L     100
      <I
      =     A 5.5
      U     E 2.0
      U(
      L     MW 30
      L     500
      >I
      )
      =     A 5.6
```

```yaml
pasos:
  - poner: {MW30: 600, E2.0: 0}
    esperar: {A5.4: 1, A5.5: 0, A5.6: 0}
  - poner: {E2.0: 1}
    esperar: {A5.6: 1}
  - poner: {MW30: 50}
    esperar: {A5.4: 0, A5.5: 1, A5.6: 0}
  - poner: {MW30: 500}
    esperar: {A5.4: 0, A5.5: 0}
```

### E21 — Suma con detección de desbordamiento

**Enunciado**: MW44 = MW40 + MW42. M1.0 = hubo desbordamiento en esta suma. M1.1 = memoria de desbordamiento (se borra con E0.0).

```awl
      L     MW 40
      L     MW 42
      +I
      T     MW 44
      U     OV
      =     M 1.0
      U     OS
      S     M 1.1
      U     E 0.0
      R     M 1.1
```

```yaml
pasos:
  - poner: {MW40: 1000, MW42: 234}
    esperar: {MW44: 1234, M1.0: 0, M1.1: 0}
  - poner: {MW40: 30000, MW42: 10000}
    esperar: {MW44: -25536, M1.0: 1, M1.1: 1}
  - poner: {MW40: -20000, MW42: -20000}
    esperar: {MW44: 25536, M1.0: 1}
  - poner: {MW40: 5, MW42: 5}
    esperar: {MW44: 10, M1.0: 0, M1.1: 1}
  - pulso: E0.0
    esperar: {M1.1: 0}
```

### E22 — Multiplicación y división entera (cociente y resto)

**Conceptos**: `*I` deja un DINT en ACU1. `/I` deja el cociente en ACU1-L y el resto en ACU1-H.

```awl
      L     MW 50
      L     MW 52
      *I
      T     MD 54       // producto completo (32 bits)
      L     MW 50
      L     MW 52
      /I
      T     MW 58       // cociente
      SRD   16          // trae el resto (ACU1-H) a la parte baja
      T     MW 60       // resto
```

```yaml
pasos:
  - poner: {MW50: 17, MW52: 5}
    esperar: {MD54: 85, MW58: 3, MW60: 2}
  - poner: {MW50: -17, MW52: 5}
    esperar: {MD54: -85, MW58: -3, MW60: -2}
  - poner: {MW50: 300, MW52: 200}
    esperar: {MD54: 60000, MW58: 1, MW60: 100}
```

### E23 — Escalado analógico a % (REAL)

**Enunciado**: PEW256 (0..27648) → MD100 = 0,0..100,0 %. A5.7 = alarma por encima del 80 %.

**En KOP** es una cadena de cuadros unidos ENO → EN, con resultados intermedios en marcas o temporales:

```text
 I_DI  (IN = PEW256        → OUT = MD104)
 DI_R  (IN = MD104         → OUT = MD108)
 DIV_R (IN1 = MD108, IN2 = 27648.0 → OUT = MD112)
 MUL_R (IN1 = MD112, IN2 = 100.0   → OUT = MD100)
 CMP >R (IN1 = MD100, IN2 = 80.0)  → bobina A5.7
```

```awl
      L     PEW 256
      ITD
      DTR
      L     2.764800e+004
      /R
      L     1.000000e+002
      *R
      T     MD 100
      L     MD 100
      L     8.000000e+001
      >R
      =     A 5.7
```

```yaml
pasos:
  - poner: {PEW256: 13824}
    esperar: {"MD100:REAL": 50.0, A5.7: 0}
  - poner: {PEW256: 27648}
    esperar: {"MD100:REAL": 100.0, A5.7: 1}
  - poner: {PEW256: 0}
    esperar: {"MD100:REAL": 0.0, A5.7: 0}
  - poner: {PEW256: 22118}
    esperar: {A5.7: 0}          # 79,998 %
  - poner: {PEW256: 22200}
    esperar: {A5.7: 1}          # 80,295 %
```

---

# G. Conversiones

### E24 — Rueda de dígitos BCD y display

**Enunciado**:
- EW2 = rueda de 3 dígitos en BCD. MW70 = su valor entero.
- MW72 = MW70 + 1.
- AW6 = MW72 en BCD, para un display de 3 dígitos.

**Conceptos**: BCD y orden de bytes. AW6 = AB6 (byte alto) + AB7 (byte bajo).

```awl
      L     EW 2
      BTI
      T     MW 70
      L     MW 70
      L     1
      +I
      T     MW 72
      L     MW 72
      ITB
      T     AW 6
```

```yaml
pasos:
  - poner: {"EW2:WORD": "W#16#0123"}
    esperar: {MW70: 123, MW72: 124, "AW6:WORD": "W#16#0124", A6.0: 1, A7.2: 1, A7.5: 1, A7.0: 0}
  - poner: {"EW2:WORD": "W#16#0950"}
    esperar: {MW70: 950, "AW6:WORD": "W#16#0951"}
  - poner: {"EW2:WORD": "W#16#00A1"}
    esperar_estado: STOP        # A1 no es BCD → error de conversión (OB121) → STOP
```

### E25 — REAL → DINT: RND, TRUNC, RND+ y RND−

```awl
      L     MD 100
      RND
      T     MD 104
      L     MD 100
      TRUNC
      T     MD 108
      L     MD 100
      RND+
      T     MD 112
      L     MD 100
      RND-
      T     MD 116
```

```yaml
pasos:
  - poner: {"MD100:REAL": 2.7}
    esperar: {MD104: 3, MD108: 2, MD112: 3, MD116: 2}
  - poner: {"MD100:REAL": -2.7}
    esperar: {MD104: -3, MD108: -2, MD112: -2, MD116: -3}
  - poner: {"MD100:REAL": 3.2}
    esperar: {MD104: 3, MD108: 3, MD112: 4, MD116: 3}
  - poner: {"MD100:REAL": -3.2}
    esperar: {MD104: -3, MD108: -3, MD112: -3, MD116: -4}
```

---

# H. Saltos, bucles e indirecto

### E26 — Sumar o restar según un selector (saltos)

**Enunciado**: si E0.0 = 1, MW34 = MW30 + MW32. Si no, MW34 = MW30 − MW32.

```text
 Segmento 1:  E0.0          SUMA
          |---| |-----------(JMP)
 Segmento 2:  SUB_I (MW30 − MW32 → MW34) y luego (JMP) incondicional a FIN
 Segmento 3:  LABEL SUMA → ADD_I (MW30 + MW32 → MW34)
 Segmento 4:  LABEL FIN
```

```awl
      U     E 0.0
      SPB   SUMA
      L     MW 30
      L     MW 32
      -I
      T     MW 34
      SPA   FIN
SUMA: L     MW 30
      L     MW 32
      +I
      T     MW 34
FIN:  NOP   0
```

```yaml
pasos:
  - poner: {MW30: 20, MW32: 7, E0.0: 0}
    esperar: {MW34: 13}
  - poner: {E0.0: 1}
    esperar: {MW34: 27}
```

### E27 — Factorial con LOOP

**Enunciado**: MD100 = MW30! Si MW30 ≤ 1, el resultado es 1.
**Conceptos**: `LOOP` decrementa ACU1-L y salta mientras sea ≠ 0. Hay que **proteger el caso 0**: si no, `LOOP` pasaría de 0 a 65535 y repetiría el bucle otras 65535 veces.

```awl
      L     L#1
      T     MD 100      // resultado = 1
      L     MW 30       // N
      L     1
      <=I               // ¿N <= 1?
      SPB   FIN
      L     MW 30
SIG:  T     MW 32       // contador del bucle
      L     MD 100
      L     MW 32
      *D
      T     MD 100
      L     MW 32
      LOOP  SIG
FIN:  NOP   0
```

```yaml
pasos:
  - poner: {MW30: 5}
    esperar: {MD100: 120}
  - poner: {MW30: 0}
    esperar: {MD100: 1}
  - poner: {MW30: 1}
    esperar: {MD100: 1}
  - poner: {MW30: 7}
    esperar: {MD100: 5040}
  - poner: {MW30: 10}
    esperar: {MD100: 3628800}
```

### E29 — Suma de una tabla con direccionamiento indirecto

**Enunciado**: MW40 = suma de las 10 palabras MW100, MW102, …, MW118.
**Conceptos**: puntero de área (`P#byte.bit` = byte × 8 + bit), `L MW [MD 30]` y `LOOP` (§7.19 de la referencia). Solo existe en AWL: no tiene representación en KOP.

```awl
      L     P#100.0
      T     MD 30       // puntero al primer elemento (100 × 8 = 800)
      L     0
      T     MW 40       // suma = 0
      L     10          // 10 elementos
SIG:  T     MW 34       // contador del bucle
      L     MW 40
      L     MW [MD 30]
      +I
      T     MW 40
      L     MD 30
      L     P#2.0       // avanza una palabra (2 bytes = 16)
      +D
      T     MD 30
      L     MW 34
      LOOP  SIG
```

```yaml
pasos:
  - poner: {MW100: 1, MW102: 2, MW104: 3, MW106: 4, MW108: 5, MW110: 6, MW112: 7, MW114: 8, MW116: 9, MW118: 10}
    esperar: {MW40: 55, MD30: 960}
  - poner: {MW118: -10}
    esperar: {MW40: 35}
```

---

# I. Secuencias

### E28 — Semáforo con marcas de etapa (estilo GRAFCET)

**Enunciado**: con el interruptor E0.0 = 1, el semáforo hace un ciclo continuo:
- **verde** A4.0 durante 5 s,
- **ámbar** A4.1 durante 2 s,
- **rojo** A4.2 durante 5 s.

Con E0.0 = 0, todo se apaga.

**Conceptos**: cada etapa es una marca (M20.0, M20.1, M20.2). Una transición activa la siguiente etapa con `S` y desactiva la actual con `R`. Las salidas se asignan **una sola vez**, al final.

```awl
// Etapa inicial: marcha y ninguna etapa activa
      U     E 0.0
      UN    M 20.0
      UN    M 20.1
      UN    M 20.2
      S     M 20.0
// Etapa 1: verde (5 s)
      U     M 20.0
      L     S5T#5S
      SE    T 10
      U     T 10
      S     M 20.1
      R     M 20.0
// Etapa 2: ámbar (2 s)
      U     M 20.1
      L     S5T#2S
      SE    T 11
      U     T 11
      S     M 20.2
      R     M 20.1
// Etapa 3: rojo (5 s)
      U     M 20.2
      L     S5T#5S
      SE    T 12
      U     T 12
      S     M 20.0
      R     M 20.2
// Paro: borrar todas las etapas
      UN    E 0.0
      R     M 20.0
      R     M 20.1
      R     M 20.2
// Salidas
      U     M 20.0
      =     A 4.0
      U     M 20.1
      =     A 4.1
      U     M 20.2
      =     A 4.2
```

```yaml
pasos:
  - poner: {E0.0: 1}
    esperar: {A4.0: 1, A4.1: 0, A4.2: 0}
  - tiempo_ms: 4800
    esperar: {A4.0: 1}
  - tiempo_ms: 400
    esperar: {A4.0: 0, A4.1: 1}
  - tiempo_ms: 2000
    esperar: {A4.1: 0, A4.2: 1}
  - tiempo_ms: 5000
    esperar: {A4.2: 0, A4.0: 1}
  - poner: {E0.0: 0}
    esperar: {A4.0: 0, A4.1: 0, A4.2: 0}
```

---

# J. Preguntas tipo examen: "¿qué vale…?"

> En la app, estas preguntas son el modo **"Predice el resultado"**: se muestran el código y las entradas, el alumno responde y después se ejecuta la traza.

### Q01 — AWL se evalúa de forma secuencial

Con E0.0 = 1, E0.1 = 0 y E0.2 = 0, ¿cuánto vale A4.0?

```awl
      U     E 0.0
      O     E 0.1
      U     E 0.2
      =     A 4.0
```

<details><summary>Solución</summary>

**A4.0 = 0**. Se calcula (E0.0 ∨ E0.1) ∧ E0.2 = (1 ∨ 0) ∧ 0 = 0, no 1 ∨ (0 ∧ 0).

```yaml
pasos:
  - poner: {E0.0: 1, E0.1: 0, E0.2: 0}
    esperar: {A4.0: 0}
```
</details>

### Q02 — `O` sin operando

Mismas entradas que en Q01. ¿Cuánto vale A4.0?

```awl
      U     E 0.0
      O
      U     E 0.1
      U     E 0.2
      =     A 4.0
```

<details><summary>Solución</summary>

**A4.0 = 1**. Se calcula E0.0 ∨ (E0.1 ∧ E0.2).

```yaml
pasos:
  - poner: {E0.0: 1, E0.1: 0, E0.2: 0}
    esperar: {A4.0: 1}
```
</details>

### Q03 — ¿T depende del RLO?

Con E0.0 = 0, ¿cuánto valen MW30 y A4.0?

```awl
      U     E 0.0
      L     5
      T     MW 30
      =     A 4.0
```

<details><summary>Solución</summary>

**MW30 = 5** (T es incondicional) y **A4.0 = 0** (L y T no tocan el RLO).

```yaml
pasos:
  - poner: {E0.0: 0}
    esperar: {MW30: 5, A4.0: 0}
```
</details>

### Q04 — Comparación detrás de un contacto

Con E0.0 = 0 y MW30 = 10, ¿cuánto vale A4.0?

```awl
      U     E 0.0
      L     MW 30
      L     5
      >I
      =     A 4.0
```

<details><summary>Solución</summary>

**A4.0 = 1**. La comparación sustituye el RLO, así que el `U E 0.0` se pierde. La forma correcta es `U E0.0 / U( / L MW30 / L 5 / >I / ) / = A4.0`.

```yaml
pasos:
  - poner: {E0.0: 0, MW30: 10}
    esperar: {A4.0: 1}
```
</details>

### Q05 — INC

¿Cuánto vale MW30?

```awl
      L     255
      INC   1
      T     MW 30
```

<details><summary>Solución</summary>

**MW30 = 0**. INC solo actúa sobre el byte bajo de ACU1: 255 + 1 = 0, sin acarreo.

```yaml
pasos:
  - ciclos: 1
    esperar: {MW30: 0}
```
</details>

### Q06 — Orden de bytes

Si solo E0.0 = 1, ¿cuánto vale MW30? ¿Y si solo E1.0 = 1?

```awl
      L     EW 0
      T     MW 30
```

<details><summary>Solución</summary>

- Solo E0.0 = 1: **256**. EB0 es el byte alto de EW0.
- Solo E1.0 = 1: **1**.

```yaml
pasos:
  - poner: {E0.0: 1}
    esperar: {MW30: 256}
  - poner: {E0.0: 0, E1.0: 1}
    esperar: {MW30: 1}
```
</details>

### Q07 — L de un INT negativo

Con MW30 = −1, ¿cuánto valen MD40 y MD44?

```awl
      L     MW 30
      L     L#1
      +D
      T     MD 40
      L     MW 30
      ITD
      L     L#1
      +D
      T     MD 44
```

<details><summary>Solución</summary>

- **MD40 = 65536**: `L MW` rellena con ceros, así que ACU1 = 65535.
- **MD44 = 0**: `ITD` extiende el signo, así que ACU1 = −1.

```yaml
pasos:
  - poner: {MW30: -1}
    esperar: {MD40: 65536, MD44: 0}
```
</details>

### Q08 — SPB no tomado

¿Qué vale A4.0 en cada paso? Las entradas van cambiando: primero E0.0 = 1, luego E0.0 = 0 y luego E0.0 = 1.

```awl
      U     E 0.0
      SPB   FIN
      =     A 4.0
FIN:  NOP   0
```

<details><summary>Solución</summary>

- Con E0.0 = 1: salta y A4.0 **no se escribe**, así que sigue a 0.
- Con E0.0 = 0: **no salta, pero SPB deja RLO = 1**, así que A4.0 = 1.
- Con E0.0 = 1 otra vez: salta y A4.0 **se queda a 1**.

```yaml
pasos:
  - poner: {E0.0: 1}
    esperar: {A4.0: 0}
  - poner: {E0.0: 0}
    esperar: {A4.0: 1}
  - poner: {E0.0: 1}
    esperar: {A4.0: 1}
```
</details>

### Q09 — UN( … )

Con E0.0 = 1, E0.1 = 0 y E0.2 = 1, ¿cuánto vale A4.0? ¿Y con E0.2 = 0?

```awl
      U     E 0.0
      UN(
      O     E 0.1
      O     E 0.2
      )
      =     A 4.0
```

<details><summary>Solución</summary>

- Con E0.2 = 1: 1 ∧ ¬(0 ∨ 1) = **0**.
- Con E0.2 = 0: 1 ∧ ¬(0 ∨ 0) = **1**.

```yaml
pasos:
  - poner: {E0.0: 1, E0.1: 0, E0.2: 1}
    esperar: {A4.0: 0}
  - poner: {E0.2: 0}
    esperar: {A4.0: 1}
```
</details>

### Q10 — Valor de tiempo mal cargado

¿Qué pasa al activar E0.0?

```awl
      U     E 0.0
      L     500
      SE    T 1
      U     T 1
      =     A 4.0
```

<details><summary>Solución</summary>

La CPU pasa a **STOP**. 500 = W#16#01F4 no es un S5TIME válido (la cifra F no es BCD), así que hay un error de programación (OB121). Mientras E0.0 = 0 no ocurre nada, porque el valor solo se evalúa al arrancar el temporizador.

```yaml
pasos:
  - poner: {E0.0: 0}
    esperar: {A4.0: 0}
    esperar_estado: RUN
  - poner: {E0.0: 1}
    esperar_estado: STOP
```
</details>

### Q11 — Contador sin flanco

E1.0 se mantiene a 1 durante 10 ciclos. ¿Cuánto vale MW30?

```awl
      U     E 1.0
      ZV    Z 1
      L     Z 1
      T     MW 30
```

<details><summary>Solución</summary>

**MW30 = 1**. El contador solo cuenta en el flanco.

```yaml
pasos:
  - poner: {E1.0: 1}
    ciclos: 10
    esperar: {MW30: 1}
```
</details>

### Q12 — Orden de los segmentos

Se pone E0.0 = 1. ¿Cuánto vale A4.0 al terminar el primer ciclo? ¿Y al terminar el segundo?

```awl
      U     M 0.0
      =     A 4.0
      U     E 0.0
      =     M 0.0
```

<details><summary>Solución</summary>

- **Ciclo 1: A4.0 = 0.** M0.0 se calcula después de usarse.
- **Ciclo 2: A4.0 = 1.**

```yaml
pasos:
  - poner: {E0.0: 1}
    ciclos: 1
    esperar: {A4.0: 0, M0.0: 1}
  - ciclos: 1
    esperar: {A4.0: 1}
```
</details>

### Q13 — Cadena de O-exclusivas

¿Cuánto vale A4.0 con (1, 1, 1)? ¿Y con (1, 1, 0) y con (1, 0, 0)?

```awl
      X     E 0.0
      X     E 0.1
      X     E 0.2
      =     A 4.0
```

<details><summary>Solución</summary>

Es la **paridad**: A4.0 = 1 si hay un número impar de unos.
- (1, 1, 1) → **1**
- (1, 1, 0) → **0**
- (1, 0, 0) → **1**

```yaml
pasos:
  - poner: {E0.0: 1, E0.1: 1, E0.2: 1}
    esperar: {A4.0: 1}
  - poner: {E0.2: 0}
    esperar: {A4.0: 0}
  - poner: {E0.1: 0}
    esperar: {A4.0: 1}
```
</details>

### Q14 — Resultado completo de /I

¿Cuánto valen MW30 y MD32?

```awl
      L     17
      L     5
      /I
      T     MW 30
      T     MD 32
```

<details><summary>Solución</summary>

- **MW30 = 3** (el cociente).
- **MD32 = 131075** = DW#16#00020003: el resto (2) está en la palabra alta y el cociente (3) en la baja.

```yaml
pasos:
  - ciclos: 1
    esperar: {MW30: 3, MD32: 131075}
```
</details>

---

# K. Conversión KOP ↔ AWL

> En la app, el alumno escribe su versión y el simulador comprueba la **equivalencia** ejecutando las pruebas (o todas las combinaciones de entradas) sobre la solución y sobre la respuesta del alumno.

### C01 — Pasar a AWL

```text
     E0.0              E0.2        A4.0
 |---| |-----+---------|/|---------( )
 |   E0.1    |
 |---| |-----+
```

<details><summary>Solución</summary>

Dos soluciones válidas: `U( / O E0.0 / O E0.1 / ) / UN E0.2 / = A4.0` y, aprovechando la evaluación secuencial, la que sigue.
</details>

```awl
      O     E 0.0
      O     E 0.1
      UN    E 0.2
      =     A 4.0
```

```yaml
pasos:
  - poner: {E0.0: 1, E0.1: 0, E0.2: 0}
    esperar: {A4.0: 1}
  - poner: {E0.0: 0, E0.1: 1, E0.2: 0}
    esperar: {A4.0: 1}
  - poner: {E0.0: 1, E0.1: 1, E0.2: 1}
    esperar: {A4.0: 0}
  - poner: {E0.0: 0, E0.1: 0, E0.2: 0}
    esperar: {A4.0: 0}
```

### C02 — Pasar a AWL (dos ramas con Set y Reset)

```text
     E0.0     E0.1           A4.0
 |---| |------| |-----+------(S)
 |   E0.2     E0.3    |
 |---| |------|/|-----+
     E0.4                    A4.0
 |---| |---------------------(R)
```

```awl
      U     E 0.0
      U     E 0.1
      O
      U     E 0.2
      UN    E 0.3
      S     A 4.0
      U     E 0.4
      R     A 4.0
```

```yaml
pasos:
  - poner: {E0.0: 1, E0.1: 1, E0.2: 0, E0.3: 0, E0.4: 0}
    esperar: {A4.0: 1}
  - poner: {E0.0: 0, E0.1: 0}
    esperar: {A4.0: 1}
  - poner: {E0.4: 1}
    esperar: {A4.0: 0}
  - poner: {E0.4: 0, E0.2: 1, E0.3: 1}
    esperar: {A4.0: 0}
  - poner: {E0.3: 0}
    esperar: {A4.0: 1}
  - poner: {E0.2: 0, E0.0: 1, E0.1: 1, E0.4: 1}
    esperar: {A4.0: 0}
```

### C03 — Pasar a KOP

Dibuja el KOP equivalente de este AWL:

```awl
      U     E 0.0
      U(
      O     E 0.1
      O(
      U     E 0.2
      U     E 0.3
      )
      )
      =     A 4.0
      =     A 4.1
```

<details><summary>Solución</summary>

```text
     E0.0     E0.1                    A4.0
 |---| |---+--| |-------------+---+---( )
 |         |  E0.2     E0.3   |   |   A4.1
 |         +--| |------| |----+   +---( )
```
</details>

```yaml
pasos:
  - poner: {E0.0: 1, E0.1: 1, E0.2: 0, E0.3: 0}
    esperar: {A4.0: 1, A4.1: 1}
  - poner: {E0.1: 0, E0.2: 1, E0.3: 1}
    esperar: {A4.0: 1, A4.1: 1}
  - poner: {E0.3: 0}
    esperar: {A4.0: 0, A4.1: 0}
  - poner: {E0.0: 0, E0.1: 1, E0.3: 1}
    esperar: {A4.0: 0}
```

### C04 — Pasar a KOP (comparador y temporizador)

```awl
      U     E 2.0
      U(
      L     MW 30
      L     100
      >I
      )
      L     S5T#3S
      SE    T 2
      U     T 2
      =     A 4.3
```

<details><summary>Solución</summary>

```text
     E2.0      CMP >I              T2
 |---| |------+-------+-------+-----------+           A4.3
 |     MW30 --|IN1    |       | S_EVERZ   |
 |     100  --|IN2    |       |S         Q|-----------( )
 |            +-------+       |           |
 |                   S5T#3S --|TW         |
 |                            +-----------+
```
(El comparador sale hacia la patilla S del temporizador.)
</details>

```yaml
pasos:
  - poner: {E2.0: 1, MW30: 150}
    esperar: {A4.3: 0}
  - tiempo_ms: 2900
    esperar: {A4.3: 0}
  - tiempo_ms: 200
    esperar: {A4.3: 1}
  - poner: {MW30: 50}
    esperar: {A4.3: 0}
```

---

# L. Ejercicios propuestos (con solución)

> En la app: enunciado → el alumno programa en KOP o AWL → se ejecutan las pruebas → nota. La solución se muestra al final.

### P01 — Llenado de depósito con histéresis

**Enunciado**:
- E0.2 = sonda de mínimo (1 = hay agua por encima del mínimo).
- E0.3 = sonda de máximo (1 = el agua llega al máximo).
- E0.1 = paro (NC).

La bomba A4.0 arranca cuando el nivel baja del mínimo y para al llegar al máximo. Entre las dos sondas mantiene su estado. El paro la detiene.

<details><summary>Solución</summary>

Set por debajo del mínimo; Reset en el máximo o con el paro (los Reset van después: prioridad a parar).
</details>

```awl
      UN    E 0.2
      S     A 4.0
      U     E 0.3
      R     A 4.0
      UN    E 0.1
      R     A 4.0
```

```yaml
inicial: {E0.1: 1}
pasos:
  - poner: {E0.2: 0, E0.3: 0}
    esperar: {A4.0: 1}
  - poner: {E0.2: 1}
    esperar: {A4.0: 1}          # entre sondas: sigue llenando
  - poner: {E0.3: 1}
    esperar: {A4.0: 0}
  - poner: {E0.3: 0}
    esperar: {A4.0: 0}          # entre sondas vaciándose: sigue parada
  - poner: {E0.2: 0}
    esperar: {A4.0: 1}
  - poner: {E0.1: 0}
    esperar: {A4.0: 0}
```

### P02 — Minutero de escalera

**Enunciado**: un pulso en E0.0 enciende la luz A4.0 durante 30 s. Si se vuelve a pulsar mientras está encendida, los 30 s vuelven a empezar.

<details><summary>Solución</summary>

Impulso prolongado (SV): se redispara con cada flanco.
</details>

```awl
      U     E 0.0
      L     S5T#30S
      SV    T 1
      U     T 1
      =     A 4.0
```

```yaml
pasos:
  - pulso: E0.0
    esperar: {A4.0: 1}
  - tiempo_ms: 29000
    esperar: {A4.0: 1}
  - tiempo_ms: 2000
    esperar: {A4.0: 0}
  - pulso: E0.0
    esperar: {A4.0: 1}
  - tiempo_ms: 20000
    esperar: {A4.0: 1}
  - pulso: E0.0
    esperar: {A4.0: 1}
  - tiempo_ms: 25000
    esperar: {A4.0: 1}
  - tiempo_ms: 6000
    esperar: {A4.0: 0}
```

### P03 — Encajado: aviso cada 5 piezas

**Enunciado**: E1.0 = sensor de pieza. Al llegar a 5 piezas, el aviso A5.0 se enciende durante 2 s y el contador vuelve a 0 automáticamente.

<details><summary>Solución</summary>

Contador ascendente + comparación ≥ 5 que dispara un SV de 2 s y hace reset del contador.
</details>

```awl
      U     E 1.0
      ZV    Z 1
      L     Z 1
      L     5
      >=I
      L     S5T#2S
      SV    T 1
      U     T 1
      =     A 5.0
      L     Z 1
      L     5
      >=I
      R     Z 1
```

```yaml
pasos:
  - pulso: E1.0
    veces: 4
    esperar: {A5.0: 0, "Z1:VALOR": 4}
  - pulso: E1.0
    esperar: {A5.0: 1, "Z1:VALOR": 0}
  - tiempo_ms: 1800
    esperar: {A5.0: 1}
  - tiempo_ms: 300
    esperar: {A5.0: 0}
  - pulso: E1.0
    veces: 5
    esperar: {A5.0: 1}
```

### P04 — Arranque estrella-triángulo

**Enunciado**:
- E0.0 = marcha; E0.1 = paro (NC).
- A4.0 = contactor de línea (KM1), A4.1 = estrella (KM2), A4.2 = triángulo (KM3).

Al dar marcha entran línea y estrella. A los 5 s se desconecta la estrella y entra el triángulo. Estrella y triángulo **nunca** pueden estar a la vez (enclavamiento mutuo).

<details><summary>Solución</summary>

Línea con enclavamiento; SE de 5 s; estrella = línea ∧ ¬T1 ∧ ¬triángulo; triángulo = línea ∧ T1 ∧ ¬estrella.
</details>

```awl
// Línea (enclavamiento)
      U(
      O     E 0.0
      O     A 4.0
      )
      U     E 0.1
      =     A 4.0
// Tiempo de estrella
      U     A 4.0
      L     S5T#5S
      SE    T 1
// Estrella
      U     A 4.0
      UN    T 1
      UN    A 4.2
      =     A 4.1
// Triángulo
      U     A 4.0
      U     T 1
      UN    A 4.1
      =     A 4.2
```

```yaml
inicial: {E0.1: 1}
pasos:
  - pulso: E0.0
    esperar: {A4.0: 1, A4.1: 1, A4.2: 0}
  - tiempo_ms: 4800
    esperar: {A4.1: 1, A4.2: 0}
  - tiempo_ms: 300
    esperar: {A4.0: 1, A4.1: 0, A4.2: 1}
  - poner: {E0.1: 0}
    esperar: {A4.0: 0, A4.1: 0, A4.2: 0}
```

---

# M. Preguntas de teoría (test)

> En la app: modo **"Teoría"**, preguntas de opción múltiple con la explicación al responder. `correcta` es el índice (desde 0) de la opción correcta; la app debe barajar las opciones al mostrarlas.

### M01 — Banco de preguntas de teoría

```yaml
preguntas:
  - id: M01
    pregunta: "¿Qué bytes forman la palabra de marcas MW 10?"
    opciones: ["MB10 y MB11", "MB9 y MB10", "MB10, MB11, MB12 y MB13", "MB10 y MB12"]
    correcta: 0
    explicacion: "Una palabra son 2 bytes empezando en la dirección indicada. MB10 es el byte alto y MB11 el bajo."
  - id: M02
    pregunta: "Si solo E1.0 = 1, ¿cuánto vale EW 0?"
    opciones: ["1", "256", "128", "2"]
    correcta: 0
    explicacion: "EB1 es el byte bajo de EW0, y E1.0 es su bit 0. Si solo E0.0 = 1, EW0 valdría 256."
  - id: M03
    pregunta: "¿Cómo se guarda S5T#5S en el acumulador?"
    opciones: ["W#16#0500", "W#16#1050", "W#16#01F4", "W#16#0005"]
    correcta: 0
    explicacion: "Base 10 ms (bits 13-12 = 00) y valor 500 en BCD: 16#0500."
  - id: M04
    pregunta: "¿Qué temporizador mantiene Q = 1 durante todo el tiempo programado aunque la entrada S caiga antes?"
    opciones: ["SV (S_VIMP, impulso prolongado)", "SI (S_IMPULS, impulso)", "SE (S_EVERZ, retardo a la conexión)", "SA (S_AVERZ, retardo a la desconexión)"]
    correcta: 0
    explicacion: "El impulso prolongado no depende de que S siga a 1. El impulso SI se corta si S cae."
  - id: M05
    pregunta: "¿Qué temporizador pone Q = 1 en cuanto S = 1 y la mantiene un tiempo después de que S caiga?"
    opciones: ["SA (S_AVERZ)", "SE (S_EVERZ)", "SS (S_SEVERZ)", "SI (S_IMPULS)"]
    correcta: 0
    explicacion: "Es el retardo a la desconexión: el tiempo empieza a contar en el flanco negativo de S."
  - id: M06
    pregunta: "El pulsador de paro está cableado como contacto NC. ¿Qué contacto se programa para que el motor pueda funcionar?"
    opciones: ["Un contacto NA (U E0.1)", "Un contacto NC (UN E0.1)", "Un flanco positivo", "Da igual"]
    correcta: 0
    explicacion: "En reposo la entrada vale 1. El contacto del programa solo pregunta: «¿vale 1?». Si se rompe el cable, la máquina se para."
  - id: M07
    pregunta: "¿Cuál es el rango de valores de un contador (Z)?"
    opciones: ["0 a 999", "0 a 255", "−32768 a 32767", "0 a 9999"]
    correcta: 0
    explicacion: "El valor se guarda en 3 cifras BCD. No baja de 0 ni sube de 999."
  - id: M08
    pregunta: "¿Qué hace «T MW 10» si el RLO vale 0?"
    opciones: ["Transfiere igualmente ACU1 a MW10", "No hace nada", "Escribe 0 en MW10", "Provoca un error"]
    correcta: 0
    explicacion: "L y T son incondicionales: no dependen del RLO. Para condicionarlos hay que saltar por encima."
  - id: M09
    pregunta: "¿Qué bit de la palabra de estado indica si la siguiente instrucción lógica es una primera consulta?"
    opciones: ["/ER", "STA", "OR", "RB (BIE)"]
    correcta: 0
    explicacion: "Con /ER = 0 la siguiente U/O/X copia el operando en el RLO en lugar de combinarlo."
  - id: M10
    pregunta: "¿Qué resultado deja «L 30000 / L 10000 / +I» en la parte baja de ACU1?"
    opciones: ["−25536, con OV = 1", "40000", "32767 (satura)", "La CPU pasa a STOP"]
    correcta: 0
    explicacion: "40000 no cabe en un INT: el resultado da la vuelta (40000 − 65536) y se activan OV y OS."
  - id: M11
    pregunta: "¿Qué OB se ejecuta cíclicamente con el programa principal?"
    opciones: ["OB1", "OB100", "OB35", "OB80"]
    correcta: 0
    explicacion: "OB100 es el arranque, OB35 la alarma cíclica y OB80 el error de tiempo."
  - id: M12
    pregunta: "¿Qué OB se ejecuta una sola vez al pasar de STOP a RUN (rearranque completo)?"
    opciones: ["OB100", "OB1", "OB121", "OB10"]
    correcta: 0
    explicacion: "OB100 sirve para inicializar. Después empieza el ciclo de OB1."
  - id: M13
    pregunta: "Si el programa tiene «= A 4.0» en dos segmentos distintos, ¿qué valor llega a la salida?"
    opciones: ["El de la última asignación ejecutada", "El O de las dos", "El Y de las dos", "La CPU da error"]
    correcta: 0
    explicacion: "La PAA se escribe al final del ciclo, así que la última asignación sobrescribe a las anteriores."
  - id: M14
    pregunta: "¿Qué diferencia a un FB de un FC?"
    opciones: ["El FB tiene memoria propia (DB de instancia)", "El FC solo se puede llamar desde OB1", "El FB no admite parámetros", "No hay diferencia"]
    correcta: 0
    explicacion: "Las variables estáticas (STAT) del FB se guardan en su DB de instancia y conservan el valor entre llamadas."
  - id: M15
    pregunta: "¿Qué valor da una entrada analógica al final de su rango nominal (por ejemplo, 10 V o 20 mA)?"
    opciones: ["27648", "32767", "4095", "65535"]
    correcta: 0
    explicacion: "El rango nominal va de 0 a 27648. Por encima está el rango de rebase, y 32767 indica desbordamiento o rotura de hilo."
  - id: M16
    pregunta: "¿Cuántos niveles de paréntesis anidados admite AWL?"
    opciones: ["7", "8", "16", "Ilimitados"]
    correcta: 0
    explicacion: "La pila de anidamiento tiene 7 niveles. Si se superan, hay un error y la CPU pasa a STOP."
  - id: M17
    pregunta: "Con MW10 = −1, ¿qué contiene ACU1 después de «L MW 10»?"
    opciones: ["DW#16#0000FFFF", "DW#16#FFFFFFFF", "DW#16#FFFF0000", "0"]
    correcta: 0
    explicacion: "L rellena con ceros la parte alta, sin extender el signo. Para pasarlo a DINT hay que usar ITD."
  - id: M18
    pregunta: "¿Qué instrucción AWL equivale a la bobina «(S)» de KOP?"
    opciones: ["S", "=", "SET", "SE"]
    correcta: 0
    explicacion: "SET pone el RLO a 1, SE arranca un temporizador y = asigna el RLO."
  - id: M19
    pregunta: "¿Qué hace la instrucción SET en AWL?"
    opciones: ["Pone el RLO a 1", "Pone a 1 el bit indicado", "Arranca un temporizador", "Pone OS a 1"]
    correcta: 0
    explicacion: "SET y CLR actúan sobre el RLO y cierran la cadena lógica (/ER = 0)."
  - id: M20
    pregunta: "¿Qué contiene ACU1 tras «L 17 / L 5 / /I»?"
    opciones: ["El cociente 3 en la parte baja y el resto 2 en la parte alta", "3,4 en REAL", "Solo el cociente 3", "Solo el resto 2"]
    correcta: 0
    explicacion: "/I deja el cociente en ACU1-L y el resto en ACU1-H. ACU1 = DW#16#00020003."
  - id: M21
    pregunta: "En nemotécnica inglesa, ¿cómo se escribe «SE T 1» (retardo a la conexión)?"
    opciones: ["SD T 1", "SE T 1", "SO T 1", "TON T 1"]
    correcta: 0
    explicacion: "En inglés, SE es el impulso prolongado (en alemán SV). El retardo a la conexión es SD."
  - id: M22
    pregunta: "Con MB100 configurado como marca de ciclo, ¿qué bit oscila a 1 Hz?"
    opciones: ["M100.5", "M100.0", "M100.7", "M100.3"]
    correcta: 0
    explicacion: "Periodos de los bits 0 a 7: 0,1 / 0,2 / 0,4 / 0,5 / 0,8 / 1 / 1,6 / 2 s. El bit 5 tiene un periodo de 1 s."
  - id: M23
    pregunta: "¿Cómo quedan RLO y /ER cuando un SPB no salta?"
    opciones: ["RLO = 1 y /ER = 0", "Sin cambios", "RLO = 0 y /ER = 0", "RLO = 0 y /ER = 1"]
    correcta: 0
    explicacion: "SPB y SPBN siempre dejan RLO = 1 y cierran la cadena, tanto si saltan como si no."
  - id: M24
    pregunta: "En KOP, dos contactos en serie equivalen a…"
    opciones: ["Una función Y (AND)", "Una función O (OR)", "Una O-exclusiva", "Un flanco"]
    correcta: 0
    explicacion: "La corriente solo pasa si conducen los dos. En paralelo es una O."
```

---

# N. Trazas (palabra de estado instrucción a instrucción)

> En la app: modo **"Traza"**. Se muestran el código y las entradas, y el alumno rellena la tabla. Formato:
> - `inicial`: valores antes del ciclo.
> - `filas`: una por instrucción ejecutada, en orden. `i` es la instrucción y solo sirve para leerla.
> - `er_antes` es el /ER **antes** de ejecutar la instrucción (indica si es primera consulta). El resto de columnas son el estado **después** de la instrucción.
> - Columnas posibles: `er_antes`, `rlo`, `sta`, `or`, `ov`, `os`, `cc1` (A1), `cc0` (A0), `br` (RB), `acu1`, `acu2` (32 bits con signo), `acu1_int`, `acu2_int` (parte baja como INT). Solo se comprueban las columnas que aparecen.
> - Convención del simulador: al empezar el OB1, la palabra de estado y los acumuladores valen 0.

### T01 — Grupos Y con `O` (caso de la referencia §7.21)

```awl
      U     E 0.0
      U     E 0.1
      O
      U     E 0.2
      U     E 0.3
      =     A 4.0
```

```yaml
traza:
  inicial: {E0.0: 1, E0.1: 0, E0.2: 1, E0.3: 1}
  filas:
    - {i: "U E 0.0", er_antes: 0, sta: 1, rlo: 1, or: 0}
    - {i: "U E 0.1", er_antes: 1, sta: 0, rlo: 0, or: 0}
    - {i: "O",       er_antes: 1, sta: 1, rlo: 0, or: 0}
    - {i: "U E 0.2", er_antes: 0, sta: 1, rlo: 1, or: 0}
    - {i: "U E 0.3", er_antes: 1, sta: 1, rlo: 1, or: 0}
    - {i: "= A 4.0", er_antes: 1, sta: 1, rlo: 1, or: 0}
```

### T02 — Paréntesis negado `UN(`

```awl
      U     E 0.0
      UN(
      O     E 0.1
      O     E 0.2
      )
      =     A 4.0
```

```yaml
traza:
  inicial: {E0.0: 1, E0.1: 0, E0.2: 1}
  filas:
    - {i: "U E 0.0", er_antes: 0, sta: 1, rlo: 1, or: 0}
    - {i: "UN(",     er_antes: 1, sta: 1, rlo: 1, or: 0}
    - {i: "O E 0.1", er_antes: 0, sta: 0, rlo: 0, or: 0}
    - {i: "O E 0.2", er_antes: 1, sta: 1, rlo: 1, or: 0}
    - {i: ")",       er_antes: 1, sta: 1, rlo: 0, or: 0}
    - {i: "= A 4.0", er_antes: 1, sta: 0, rlo: 0, or: 0}
```

### T03 — Bit OR a 1: el resultado ya está decidido

```awl
      U     E 0.0
      U     E 0.1
      O
      U     E 0.2
      U     E 0.3
      =     A 4.0
```

```yaml
traza:
  inicial: {E0.0: 1, E0.1: 1, E0.2: 0, E0.3: 0}
  filas:
    - {i: "U E 0.0", er_antes: 0, sta: 1, rlo: 1, or: 0}
    - {i: "U E 0.1", er_antes: 1, sta: 1, rlo: 1, or: 0}
    - {i: "O",       er_antes: 1, sta: 1, rlo: 1, or: 1}
    - {i: "U E 0.2", er_antes: 0, sta: 0, rlo: 1, or: 1}
    - {i: "U E 0.3", er_antes: 1, sta: 0, rlo: 1, or: 1}
    - {i: "= A 4.0", er_antes: 1, sta: 1, rlo: 1, or: 0}
```

### T04 — Acumuladores y comparación

```awl
      L     MW 30
      L     MW 32
      >I
      =     A 4.0
```

```yaml
traza:
  inicial: {MW30: 10, MW32: 5}
  filas:
    - {i: "L MW 30", acu1: 10, acu2: 0}
    - {i: "L MW 32", acu1: 5, acu2: 10}
    - {i: ">I",      acu1: 5, acu2: 10, rlo: 1, cc1: 1, cc0: 0, er_antes: 0}
    - {i: "= A 4.0", rlo: 1, er_antes: 1}
```

### T05 — Desbordamiento en +I

```awl
      L     30000
      L     10000
      +I
      T     MW 44
```

```yaml
traza:
  inicial: {}
  filas:
    - {i: "L 30000", acu1_int: 30000, acu2_int: 0}
    - {i: "L 10000", acu1_int: 10000, acu2_int: 30000}
    - {i: "+I",      acu1_int: -25536, acu2_int: 30000, ov: 1, os: 1, cc1: 0, cc0: 1}
    - {i: "T MW 44", acu1_int: -25536, ov: 1, os: 1}
```

---

# O. Cronogramas de temporizadores

> En la app: modo **"Cronograma"**. Se muestra la señal de entrada y el alumno dibuja la salida. Formato:
> - Cada carácter es un intervalo de `paso_ms`.
> - Las entradas cambian al **principio** de cada intervalo y las salidas se leen **a mitad** del intervalo, para no depender del ciclo exacto en que cambia la salida.
> - En los esquemas, `‾` = 1 y `_` = 0. Cada carácter vale 0,5 s y los temporizadores son de 1 s (2 caracteres).

### R01 — Retardo a la conexión (SE) de 1 s

```text
 t (×0,5 s)  0123456789012345
 E0.0        _‾‾‾‾‾‾__‾‾‾____
 A4.0        ___‾‾‾‾____‾____
```

```awl
      U     E 0.0
      L     S5T#1S
      SE    T 1
      U     T 1
      =     A 4.0
```

```yaml
cronograma:
  paso_ms: 500
  entradas: {E0.0: "0111111001110000"}
  salidas:  {A4.0: "0001111000010000"}
```

### R02 — Retardo a la desconexión (SA) de 1 s

```text
 t (×0,5 s)  0123456789012345
 E0.0        _‾‾____‾‾‾___‾__
 A4.0        _‾‾‾‾__‾‾‾‾‾_‾‾‾
```

```awl
      U     E 0.0
      L     S5T#1S
      SA    T 1
      U     T 1
      =     A 4.0
```

```yaml
cronograma:
  paso_ms: 500
  entradas: {E0.0: "0110000111000100"}
  salidas:  {A4.0: "0111100111110111"}
```

### R03 — Impulso (SI) frente a impulso prolongado (SV) de 1 s

```text
 t (×0,5 s)  0123456789012345
 E0.0        _‾‾‾‾__‾___‾‾___
 A4.0 (SI)   _‾‾____‾___‾‾___
 A4.1 (SV)   _‾‾____‾‾__‾‾___
```

```awl
      U     E 0.0
      L     S5T#1S
      SI    T 1
      U     T 1
      =     A 4.0
      U     E 0.0
      L     S5T#1S
      SV    T 2
      U     T 2
      =     A 4.1
```

```yaml
cronograma:
  paso_ms: 500
  entradas: {E0.0: "0111100100011000"}
  salidas:  {A4.0: "0110000100011000", A4.1: "0110000110011000"}
```
