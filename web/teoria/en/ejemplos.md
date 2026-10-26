# Ladder and STL examples

> English translation of the examples from `src/content/ejemplos_KOP_AWL.md` that appear on the website.
> - Keep the same codes (E01, Q01…): the pages are built from them (`web/teoria/paginas.ts`).
> - Code blocks (```awl) keep the German mnemonics, like the app; the generator converts them to English.
> - The tests (```yaml) are not repeated here: the interactive panels always read them from the Spanish file.
> - On the website, the first ```text block of an example with a Ladder model is replaced by the drawing.

---

### E09 — Double assignment (typical mistake)

**Task**: Q4.0 should turn on with I0.0 **or** with I0.1. This program **is wrong**.
**Concepts**: the PIQ is written at the end of the cycle, so only the last assignment counts.

```awl
      U     E 0.0
      =     A 4.0
      U     E 0.1
      =     A 4.0       // overwrites the previous one
```

### E09b — Double assignment, corrected

```text
     I0.0               Q4.0
 |---| |----+-----------( )
 |   I0.1   |
 |---| |----+
```

```awl
      O     E 0.0
      O     E 0.1
      =     A 4.0
```

### Q12 — Order of the networks

I0.0 is set to 1. What is the value of Q4.0 at the end of the first cycle? And at the end of the second?

```awl
      U     M 0.0
      =     A 4.0
      U     E 0.0
      =     M 0.0
```

<details><summary>Solution</summary>

- **Cycle 1: Q4.0 = 0.** M0.0 is calculated after it is used.
- **Cycle 2: Q4.0 = 1.**

</details>

### Q06 — Byte order

If only I0.0 = 1, what is the value of MW30? And if only I1.0 = 1?

```awl
      L     EW 0
      T     MW 30
```

<details><summary>Solution</summary>

- Only I0.0 = 1: **256**. IB0 is the high byte of IW0.
- Only I1.0 = 1: **1**.

</details>

### E24 — BCD thumbwheel and display

**Task**:
- IW2 = 3-digit thumbwheel in BCD. MW70 = its integer value.
- MW72 = MW70 + 1.
- QW6 = MW72 in BCD, for a 3-digit display.

**Concepts**: BCD and byte order. QW6 = QB6 (high byte) + QB7 (low byte).

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

### E01 — NO contact and NC contact

**Task**: lamp Q4.0 turns on when I0.0 = 1, and lamp Q4.1 when I0.0 = 0.
**Concepts**: a contact **checks** the state of a bit (§1.3 and §6.2 of the reference).

```text
     I0.0               Q4.0
 |---| |----------------( )
     I0.0               Q4.1
 |---|/|----------------( )
```

```awl
      U     E 0.0
      =     A 4.0
      UN    E 0.0
      =     A 4.1
```

### E02 — AND (series) and OR (parallel)

**Task**: Q4.0 = I0.0 AND I0.1. Q4.1 = I0.0 OR I0.1.

```text
     I0.0     I0.1      Q4.0
 |---| |------| |-------( )

     I0.0               Q4.1
 |---| |----+-----------( )
 |   I0.1   |
 |---| |----+
```

```awl
// Network 1: AND
      U     E 0.0
      U     E 0.1
      =     A 4.0
// Network 2: OR
      O     E 0.0
      O     E 0.1
      =     A 4.1
```

### E03 — NAND, NOR and exclusive OR

**Task**: Q4.0 = NAND, Q4.1 = NOR and Q4.2 = XOR of I0.0 and I0.1.

```text
     I0.0     I0.1            Q4.0
 |---| |------| |-----|NOT|---( )

     I0.0                     Q4.1
 |---| |----+-------|NOT|-----( )
 |   I0.1   |
 |---| |----+

     I0.0     I0.1            Q4.2
 |---| |------|/|-----+-------( )
 |   I0.0     I0.1    |
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
// XOR (STL has the X instruction)
      X     E 0.0
      X     E 0.1
      =     A 4.2
```

### E04 — "AND before OR" with `O` without operand

**Task**: Q4.0 = (I0.0 ∧ I0.1) ∨ (I0.2 ∧ I0.3).
**Concepts**: the OR bit and the first check (§7.4 of the reference).

```text
     I0.0     I0.1      Q4.0
 |---| |------| |---+---( )
 |   I0.2     I0.3  |
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

### E05 — Brackets: AND with an OR group

