# Website-only theory

> English translation of `web/teoria/es/extra.md`: the sections of the website that are not in the app's «Aprender» (introduction to PLCs, sequences with GRAFCET, solved exercises and the step-by-step guides to Ladder and STL).
> - Keep the same codes (I.1, S.1, P.1, K.1, A.1…): `web/teoria/paginas.ts` uses them.
> - Code blocks (```awl) keep the German mnemonics, like the app; the generator converts them to English. Inline code is already in English.

---

### I.1 What is a PLC?

A **PLC** (programmable logic controller) is a computer designed to control industrial machines and installations. It does the same thing over and over, without stopping:

1. **It reads the inputs**: push buttons, switches, limit switches, presence sensors, level or temperature probes.
2. **It runs the program**: it decides what to do depending on the state of the inputs, the time that has passed and what it remembers (bit memory, timers and counters).
3. **It writes the outputs**: it starts motors through contactors, opens valves, turns on lamps or moves cylinders.

This repetition is called the **scan cycle**, and it usually takes a few milliseconds (§1.1).

Before PLCs, the logic of a machine was built by **wiring relays**: to change how it worked, the control cabinet had to be rewired. With a PLC, the wiring of the inputs and outputs stays the same and what changes is the **program**.

### I.2 Parts of a PLC

| Part | What it is for |
|---|---|
| **Power supply** | Converts the mains voltage into the 24 V DC used by the CPU and the modules |
| **CPU** | Runs the program and stores the data: process image, bit memory, timers, counters and data blocks (§2.1) |
| **Digital inputs** | Read on/off signals (0 or 1), usually at 24 V |
| **Digital outputs** | Drive contactors, solenoid valves or lamps, through a transistor or a relay |
| **Analog inputs and outputs** | Read or generate continuous values, such as 0..10 V or 4..20 mA, which the CPU sees as numbers from 0 to 27648 (§2.3) |
| **Communication** | Connects to the programming computer, to touch panels (HMI) and to other PLCs |

In **compact PLCs** everything comes in one box: the CPU with its onboard inputs and outputs. In **modular** PLCs, each part is a module mounted on a rack next to the CPU, and you add the ones you need.

### I.3 PLCs, relays and microcontrollers

| | Hard-wired logic (relays) | PLC | Microcontroller (for example, Arduino) |
|---|---|---|---|
| Changing how it works | Rewiring | Changing the program | Changing the program |
| Environment | Industrial | Industrial: withstands electrical noise, vibration and temperature | Lab, prototypes and learning |
| Inputs and outputs | Contacts and coils | 24 V, standard modules | 3.3 or 5 V: they need adapting for industry |
| Languages | — | Standardized (IEC 61131-3): Ladder, FBD, STL, structured text, GRAFCET | C or C++ |
| Execution | Immediate | Cyclic and predictable (scan cycle) | Whatever you program |

A microcontroller is good for learning electronics and for prototypes. An industrial machine uses a PLC because it is built for that environment, any maintenance technician understands it, and it can be replaced and repaired for many years.

### I.4 PLC programming languages

The **IEC 61131-3** standard defines the programming languages of PLCs. The German names (KOP, FUP, AWL) are also very common in training:

| Language | Also called | What it looks like | What it is good for |
|---|---|---|---|
| **Ladder** | LAD, LD (KOP in German) | Graphical, like an electrical diagram of contacts and coils | Bit logic, latching and timers. Electricians understand it straight away |
| **Function block diagram** | FBD (FUP in German) | Graphical, with AND, OR and flip-flop boxes… as in digital electronics | The same logic as Ladder, drawn with logic gates |
| **Statement List** | STL, IL (AWL in German) | Text, one instruction per line, very close to how the CPU works | Understanding the CPU from the inside, existing programs, exams |
| **Structured text** | ST | Text similar to Pascal, with `IF`, `FOR` and formulas | Calculations, loops and data handling |
| **GRAFCET** | Sequential function chart (SFC) | Graphical, with steps and transitions | Step sequences (§S.1) |

The same program can be written in Ladder or in STL: the editor translates each Ladder network into STL (§8.1). Not all STL has a Ladder drawing, but all Ladder has its STL.

### I.5 Which language should you learn?

- **Start with Ladder.** It reads like an electrical diagram and teaches the essentials: contacts, coils, latching, edges, timers and counters.
- **Learn STL to understand the CPU.** With STL you see the RLO, the accumulators and the order in which each instruction runs, and you understand why a program does what it does. The 2013 edition of IEC 61131-3 marked it as deprecated and it is used less and less in new equipment, but it is still in a huge number of machines in operation and in vocational and engineering exams.
- **Then structured text (ST)**, for calculations and data handling, and **GRAFCET** for sequences.

---

### S.1 What a sequence is

Many machines work **in steps**: a traffic light goes from green to amber to red, a press goes down, waits and goes up, a washing machine fills, washes, drains and spins. Each step lasts until a condition is met (a time, a sensor, a push button), and then the next one starts.

Programming a sequence with loose contacts quickly gets complicated. It is much clearer to **draw it first as a GRAFCET** and then translate it into Ladder or STL with a fixed method.

### S.2 GRAFCET: steps and transitions

A **GRAFCET** is a diagram of steps and transitions:

- **Step**: a state of the machine. It is drawn as a numbered square. The **initial step**, the one that is active at startup, is drawn as a double square.
- **Action**: what is done while the step is active (turning on an output, starting a timer). It is written in a rectangle to the right of the step.
- **Transition**: the condition for moving from one step to the next. It is drawn as a horizontal bar between the two steps, with its condition next to it.

**Evolution rules**:

1. A transition **fires** when the previous step is active **and** its condition is met.
2. When it fires, the next step is **activated** and the previous one is **deactivated**.
3. Several transitions that can fire at the same time fire at the same time.

<!-- figura -->

### S.3 From GRAFCET to Ladder and STL with step bits

The most common method assigns **one memory bit to each step** (for example, M20.0, M20.1, M20.2…), which is 1 while the step is active. Each transition is programmed with **Set and Reset**:

```awl
// Transition from step 1 (M20.0) to step 2 (M20.1)
      U     M 20.0          // step 1 is active
      U     T 10            // and the condition is met: the 5 s have elapsed
      S     M 20.1          // activates step 2
      R     M 20.0          // deactivates step 1
```

In Ladder it is the same: a contact of the step, in series with the condition, and two coils in parallel, `(S)` on the next step and `(R)` on the current one.

The complete program always has the same structure:

1. **Initial step**: it is activated at startup, in OB100, or when no step is active.
2. **Transitions**: one network per transition, with its Set and its Reset.
3. **Stop**: if needed, a network that resets all the steps.
4. **Outputs (actions)**: at the end, each output is assigned **only once** from the step bits. If an output acts in several steps, they are combined with OR: `O M 20.1 / O M 20.3 / = Q 4.0`.

The outputs go at the end because of **double assignment** (§1.2): if the same output were assigned in several steps, only the last assignment would count.

**Timers in the steps**: the timer is started by the step bit itself (`A M 20.0 / L S5T#5S / SD T 10`) and its output is the condition of the transition (`A T 10`). When the step is deactivated, the timer stops by itself.

### S.4 Tips

- **Check that only one step is active** in a linear sequence. If two step bits turn on at the same time in the simulator, a Reset is missing.
- **Watch out for cascading.** If the condition of the next transition is already met, the sequence can move forward two steps in the same cycle, because the program runs from top to bottom. To avoid it, program the transitions in reverse order (from the last to the first), or first calculate all the transitions in auxiliary bits and then apply the Sets and Resets.
- **Use a range of memory bits only for the steps**, for example M20.0..M29.7, and a different timer for each step that needs one.

---

### P.1 How to use these exercises

These are typical class and exam exercises, solved and checked with automatic tests in the simulator. For each one:

1. Read the task and try to solve it before looking at anything. If you get stuck, open the **hint** under «Solution».
2. Compare your program with the solution in Ladder and in STL.
3. Try it in the panel: operate the inputs and check that the outputs do what the task asks.

The exercises use push buttons and sensors with absolute addresses. Stop buttons are wired **NC**, so they start at 1 (§1.3).

---

### K.1 How to read a Ladder diagram

A Ladder program is drawn like an **electrical diagram of contacts and coils**, and it is read the same way:

- The program is divided into **networks**. Each network is one "line" of the diagram, with its logic and its output.
- On the left is the **power rail**: the "power" comes from it.
- The power flows **from left to right** through the **contacts**. Each contact lets the power through or cuts it, depending on the value of a bit (an input, an output, a memory bit…).
- On the right is the **coil**: if power reaches it, it writes a 1 to its bit; if not, it writes a 0.

That "power" is not real electricity: it is the **logic result** that the CPU calculates when it runs the network, a 1 or a 0. In STL it is called the **RLO** (§7.3). In the simulator, the part that carries power is shown in **solid green** and the part that does not, in **dashed blue**.

Try it: switch on input I 0.0 and watch the power go through the contact and reach the coil, which turns on output Q 4.0.

<!-- probar: na -->

### K.2 Normally open (NO) contact

The NO contact `--| |--` **asks: "is this bit 1?"**

| Bit of the contact | Does it conduct? |
|---|---|
| 0 | No: it cuts the power |
| 1 | Yes: it lets the power through |

It works like a normally open push button: when the bit is 1, it "closes" the circuit. It is the most widely used contact: it reads push buttons, sensors, memory bits and also outputs. In STL it is the `A` instruction (§A.2).

### K.3 Normally closed (NC) contact

The NC contact `--|/|--` **asks: "is this bit 0?"**. It is the NO contact the other way round:

| Bit of the contact | Does it conduct? |
|---|---|
| 0 | Yes: it lets the power through |
| 1 | No: it cuts the power |

Try it: with I 0.0 at 0 the lamp is on. When you switch on I 0.0, the contact opens and the lamp goes off.

<!-- probar: nc -->

In STL it is `AN` (§A.3).

> **Do not confuse the program contact with the real push button.** The program contact only asks for the value of the bit; it does not know how the push button is wired. A stop button is wired NC (it gives 1 at rest) and in the program it is checked with an **NO** contact (§1.3).

### K.4 Contacts in series: the AND function

When you place contacts **one after another**, power only reaches the coil if **all of them conduct**. This is the **AND** function:

| I 0.0 | I 0.1 | Q 4.0 |
|---|---|---|
| 0 | 0 | 0 |
| 0 | 1 | 0 |
| 1 | 0 | 0 |
| 1 | 1 | **1** |

Try it: Q 4.0 only turns on with both inputs switched on.

<!-- probar: y -->

You can mix NO and NC contacts in series. For example, "start **and no** alarm" is an NO contact for start in series with an NC contact for the alarm:

<!-- probar: y-no -->

### K.5 Contacts in parallel: the OR function

When you place contacts in **parallel branches**, power reaches the coil if **at least one** branch conducts. This is the **OR** function:

| I 0.0 | I 0.1 | Q 4.0 |
|---|---|---|
| 0 | 0 | 0 |
| 0 | 1 | **1** |
| 1 | 0 | **1** |
| 1 | 1 | **1** |

It is used, for example, to switch on a light from two different push buttons. Try it:

<!-- probar: o -->

A parallel branch can also have an NC contact: here Q 4.0 turns on if I 0.0 is 1 **or** if I 0.1 is 0.

<!-- probar: o-no -->

### K.6 Combining series and parallel

Real diagrams mix both, and they are read just like an electrical circuit: the power has to **go through one of the parallel branches and then through the contacts in series**.

In this example, Q 4.0 = (I 0.0 **or** I 0.1) **and** I 0.2. Try it: switch on I 0.2 and then one of the other two.

<!-- probar: combinado -->

Almost every control circuit is built like this. For example, a start/stop circuit with latching is "(start **or** the motor itself) **and** stop" (§6.4). To turn a combination like this into STL you use brackets or `O` without an operand (§7.4 and §8.2).

### K.7 Coils, Set, Reset and NOT

The elements on the right of the network **write** the result:

- **Coil `( )`**: it always writes the result: 1 if power reaches it, 0 if not. Each operand should have **only one coil** in the whole program; if it has two, only the last one counts (§1.2).
- **Several coils in parallel** at the end of a network receive the same power: they all have the same value.
- **Set `(S)`** and **Reset `(R)`**: if power reaches them, they set the bit to 1 or to 0; if not, **they do nothing** and the bit keeps its value. They are used to "remember" (§6.4).
- **NOT `--|NOT|--`**: it inverts the power. What comes in as 1 goes out as 0, and the other way round.

Try it: with I 0.0, the two coils of the first network turn on together; the one in the second network does the opposite, because of the NOT.

<!-- probar: bobinas -->

---

### A.1 How to read an STL program

In STL the program is written **as text**, one instruction per line. Each line has an **operation** and, almost always, an **operand**:

| Line | Operation | Operand | Read as |
|---|---|---|---|
| `A I 0.0` | `A` (AND) | `I 0.0` | "and input 0.0" |
| `AN I 0.1` | `AN` (AND NOT) | `I 0.1` | "and not input 0.1" |
| `= Q 4.0` | `=` (assign) | `Q 4.0` | "the result, to output 4.0" |

These are the English (international) mnemonics. In the German mnemonics, `A` is written `U`, `AN` is `UN`, and the inputs and outputs are `E` and `A` (§11).

The CPU runs the lines **from top to bottom**. The logic instructions keep calculating a result, the **RLO** (result of logic operation), which is the same as the "power" in Ladder: each instruction combines the RLO with its operand, and at the end `=` writes it to an output.

Example, line by line, with I 0.0 = 1 and I 0.1 = 0:

| Instruction | What it does | RLO after |
|---|---|---|
| `A I 0.0` | First instruction of the chain: copies I 0.0 | 1 |
| `A I 0.1` | 1 AND 0 | 0 |
| `= Q 4.0` | Writes the RLO to Q 4.0 | Q 4.0 = 0 |

The **first** logic instruction after an assignment does not combine anything: it **copies** its operand into the RLO. This is the "first check" (§7.3).

### A.2 A: AND

`A` (German `U`) means **"and also this bit is 1"**. It combines the RLO with the operand using an **AND**: the result only stays at 1 if the operand is 1.

- In Ladder it is an **NO contact in series**.
- Several `A` in a row: the result is 1 only if **all of them** are met.

<!-- probar: y -->

### A.3 AN: AND NOT

`AN` (German `UN`) means **"and also this bit is 0"**. It is an AND with the operand inverted: RLO := RLO ∧ ¬operand.

- In Ladder it is an **NC contact in series**.
- It is how you write conditions such as "start **and no** alarm":

<!-- probar: y-no -->

### A.4 O: OR

`O` means **"or this bit is 1"**. It combines the RLO with the operand using an **OR**: the result is 1 if any of the conditions is met.

- In Ladder it is an **NO contact in parallel**.
- For a parallel group of single contacts, `O` is also written on the first line (`O I 0.0 / O I 0.1`), although `A I 0.0 / O I 0.1` would give the same result: the first instruction only copies the operand.

<!-- probar: o -->

### A.5 ON: OR NOT

`ON` means **"or this bit is 0"**: RLO := RLO ∨ ¬operand. In Ladder it is an **NC contact in parallel**.

<!-- probar: o-no -->

### A.6 X and XN: exclusive OR

`X` is the **exclusive OR**: the result is 1 if **only one** of the two is 1, and 0 if they are equal. `XN` is the opposite: 1 when both are equal.

| I 0.0 | I 0.1 | `X I 0.0 / X I 0.1` | `X I 0.0 / XN I 0.1` |
|---|---|---|---|
| 0 | 0 | 0 | 1 |
| 0 | 1 | 1 | 0 |
| 1 | 0 | 1 | 0 |
| 1 | 1 | 0 | 1 |

A typical use is the **two-way light switch** of a corridor: two switches, one at each end, and either of them changes the state of the light. Ladder has no exclusive OR contact: it is drawn with two branches (§6.3), as in this diagram.

<!-- probar: xor -->

### A.7 =, S and R: writing the result

Once the logic has been calculated, the RLO has to be written somewhere:

| Instruction | What it does | In Ladder |
|---|---|---|
| `= Q 4.0` | Q 4.0 := RLO, always (1 or 0) | Coil `( )` |
| `S Q 4.0` | If RLO = 1, Q 4.0 := 1. If RLO = 0, it does nothing | Coil `(S)` |
| `R Q 4.0` | If RLO = 1, Q 4.0 := 0. If RLO = 0, it does nothing | Coil `(R)` |

- After `=`, `S` or `R`, the chain is closed: the next `A` or `O` starts new logic.
- You can write several `=` in a row to assign the same result to several outputs.
- With `S` and `R` the bit "remembers" its value. Try it: a pulse on I 0.0 turns on Q 4.0, which stays on when I 0.0 is released, until I 0.1 turns it off.

<!-- probar: set-reset -->

### A.8 NOT, SET and CLR

These three instructions have no operand and act **directly on the RLO**:

| Instruction | What it does | Example of use |
|---|---|---|
| `NOT` | Inverts the RLO | `A I 0.0 / A I 0.1 / NOT / = Q 4.0` is a NAND |
| `SET` | Sets the RLO to 1 | Writing a fixed 1: `SET / = M 0.0` |
| `CLR` | Sets the RLO to 0 | Writing a fixed 0: `CLR / = M 0.0` |

> **Careful with `SET`**: it does not set any operand to 1, only the RLO. To set a bit, use `S`.