**Task**: Q4.1 = I0.0 ∧ (I0.1 ∨ I0.2).

```text
     I0.0     I0.1           Q4.1
 |---| |---+--| |----+-------( )
 |         |  I0.2   |
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

### Q01 — STL is evaluated sequentially

With I0.0 = 1, I0.1 = 0 and I0.2 = 0, what is the value of Q4.0?

```awl
      U     E 0.0
      O     E 0.1
      U     E 0.2
      =     A 4.0
```

<details><summary>Solution</summary>

**Q4.0 = 0**. It calculates (I0.0 ∨ I0.1) ∧ I0.2 = (1 ∨ 0) ∧ 0 = 0, not 1 ∨ (0 ∧ 0).

</details>

### Q02 — `O` without operand

Same inputs as in Q01. What is the value of Q4.0?

```awl
      U     E 0.0
      O
      U     E 0.1
      U     E 0.2
      =     A 4.0
```

<details><summary>Solution</summary>

**Q4.0 = 1**. It calculates I0.0 ∨ (I0.1 ∧ I0.2).

</details>

### E06 — Start and stop with latching (stop priority)

**Task**: I0.0 = start (NO push button). I0.1 = stop (**wired NC push button**, so it is 1 at rest). Q4.0 = motor.
**Concepts**: self-holding, safety through wiring and stop priority.

```text
     I0.0 Start    I0.1 Stop (NC)       Q4.0 Motor
 |---| |------+-------| |---------------( )
 |            |
 |   Q4.0     |
 |---| |------+
```

```awl
      U(
      O     E 0.0       // start
      O     A 4.0       // feedback (latching)
      )
      U     E 0.1       // NC stop: 1 = not pressed
      =     A 4.0
```

### E07 — Start and stop with Set/Reset (stop priority)

**Concepts**: the priority is given by the **order**: the last instruction wins.

```text
     I0.0                 Q4.0
 |---| |------------------(S)
     I0.1 (NC)            Q4.0
 |---|/|------------------(R)
```

```awl
      U     E 0.0
      S     A 4.0
      UN    E 0.1       // stop pressed (I0.1 = 0)
      R     A 4.0       // R at the end → stop priority
```

### E08 — Start and stop with start priority

**Task**: the same as E07, but if both are pressed, start must win.

```text
     I0.1 (NC)            Q4.0
 |---|/|------------------(R)
     I0.0                 Q4.0
 |---| |------------------(S)      ← S at the end
```

```awl
      UN    E 0.1
      R     A 4.0
      U     E 0.0
      S     A 4.0
```

### E10 — Rising and falling edge

**Task**: M10.1 = one-cycle pulse when I0.0 is pressed. M10.3 = one-cycle pulse when it is released.
**Concepts**: each edge needs **its own** edge memory bit (M10.0 and M10.2).

```text
     I0.0     M10.0          M10.1
 |---| |-------(P)-----------( )
     I0.0     M10.2          M10.3
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

### E11 — Toggle relay (one push button switches on and off)

**Task**: each press of I0.0 changes the state of lamp Q4.0.
**Concepts**: edge + self-holding with two branches.

```text
     I0.0     M10.0          M10.1
 |---| |-------(P)-----------( )

     M10.1    Q4.0           Q4.0
 |---| |------|/|-----+------( )
 |   M10.1    Q4.0    |
 |---|/|------| |-----+
```

```awl
      U     E 0.0
      FP    M 10.0
      =     M 10.1      // pulse
      U     M 10.1
      UN    A 4.0
      O
      UN    M 10.1
      U     A 4.0
      =     A 4.0
```

### E12 — On-delay (SD / S_ODT)

**Task**: Q4.0 turns on 5 s after I0.0 is activated, and only if I0.0 is still 1. I0.1 resets the timer. MW10 holds the remaining time in binary and MW12 in BCD.

```text
                 T1
             +-----------+
   I0.0      | S_ODT     |                       Q4.0
 |---| |-----|S         Q|-----------------------( )
 S5T#5S -----|TV       BI|-- MW10
   I0.1      |        BCD|-- MW12
 |---| |-----|R          |
             +-----------+
```

```awl
      U     E 0.0
      L     S5T#5S
      SE    T 1
      U     E 0.1
      R     T 1
      L     T 1         // remaining time (binary, in units of 10 ms)
      T     MW 10
      LC    T 1         // remaining time in BCD with time base
      T     MW 12
      U     T 1
      =     A 4.0
```

### E13 — Off-delay (SF / S_OFFDT)

**Task**: fan Q4.1 runs while I0.2 = 1 and keeps running for 3 more seconds after it is switched off.

```text
                 T2
             +-----------+
   I0.2      | S_OFFDT   |                       Q4.1
 |---| |-----|S         Q|-----------------------( )
 S5T#3S -----|TV         |
             +-----------+
```

```awl
      U     E 0.2
      L     S5T#3S
      SA    T 2
      U     T 2
      =     A 4.1
```

### E17 — Flasher (1 s on / 1 s off) with two timers

**Task**: while I0.7 = 1, lamp Q4.5 flashes.
**Concepts**: each timer restarts the other one. Alternative: use a clock memory (§2.6 of the reference).

```text
     I0.7     T7                 T6
 |---| |------|/|-----------+--------+
 |                          |S_ODT   |
 |              S5T#1S -----|TV     Q|
 |                          +--------+
     T6                          T7
 |---| |--------------------+--------+
 |                          |S_ODT   |
 |              S5T#1S -----|TV     Q|
 |                          +--------+
     T6                        Q4.5
 |---| |-----------------------( )
```

```awl
      U     E 0.7
      UN    T 7
      L     S5T#1S
      SE    T 6         // off time
      U     T 6
      L     S5T#1S
      SE    T 7         // on time
      U     T 6
      =     A 4.5
```

### Q10 — Time value loaded wrongly

What happens when I0.0 is activated?

```awl
      U     E 0.0
      L     500
      SE    T 1
      U     T 1
      =     A 4.0
```

<details><summary>Solution</summary>

The CPU goes to **STOP**. 500 = W#16#01F4 is not a valid S5TIME (the digit F is not BCD), so there is a programming error (OB121). While I0.0 = 0 nothing happens, because the value is only evaluated when the timer starts.

</details>

### E18 — Car park with 10 spaces

**Task**:
- I1.0 = a car comes in; I1.1 = a car goes out.
- I1.2 loads an initial occupancy of 5; I1.3 resets the counter to zero.
- MW30 = occupancy. Q5.0 = "FULL" (occupancy ≥ 10). Q5.1 = there is at least one car.

```text
                 C1
             +-----------+
   I1.0      | S_CUD     |                       Q5.1
 |---| |-----|CU        Q|-----------------------( )
   I1.1      |           |
 |---| |-----|CD         |
   I1.2      |           |
 |---| |-----|S        CV|-- MW30
 C#5 --------|PV         |
   I1.3      |           |
 |---| |-----|R          |
             +-----------+
                CMP >=I                          Q5.0
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
      L     10          // ACCU2 = occupancy, ACCU1 = 10
      >=I
      =     A 5.0
      U     Z 1
      =     A 5.1
```

### E19 — Countdown

**Task**: I1.4 loads 3. Each pulse of I1.5 counts down by 1. Q5.2 = end of the countdown (value 0). MW32 = value in BCD.

```awl
      U     E 1.4
      L     C#3
      S     Z 2
      U     E 1.5
      ZR    Z 2
      UN    Z 2         // Q = 0 → value = 0
      =     A 5.2
      LC    Z 2
      T     MW 32
```

### E20 — Level comparison

**Task**: MW30 = level in litres.
- Q5.4 = high level (> 500).
- Q5.5 = low level (< 100).
- Q5.6 = high-level alarm, only if I2.0 (enable) = 1.

**Concepts**: the comparison **replaces** the RLO, so to combine it with a contact it goes inside brackets.

```text
               CMP >I                    Q5.4
 |------------+-------+------------------( )
       MW30 --|IN1    |
       500  --|IN2    |
              +-------+
     I2.0      CMP >I                    Q5.6
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

### E21 — Addition with overflow detection

**Task**: MW44 = MW40 + MW42. M1.0 = this addition overflowed. M1.1 = overflow memory (cleared with I0.0).

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

### E22 — Integer multiplication and division (quotient and remainder)

**Concepts**: `*I` leaves a DINT in ACCU1. `/I` leaves the quotient in ACCU1-L and the remainder in ACCU1-H.

```awl
      L     MW 50
      L     MW 52
      *I
      T     MD 54       // full product (32 bits)
      L     MW 50
      L     MW 52
      /I
      T     MW 58       // quotient
      SRD   16          // brings the remainder (ACCU1-H) to the low part
      T     MW 60       // remainder
```

### Q03 — Does T depend on the RLO?

With I0.0 = 0, what are the values of MW30 and Q4.0?

```awl
      U     E 0.0
      L     5
      T     MW 30
      =     A 4.0
```

<details><summary>Solution</summary>

**MW30 = 5** (T is unconditional) and **Q4.0 = 0** (L and T do not touch the RLO).

</details>

### E23 — Analog scaling to % (REAL)

**Task**: PIW256 (0..27648) → MD100 = 0.0..100.0 %. Q5.7 = alarm above 80 %.

**In Ladder** it is a chain of boxes linked ENO → EN, with intermediate results in memory or temporary data:

```text
 I_DI  (IN = PIW256        → OUT = MD104)
 DI_R  (IN = MD104         → OUT = MD108)
 DIV_R (IN1 = MD108, IN2 = 27648.0 → OUT = MD112)
 MUL_R (IN1 = MD112, IN2 = 100.0   → OUT = MD100)
 CMP >R (IN1 = MD100, IN2 = 80.0)  → coil Q5.7
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

### E25 — REAL → DINT: RND, TRUNC, RND+ and RND−

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

### E26 — Add or subtract depending on a selector (jumps)

**Task**: if I0.0 = 1, MW34 = MW30 + MW32. Otherwise, MW34 = MW30 − MW32.

```text
 Network 1:  I0.0          SUMA
          |---| |-----------(JMP)
 Network 2:  SUB_I (MW30 − MW32 → MW34) and then an unconditional (JMP) to FIN
 Network 3:  LABEL SUMA → ADD_I (MW30 + MW32 → MW34)
 Network 4:  LABEL FIN
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

### E27 — Factorial with LOOP

**Task**: MD100 = MW30! If MW30 ≤ 1, the result is 1.
**Concepts**: `LOOP` decrements ACCU1-L and jumps while it is ≠ 0. You have to **protect the case 0**: otherwise `LOOP` would go from 0 to 65535 and repeat the loop another 65535 times.

```awl
      L     L#1
      T     MD 100      // result = 1
      L     MW 30       // N
      L     1
      <=I               // N <= 1?
      SPB   FIN
      L     MW 30
SIG:  T     MW 32       // loop counter
      L     MD 100
      L     MW 32
      *D
      T     MD 100
      L     MW 32
      LOOP  SIG
FIN:  NOP   0
```

### Q08 — JC not taken

What is the value of Q4.0 at each step? The input keeps changing: first I0.0 = 1, then I0.0 = 0 and then I0.0 = 1.

```awl
      U     E 0.0
      SPB   FIN
      =     A 4.0
FIN:  NOP   0
```

<details><summary>Solution</summary>

- With I0.0 = 1: it jumps and Q4.0 **is not written**, so it stays at 0.
- With I0.0 = 0: **it does not jump, but JC leaves RLO = 1**, so Q4.0 = 1.
- With I0.0 = 1 again: it jumps and Q4.0 **stays at 1**.

</details>

### E29 — Adding up a table with indirect addressing

**Task**: MW40 = sum of the 10 words MW100, MW102, …, MW118.
**Concepts**: area pointer (`P#byte.bit` = byte × 8 + bit), `L MW [MD 30]` and `LOOP` (§7.19 of the reference). It only exists in STL: it has no Ladder representation.

```awl
      L     P#100.0
      T     MD 30       // pointer to the first element (100 × 8 = 800)
      L     0
      T     MW 40       // sum = 0
      L     10          // 10 elements
SIG:  T     MW 34       // loop counter
      L     MW 40
      L     MW [MD 30]
      +I
      T     MW 40
      L     MD 30
      L     P#2.0       // moves on one word (2 bytes = 16)
      +D
      T     MD 30
      L     MW 34
      LOOP  SIG
```

### C01 — Convert to STL

```text
     I0.0              I0.2        Q4.0
 |---| |-----+---------|/|---------( )
 |   I0.1    |
 |---| |-----+
```

<details><summary>Solution</summary>

Two valid solutions: `A( / O I0.0 / O I0.1 / ) / AN I0.2 / = Q4.0` and, taking advantage of the sequential evaluation, the one below.
</details>

```awl
      O     E 0.0
      O     E 0.1
      UN    E 0.2
      =     A 4.0
```

### C04 — Convert to Ladder (comparator and timer)

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

<details><summary>Solution</summary>

```text
     I2.0      CMP >I              T2
 |---| |------+-------+-------+-----------+           Q4.3
 |     MW30 --|IN1    |       | S_ODT     |
 |     100  --|IN2    |       |S         Q|-----------( )
 |            +-------+       |           |
 |                   S5T#3S --|TV         |
 |                            +-----------+
```
(The comparator output goes to the S pin of the timer.)
</details>

### E28 — Traffic light with step bits (GRAFCET style)

**Task**: with switch I0.0 = 1, the traffic light runs a continuous cycle:
- **green** Q4.0 for 5 s,
- **amber** Q4.1 for 2 s,
- **red** Q4.2 for 5 s.

With I0.0 = 0, everything goes off.

**Concepts**: each step is a memory bit (M20.0, M20.1, M20.2). A transition activates the next step with `S` and deactivates the current one with `R`. The outputs are assigned **only once**, at the end.

```awl
// Initial step: start and no step active
      U     E 0.0
      UN    M 20.0
      UN    M 20.1
      UN    M 20.2
      S     M 20.0
// Step 1: green (5 s)
      U     M 20.0
      L     S5T#5S
      SE    T 10
      U     T 10
      S     M 20.1
      R     M 20.0
// Step 2: amber (2 s)
      U     M 20.1
      L     S5T#2S
      SE    T 11
      U     T 11
      S     M 20.2
      R     M 20.1
// Step 3: red (5 s)
      U     M 20.2
      L     S5T#5S
      SE    T 12
      U     T 12
      S     M 20.0
      R     M 20.2
// Stop: clear all the steps
      UN    E 0.0
      R     M 20.0
      R     M 20.1
      R     M 20.2
// Outputs
      U     M 20.0
      =     A 4.0
      U     M 20.1
      =     A 4.1
      U     M 20.2
      =     A 4.2
```

### P01 — Filling a tank with hysteresis

**Task**:
- I0.2 = low-level probe (1 = the water is above the minimum).
- I0.3 = high-level probe (1 = the water reaches the maximum).
- I0.1 = stop (NC).

Pump Q4.0 starts when the level drops below the minimum and stops when it reaches the maximum. Between the two probes it keeps its state. The stop button stops it.

<details><summary>Solution</summary>

Set below the minimum; Reset at the maximum or with the stop button (the Resets come after: stop priority).
</details>

```awl
      UN    E 0.2
      S     A 4.0
      U     E 0.3
      R     A 4.0
      UN    E 0.1
      R     A 4.0
```

### P02 — Staircase light timer

**Task**: a pulse on I0.0 turns on light Q4.0 for 30 s. If it is pressed again while the light is on, the 30 s start again.

<details><summary>Solution</summary>

Extended pulse (SE in English mnemonics, SV in German): it retriggers on every edge.
</details>

```awl
      U     E 0.0
      L     S5T#30S
      SV    T 1
      U     T 1
      =     A 4.0
```

### P03 — Packing: a warning every 5 parts

**Task**: I1.0 = part sensor. When 5 parts have arrived, warning Q5.0 turns on for 2 s and the counter goes back to 0 automatically.

<details><summary>Solution</summary>

Up counter + comparison ≥ 5 that triggers a 2 s extended pulse and resets the counter.
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

### P04 — Star-delta start

**Task**:
- I0.0 = start; I0.1 = stop (NC).
- Q4.0 = line contactor (KM1), Q4.1 = star (KM2), Q4.2 = delta (KM3).

On start, line and star come on. After 5 s, star switches off and delta comes on. Star and delta must **never** be on at the same time (mutual interlock).

<details><summary>Solution</summary>

Line with latching; 5 s on-delay; star = line ∧ ¬T1 ∧ ¬delta; delta = line ∧ T1 ∧ ¬star.
</details>

```awl
// Line (latching)
      U(
      O     E 0.0
      O     A 4.0
      )
      U     E 0.1
      =     A 4.0
// Star time
      U     A 4.0
      L     S5T#5S
      SE    T 1
// Star
      U     A 4.0
      UN    T 1
      UN    A 4.2
      =     A 4.1
// Delta
      U     A 4.0
      U     T 1
      UN    A 4.1
      =     A 4.2
```
