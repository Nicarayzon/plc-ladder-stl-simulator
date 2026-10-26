# Ladder (LAD) and Statement List (STL) reference

> English translation of `src/content/referencia_KOP_AWL.md` for the website (`npm run web:teoria`).
> - Keep the same section numbers: the pages are built from them (`web/teoria/paginas.ts`).
> - Code blocks (```awl) keep the German mnemonics, like the app; the generator converts them to English. Inline code is already in English.
> - Chapters 9 and 10 of the original are not used on the website.

---

## 1. How the PLC works

### 1.1 The scan cycle

The CPU runs the program cyclically. In each cycle:

1. **It reads the inputs.** It copies the state of the physical inputs into the **process image of inputs (PII)**.
2. **It executes the program.** It runs **OB1** and all the blocks it calls (FC, FB...), instruction by instruction and from top to bottom.
3. **It writes the outputs.** It copies the **process image of outputs (PIQ)** to the physical outputs.
4. **Internal tasks.** It handles communication (programming device, HMI) and self-diagnostics, and goes back to step 1.

```text
   ┌────────────┐   ┌───────────────────┐   ┌─────────────┐   ┌──────────────┐
──►│ Read PII   │──►│ Execute OB1       │──►│ Write PIQ   │──►│ Comms and    │──┐
   │ (inputs)   │   │ (user program)    │   │ (outputs)   │   │ diagnostics  │  │
   └────────────┘   └───────────────────┘   └─────────────┘   └──────────────┘  │
        ▲                                                                       │
        └───────────────────────────────────────────────────────────────────────┘
```

The cycle time is monitored. The default limit is **150 ms** and it is set in the CPU properties. If it is exceeded, OB80 is called, and if OB80 does not exist the CPU goes to STOP. An endless loop (for example, a backward jump that never ends) causes exactly that.

Timers run **asynchronously** to the program: they are updated by the operating system, not by the cycle.

### 1.2 Practical consequences (often asked)

| Fact | Consequence |
|---|---|
| The PII is read once at the start of the cycle | An input has the same value for the whole cycle, even if it changes physically halfway through |
| The PIQ is written at the end | If the same output is assigned twice, **only the last assignment counts** (double assignment) |
| The program runs in order | What one network calculates is seen by **the following networks in the same cycle**. The previous ones do not see it until the **next cycle** |
| Outputs can be read | `A Q 4.0` reads the PIQ, that is, the last value written by the program. This is how latching works |
| Direct peripheral access (`PIW`, `PQW`) | It bypasses the process image: it reads or writes the module at that very moment |

### 1.3 Safety wiring: physical contact ≠ program contact

- A **program contact** only **checks** the state of a bit: whether it is 1 or 0. It does not know how the push button is wired.
- **Stop** buttons, emergency stops and safety limit switches are wired **normally closed (NC)**. At rest the input is 1. If the wire breaks, the input drops to 0 and the machine stops (fail-safe).
- That is why **an NC stop button is programmed with an NO contact** (`A I 0.1`): the motor can run while the input is 1.

| Physical push button | Input state at rest | Program contact for "run while NOT pressed" |
|---|---|---|
| Start, NO | 0 | — (an NO contact `A` is used for "if pressed") |
| Stop, **NC** | **1** | **NO** (`A I 0.1`) |
| Stop, NO (not recommended) | 0 | NC (`AN I 0.1`) |

### 1.4 CPU modes and startup

- **Modes**: RUN, RUN-P (RUN with programming), STOP and MRES (memory reset). They are selected with the CPU mode selector.
- **Status LEDs**:
  - SF: system fault.
  - BF: bus fault.
  - DC5V: power supply.
  - FRCE: force active.
  - RUN and STOP: current mode.
- **Startup (complete restart / warm restart)**: **OB100** runs once and then the OB1 cycle starts. In this startup:
  - **Non-retentive** bit memory, timers and counters are reset to 0.
  - The PIQ is reset to 0.
  - **Retentive** data keep their value.

---

## 2. Memory areas (operands)

### 2.1 Overview

| Area | German | English | Contents | Access from the program | Possible accesses |
|---|---|---|---|---|---|
| Inputs | E | **I** | Process image of inputs (PII) | Read. It can also be written, but it is overwritten in the next cycle | `I`, `IB`, `IW`, `ID` |
| Outputs | A | **Q** | Process image of outputs (PIQ) | Read and write | `Q`, `QB`, `QW`, `QD` |
| Bit memory | M | **M** | General-purpose internal memory | Read and write | `M`, `MB`, `MW`, `MD` |
| Timers | T | **T** | Timers (for example, T0..T255) | Timer instructions | `T n` |
| Counters | Z | **C** | Counters (0..999) | Counter instructions | `C n` |
| Data blocks | DB / DI | **DB / DI** | Global data (DB) or instance data (DI) | Read and write | `DBX`, `DBB`, `DBW`, `DBD` / `DIX`... |
| Local data | L | **L** | Temporary variables of the running block | Read and write | `L`, `LB`, `LW`, `LD` |
| Peripheral I/O | PE / PA | **PI / PQ** | Direct access to the modules, without the process image | Read (PI) and write (PQ) | `PIB`, `PIW`, `PID`, `PQB`, `PQW`, `PQD` (**no bit access**) |

### 2.2 Bit, byte, word and double word

| Format | Size | Example | Meaning of the example |
|---|---|---|---|
| Bit | 1 bit | `I 0.3` | Input, byte 0, bit 3 (bits 0 to 7) |
| Byte (B) | 8 bits | `MB 10` | Memory byte 10 |
| Word (W) | 16 bits | `MW 10` | Bytes MB10 and MB11 |
| Double word (D) | 32 bits | `MD 10` | Bytes MB10, MB11, MB12 and MB13 |

**Byte order (big-endian)**: the byte with the **lowest address is the most significant one**.

```text
                     MD 10
 ┌──────────────────────────────────────────────┐
 │        MW 10          │        MW 12         │
 ├───────────┬───────────┼───────────┬──────────┤
 │   MB 10   │   MB 11   │   MB 12   │  MB 13   │
 │ (bits 31…24)│(bits 23…16)│(bits 15…8)│(bits 7…0)│   ← position within MD10
 └───────────┴───────────┴───────────┴──────────┘
   MW10 = MB10·256 + MB11        (MB10 is the HIGH byte of MW10)
```

Position of each bit within a word, for example `IW 0`:

| Bit of `IW 0` | 15 | 14 | … | 8 | 7 | … | 0 |
|---|---|---|---|---|---|---|---|
| Physical bit | I0.7 | I0.6 | … | **I0.0** | I1.7 | … | **I1.0** |

> **Classic trap**: if only `I 0.0` = 1, then `IW 0` = 256 (W#16#0100), not 1. If only `I 1.0` = 1, `IW 0` = 1.

**Overlaps**: `MW 10` and `MW 11` share the byte `MB 11`. To avoid overwriting data, words are used in steps of 2 (`MW10`, `MW12`...) and double words in steps of 4 (`MD20`, `MD24`...).

### 2.3 I/O addresses

- **Slot-based addressing (default)**: in rack 0, slot 1 is the power supply, slot 2 the CPU, slot 3 the interface module (IM) and slots 4 to 11 the signal modules.
  - **Digital** modules: start byte = (slot − 4) × 4. For example, slot 4 occupies I0.0..I3.7 and slot 5 starts at byte 4.
  - **Analog** modules: start address = 256 + (slot − 4) × 16. For example, slot 4 occupies PIW256..PIW270.
- **Compact CPUs** (very common in training kits): the onboard I/O is usually at I124.0..I126.7 and Q124.0..Q125.7, and the analog channels at PIW752.. / PQW752... Always check it in the **hardware configuration**, because it can be changed.
- **Analog values**: the nominal range is **0..27648**, which corresponds for example to 0..10 V or 4..20 mA. Above 27648 is the overrange (up to 32511). The value **32767** indicates overflow or a broken wire.

### 2.4 Bit memory (M)

Bit memory is the programmer's "bit RAM". It is used for:

- **Auxiliary bits**: intermediate results used in several places.
- **Step bits**: in sequences and GRAFCET, each step is a memory bit that is set with S and reset with R.
- **Edge memory bits**: the memory that `FP` and `FN` need. **A different bit for each edge, and it is not reused for anything else.**
- **Numeric values**: `MW` for INT, `MD` for DINT or REAL.

**Retentive bit memory**: keeps its value after a power failure or a STOP→RUN transition. It is configured in *CPU properties → Retentivity*. In many CPUs the default is **MB0..MB15**.

**Clock memory**: a memory byte whose bits change by themselves, each at a fixed frequency. It is used to make lamps flash without timers (§2.6).

### 2.5 Local data (L) and data blocks (DB)

- **L (temporary data)**: they only exist while the block is running. **When the block starts, their value is undefined**, so they must be written before they are read. In OB1, the first 20 bytes (LB0..LB19) contain the start information of the OB, so the user's temporary data start at LB20.
- **Global DBs**: they are accessed with the full address (`DB1.DBW 0`) or by opening the DB first (`OPN DB 1`) and then using `DBW 0`, `DBX 2.0`, etc.
- **Instance DB (DI)**: the memory of each call of an FB. Its parameters and static variables (STAT) are stored there.

### 2.6 Clock memory

**Clock memory** is a memory byte written by the CPU itself: each of its 8 bits oscillates at a fixed frequency and spends half of the period at 0 and the other half at 1. It is used to make lamps flash and to repeat an action at regular intervals without programming timers.

**How to enable it**:
- On the real CPU: *CPU properties → Cycle/Clock memory*. Tick the box, choose the byte (for example, MB100) and download the hardware configuration.
- In the simulator: **Hardware** button → CPU → *Ciclo / marca de ciclo* (the interface is in Spanish). It uses MB0 by default, but any byte can be chosen.

| Bit | 7 | 6 | 5 | 4 | 3 | 2 | 1 | 0 |
|---|---|---|---|---|---|---|---|---|
| Period (s) | 2.0 | 1.6 | 1.0 | 0.8 | 0.5 | 0.4 | 0.2 | 0.1 |
| Frequency (Hz) | 0.5 | 0.625 | 1 | 1.25 | 2 | 2.5 | 5 | 10 |

<!-- cronograma -->

With MB100 as clock memory, `M 100.5` has a period of 1 s: 0.5 s at 0 and 0.5 s at 1. In other words, it flashes at 1 Hz.

**Typical uses**:
- **Flashing lamp**: the clock memory goes in series with the condition. `A I 0.0 / A M 100.5 / = Q 4.0` makes Q4.0 flash at 1 Hz while I0.0 = 1.
- **Two rhythms with the same lamp**: slow with `M 100.7` (0.5 Hz) for a warning and fast with `M 100.3` (2 Hz) for an alarm.
- **Periodic action**: `M 100.5` gives one rising edge per second. With a counter (`CU`) you can count seconds, and with `FP` you can do something once per second.

**Watch out**:
- **The program must only read that byte.** The CPU overwrites it every cycle, so anything the program writes to it is lost. The simulator warns you if the program writes to it.
- The byte must stay free: do not use it for anything else, not even inside a word (`MW 99` and `MW 100` include `MB 100`).
- It is not suitable for accurate timing: when the condition becomes true, the bit may be halfway through its period, so the first flash can be shorter. For exact delays, use timers (§6.6).
- In the simulator, the byte is updated at the start of each cycle, before the inputs are read. If the clock memory is disabled or the byte is changed, the old byte is set to 0.

---

## 3. Data types and constants

### 3.1 Simple types

| Type | Bits | Range | Example constant (STL) |
|---|---|---|---|
| BOOL | 1 | 0 / 1 | (bits are not loaded with `L`) |
| BYTE | 8 | 0..255 | `B#16#1F` |
| WORD | 16 | 0..FFFF | `W#16#00FF`, `2#0000000011111111`, `C#123` (BCD), `B#(1,2)` |
| DWORD | 32 | 0..FFFF FFFF | `DW#16#00010000`, `B#(1,2,3,4)` |
| CHAR | 8 | ASCII character | `'A'` |
| INT | 16 | −32768..32767 | `123`, `-5` |
| DINT | 32 | −2147483648..2147483647 | `L#100000`, `L#-1` |
| REAL | 32 | ±1.175495e−38..±3.402823e+38 (IEEE 754) | `1.5`, `2.764800e+004` |
| S5TIME | 16 | 0 ms..2 h 46 min 30 s | `S5T#5S`, `S5T#1M30S`, `S5T#500MS` |
| TIME | 32 | ±24 days 20 h 31 min 23 s 647 ms (in ms) | `T#1M30S`, `T#500MS` |
| DATE | 16 | 1990-01-01..2168-12-31 (days since 1990) | `D#2026-10-13` |
| TIME_OF_DAY | 32 | 0:00:00.000..23:59:59.999 (ms since midnight) | `TOD#12:30:00.000` |

- **Compound types**: DATE_AND_TIME (8 bytes in BCD), STRING[n] (n+2 bytes), ARRAY, STRUCT and UDT.
- **Parameter types**: TIMER, COUNTER, BLOCK_FC, BLOCK_FB, BLOCK_DB, POINTER (6 bytes) and ANY (10 bytes).

### 3.2 BCD (binary-coded decimal)

In BCD each group of 4 bits (nibble) is a decimal digit from 0 to 9. For example, `W#16#0123` in BCD is **123**. BCD is used by thumbwheel switches, displays and time (S5TIME) and count values.

- **Word BCD (3 digits with sign)**: bits 11..0 are the three digits and bits 15..12 the sign (`0000` positive, `1111` negative). Range ±999.
- **Double word BCD (7 digits with sign)**: range ±9 999 999.
- A digit from A to F **is not valid BCD**. For example, `BTI` on `W#16#00A1` causes a **BCD conversion error** (OB121), and if OB121 does not exist the CPU goes to STOP.

### 3.3 Internal format of S5TIME

```text
 bit  15 14 | 13 12 | 11 … 8 | 7 … 4 | 3 … 0
      x  x  | base  | hundreds| tens   | units      (value 0..999 in BCD)
```

| Time base (bits 13–12) | Resolution | Range |
|---|---|---|
| 00 | 10 ms | 10 ms – 9 s 990 ms |
| 01 | 100 ms | 100 ms – 1 min 39 s 900 ms |
| 10 | 1 s | 1 s – 16 min 39 s |
| 11 | 10 s | 10 s – 2 h 46 min 30 s |

The editor automatically chooses the finest time base in which the value fits:

- `S5T#5S` = 500 × 10 ms → **W#16#0500**
- `S5T#12S` = 120 × 100 ms → **W#16#1120**
- `S5T#2M` = 120 × 1 s → **W#16#2120**

> **Trap**: `L 500` is **not** 5 seconds. 500 in binary is W#16#01F4, which contains the digit F, so it is not valid BCD and causes an error. You have to write `L S5T#5S` or `L W#16#0500`.

### 3.4 REAL

REAL values follow the 32-bit IEEE 754 standard. Keep two things in mind:

- To operate on integers together with REALs you have to convert them first: **INT → DINT → REAL** (`ITD` and then `DTR`).
- It is not a good idea to compare two REALs with `==R`: it is better to compare with a margin.

---

## 4. Symbolic addressing

- The **symbol table** gives each operand a name, a data type and a comment. For example: `"Start"` → I 0.0, BOOL, "NO start push button".
- In the code, global symbols go **in double quotes** (`A "Start"`) and the block's local variables are prefixed with **#** (`A #Stop`).
- In the editor: *View → Symbolic representation* and *View → Display → Symbol information*.

---

## 5. Program structure (blocks)

### 5.1 Block types

| Block | What it is | Own memory |
|---|---|---|
| **OB** | Organization block. It is called by the operating system: cycle, startup, interrupts or errors | Temporary data (L) |
| **FC** | Function. Code with parameters | No: temporary data only |
| **FB** | Function block. Code with parameters **and memory** | Yes: an **instance DB** for each call |
| **DB** | Data block (global or instance) | It is data, always retentive |
| **SFC / SFB** | System functions and system function blocks built into the CPU | — |
| **UDT** | User-defined data type | — |

### 5.2 Important OBs

| OB | When it runs |
|---|---|
| OB1 | Cyclically (main program) |
| OB10 | Time-of-day interrupt (date and time) |
| OB20 | Time-delay interrupt |
| OB35 | Cyclic interrupt (every 100 ms by default) |
| OB40 | Hardware interrupt (edge on a module with interrupts) |
| OB80 | Time error (cycle time exceeded) |
| OB82 | Diagnostic interrupt from a module |
| OB85 / OB86 / OB87 | Program execution error / failure of a rack or distributed I/O / communication error |
| OB100 | Startup (complete restart) |
| OB121 | Programming error (for example invalid BCD, block that does not exist) |
| OB122 | I/O access error |

> If an error occurs and the corresponding error OB **is not loaded**, the CPU goes to **STOP**.

### 5.3 Variable declaration of a block

| Section | FC | FB | What it is for |
|---|---|---|---|
| IN | ✓ | ✓ | Input parameters |
| OUT | ✓ | ✓ | Output parameters |
| IN_OUT | ✓ | ✓ | Parameters that are read and written |
| STAT | — | ✓ | Static variables: they are stored in the instance DB and keep their value between calls |
| TEMP | ✓ | ✓ | Temporary data: undefined when the block starts |

### 5.4 Calls

```text
// FC with parameters (STL)
      CALL  FC     1
       Start:=I0.0
       Stop :=I0.1
       Motor:=Q4.0

// FB with its instance DB
      CALL  FB     1 , DB     1
       Input :=I0.2
       Output:=Q4.1

// FC without parameters
      UC    FC     2              // unconditional call
      A     I      0.3
      CC    FC     3              // conditional call: only if RLO = 1
```

What a generic FC looks like in an **STL source** (a text file with the blocks; instructions end with `;`):

```text
FUNCTION FC 1 : VOID
TITLE = Generic start/stop
VAR_INPUT
  Start : BOOL ;
  Stop : BOOL ;
END_VAR
VAR_IN_OUT
  Motor : BOOL ;
END_VAR
BEGIN
NETWORK
TITLE = Latching
      A(    ;
      O     #Start;
      O     #Motor;
      )     ;
      A     #Stop;
      =     #Motor;
END_FUNCTION
```

In Ladder a call is a **box** with EN/ENO and the parameters as pins.

---

## 6. Ladder (LAD) — ladder logic

### 6.1 Concepts and rules

- **Network**: the program unit. Each network has a title, a comment and its circuit.
- **Power rail**: on the left. "Power" flows from left to right.
- **Contact**: **checks** the state of a bit.
  - NO `--| |--` conducts if the bit is 1.
  - NC `--|/|--` conducts if the bit is 0.
- **Series** = AND. **Parallel** = OR.
- **Coil**: **writes** the result of the logic on its left (the RLO) to a bit.
- **Box**: a function with an enable input **EN** and an output **ENO**. ENO = 1 if EN = 1 and the operation finished without errors.

**Construction rules**:

- Output elements (coils and final boxes) go on the right. **Several coils in parallel** can be placed at the end of a network.
- The `--(#)--` connector and some boxes can go in the middle of a branch.
- Power cannot flow from right to left, and branches cannot be left open.
- A jump label (`LABEL`) always goes **at the start of a network**.
- If a network written in STL has no graphical representation, it stays in STL when the view is switched.

**Online monitoring**: power flow is shown in **solid green** and the absence of flow in **dashed blue**.

### 6.2 Bit logic operations

| Ladder symbol | Name | Function | STL |
|---|---|---|---|
| `--\| \|--` | NO contact | Conducts if the operand = 1 | `A op` |
| `--\|/\|--` | NC contact | Conducts if the operand = 0 | `AN op` |
| `--\|NOT\|--` | Invert | Inverts the power flow (RLO) | `NOT` |
| `--( )` | Coil | Operand := RLO | `= op` |
| `--(#)--` | Connector | Stores the intermediate RLO in a bit and carries on | `= op` (in the middle) |
| `--(S)` | Set | If RLO = 1 → operand := 1 | `S op` |
| `--(R)` | Reset | If RLO = 1 → operand := 0 | `R op` |
| `SR` box | Flip-flop with **reset priority** | S sets, R resets; if both = 1, R wins | `A s / S op / A r / R op` |
| `RS` box | Flip-flop with **set priority** | If both = 1, S wins | `A r / R op / A s / S op` |
| `--(P)--` | Rising edge of the RLO | 1 for **one cycle** when the RLO changes from 0 to 1 | `FP bit` |
| `--(N)--` | Falling edge of the RLO | 1 for one cycle when the RLO changes from 1 to 0 | `FN bit` |
| `POS` / `NEG` box | Edge of an operand | Detects the edge of a specific bit (with its M_BIT memory) | (code with `FP`/`FN`) |
| `--(SAVE)` | Save RLO | Copies the RLO to the BR bit | `SAVE` |

### 6.3 Logic functions with contacts

```text
 AND                              OR
     I0.0     I0.1     Q4.0           I0.0               Q4.0
 |---| |------| |------( )        |---| |----+-----------( )
                                  |   I0.1   |
                                  |---| |----+

 NAND                             NOR
     I0.0     I0.1           Q4.0      I0.0              Q4.0
 |---| |------| |----|NOT|---( )   |---| |----+--|NOT|---( )
                                   |   I0.1   |
                                   |---| |----+

 Exclusive OR (XOR): a·b̄ + ā·b
     I0.0     I0.1     Q4.2
 |---| |------|/|---+--( )
 |   I0.0     I0.1  |
 |---|/|------| |---+
```

| a | b | AND | OR | NAND | NOR | XOR | XNOR |
|---|---|---|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 1 | 1 | 0 | 1 |
| 0 | 1 | 0 | 1 | 1 | 0 | 1 | 0 |
| 1 | 0 | 0 | 1 | 1 | 0 | 1 | 0 |
| 1 | 1 | 1 | 1 | 0 | 0 | 0 | 1 |

### 6.4 Coils, latching and flip-flops

**Latching (self-holding)**: start and stop with stop priority.

```text
     I0.0 (Start)   I0.1 (Stop, wired NC)      Q4.0 (Motor)
 |---| |------+-------| |-----------------------( )
 |            |
 |   Q4.0     |
 |---| |------+
```

**Set/Reset with coils**: the one that is executed **last** has priority.

```text
     I0.0           Q4.0
 |---| |------------(S)
     I0.1           Q4.0
 |---|/|------------(R)          ← R comes after: reset priority
```

**SR / RS box**:

```text
                 Q4.0                               Q4.0
             +---------+                        +---------+
     I0.0    |   SR    |                I0.1    |   RS    |
 |---| |-----|S       Q|---           |---|/|---|R       Q|---
     I0.1    |         |                I0.0    |         |
 |---|/|-----|R        |              |---| |---|S        |
             +---------+                        +---------+
 SR: both = 1 → Q = 0              RS: both = 1 → Q = 1
```

> **One `( )` coil per operand.** If the same bit has two `( )` coils, only the last one counts. `S` and `R` coils for the same bit can appear several times: that is normal.

### 6.5 Edges

`--(P)--` has an **edge memory bit** on top, where it stores the RLO of the previous cycle. Its output is 1 only in the cycle in which the RLO changes from 0 to 1.

```text
     I0.0     M10.0        M10.1
 |---| |-------(P)---------( )        M10.1 = one-cycle pulse when I0.0 is pressed
```

Timing diagram:

<!-- cronograma -->

Typical uses: counting button presses, the **toggle relay** (a single push button that switches on and off) and running an action only once.

### 6.6 Timers

**Boxes and pins** (English names, German names in brackets; the ladder diagrams on this site show the German pin names, like the simulator):

```text
                 T1
             +-----------+
   I0.0      | S_ODT     |                         Q4.0
 |---| |-----|S         Q|-------------------------( )
             |           |
 S5T#5S -----|TV       BI|-- MW10   (remaining time in binary)
             |           |
   I0.1      |        BCD|-- MW12   (remaining time in BCD with time base)
 |---| |-----|R          |
             +-----------+
```

| Pin | Meaning |
|---|---|
| S | Start. Depending on the type, it starts on an **edge** or acts on the level |
| TV (TW) | Time value in S5TIME format |
| R | Reset: sets the timer to 0 and Q = 0. It has **priority** |
| Q | Timer status, the same as `A T1` |
| BI (DUAL) | Remaining time in binary, without the time base |
| BCD (DEZ) | Remaining time in BCD with the time base (S5TIME format) |

| Box | Coil | STL | Type | Behavior |
|---|---|---|---|---|
| S_PULSE (S_IMPULS) | `(SP)` | `SP` | **Pulse** | Q = 1 from the edge of S, for at most the time TV. **If S drops earlier, Q = 0 immediately** |
| S_PEXT (S_VIMP) | `(SE)` | `SE` | **Extended pulse** | Q = 1 for the whole TV even if S drops. A new edge of S **restarts** it |
| S_ODT (S_EVERZ) | `(SD)` | `SD` | **On-delay** | Q = 1 when TV has elapsed **and S is still 1**. If S drops, it stops and Q = 0 |
| S_ODTS (S_SEVERZ) | `(SS)` | `SS` | **Retentive on-delay** | It starts with the edge of S and keeps timing even if S drops. Q = 1 at the end and **stays at 1 until a reset** |
| S_OFFDT (S_AVERZ) | `(SF)` | `SF` | **Off-delay** | Q = 1 as soon as S = 1. When S **drops**, it times TV and then Q = 0. If S returns to 1 while it is timing, it stops and Q stays at 1 |

Timing diagrams (TV = t):

<!-- cronograma -->

**Timer coils**: `T1 --(SD)` with the value `S5T#5S` below it. The reset is done with a `--(R)` coil on `T1`, and the status is read with a `T1 --| |--` contact.

**Notes**:
- Each timer (T1, T2...) is started **in only one place** in the program.
- The value TV is taken on the **start edge**.
- The time counts down from TV to 0. The accuracy is that of the time base.
- If R = 1, the timer stays stopped even if S = 1. When R is released, it does not start again until S has a **new edge**.

### 6.7 Counters

```text
                 C1
             +-----------+
   I1.0      | S_CU      |
 |---| |-----|CU        Q|------------------( ) Q5.1    (Q = 1 if value > 0)
   I1.2      |           |
 |---| |-----|S        CV|-- MW20   (value in binary)
 C#5 --------|PV   CV_BCD|-- MW22   (value in BCD)
   I1.3      |           |
 |---| |-----|R          |
             +-----------+
```

| Box | Function |
|---|---|
| S_CU (Z_VORW) | Up counter: +1 on each **rising edge** of CU |
| S_CD (Z_RUECK) | Down counter: −1 on each rising edge of CD |
| S_CUD (ZAEHLER) | Up and down counter (it has CU and CD) |

| Pin | Meaning |
|---|---|
| CU / CD (ZV / ZR) | Count up / down (on the edge) |
| S | **Rising edge** → loads the value PV |
| PV (ZW) | Preset value in BCD (`C#0`..`C#999`) |
| R | Reset on the level → value = 0 |
| Q | 1 if the value is greater than 0 |
| CV / CV_BCD (DUAL / DEZ) | Current value in binary / in BCD |

- Range **0..999**: it does not go below 0 or above 999.
- Holding the input at 1 **does not count several times**: an edge is needed for each unit.
- Coils: `(CU)`, `(CD)`, `(SC)` (set counter value) and `(R)`.

### 6.8 Boxes with EN/ENO

**Comparison** (they act like a contact: they are placed in series or in parallel):

```text
         I2.0       CMP >I                    Q5.6
 |-------| |-------+-------+------------------( )
                   |  >I   |
           MW30 ---|IN1    |
           500  ---|IN2    |
                   +-------+
```

| Family | Boxes |
|---|---|
| Compare INT | `CMP ==I`, `<>I`, `>I`, `<I`, `>=I`, `<=I` |
| Compare DINT / REAL | the same with `D` / `R` |
| Transfer | `MOVE` (IN → OUT, 8, 16 or 32 bits) |
| INT arithmetic | `ADD_I`, `SUB_I`, `MUL_I`, `DIV_I` |
| DINT arithmetic | `ADD_DI`, `SUB_DI`, `MUL_DI`, `DIV_DI`, `MOD_DI` |
| REAL arithmetic | `ADD_R`, `SUB_R`, `MUL_R`, `DIV_R`, `ABS`, `SQR`, `SQRT`, `EXP`, `LN`, `SIN`, `COS`, `TAN`, `ASIN`, `ACOS`, `ATAN` |
| Conversion | `BCD_I`, `I_BCD`, `BCD_DI`, `DI_BCD`, `I_DI`, `DI_R`, `ROUND`, `TRUNC`, `CEIL`, `FLOOR`, `INV_I`, `INV_DI`, `NEG_I`, `NEG_DI`, `NEG_R` |
| Word logic | `WAND_W`, `WOR_W`, `WXOR_W`, `WAND_DW`, `WOR_DW`, `WXOR_DW` |
| Shift | `SHL_W`, `SHR_W`, `SHR_I`, `SHL_DW`, `SHR_DW`, `SHR_DI`, `ROL_DW`, `ROR_DW` |

- **ENO = 0** if EN = 0 or if there was an error. For example, `ADD_I` with overflow or `I_BCD` outside ±999.
- Boxes can be **chained**: the ENO of one → the EN of the next.
- There is no `I_R`: to go from INT to REAL you have to use `I_DI` and then `DI_R`.

### 6.9 Program control

| Element | Function | STL |
|---|---|---|
| `--(JMP)` with label | Jumps if RLO = 1. If it is connected directly to the rail, it always jumps | `JC` / `JU` |
| `--(JMPN)` | Jumps if RLO = 0 | `JCN` |
| `LABEL` | Jump destination, at the start of a network | `LABEL:` |
| `--(CALL)` | Calls an FC or SFC without parameters | `UC` / `CC` |
| `--(RET)` | Conditional block end | `BEC` |
| `--(OPN)` | Opens a DB | `OPN` |
| `--(MCRA)`, `--(MCR<)`, `--(MCR>)`, `--(MCRD)` | Master Control Relay | `MCRA`, `MCR(`, `)MCR`, `MCRD` |

### 6.10 Status bits as contacts

Contacts `OV`, `OS`, `UO`, `BR`, `==0`, `<>0`, `>0`, `<0`, `>=0` and `<=0`. They check the result of the last arithmetic or comparison operation (§7.2).

---

## 7. Statement List (STL)

### 7.1 Format

```text
[LABEL:] OPERATION   OPERAND         // comment
 END:    A           I 0.0           // AND with input 0.0
```

- One instruction per line. The code is divided into **networks**, as in Ladder.
- **Labels**: up to 4 characters, they start with a letter and end with `:`.
- Comments start with `//`. In STL sources every instruction ends with `;`.
- Spaces between the area and the address do not matter: `I 0.0` is the same as `I0.0`.

### 7.2 CPU registers

| Register | Size | Use |
|---|---|---|
| **ACCU1**, **ACCU2** | 32 bits | Accumulators. `L` loads into ACCU1 and the previous content moves to ACCU2. Operations work with ACCU2 (op) ACCU1. CPUs with 4 accumulators also have ACCU3 and ACCU4 |
| **AR1**, **AR2** | 32 bits | Address registers (indirect addressing) |
| **DB / DI** | 16 bits | Number of the open global DB and of the open instance DB |
| **Status word** | 16 bits (9 are used) | See the table |

**Status word**:

| Bit | Name (German) | English | Meaning |
|---|---|---|---|
| 0 | /ER | **/FC** | **First check**. 0 = the next logic operation starts a new chain. 1 = chain in progress |
| 1 | VKE | **RLO** | **Result of logic operation** of the chain |
| 2 | STA | **STA** | **Status** of the last bit checked (its real value, before any inversion) |
| 3 | OR | **OR** | Memory for "AND before OR" (§7.4) |
| 4 | OS | **OS** | **Stored** overflow. It is reset to 0 by `JOS`, when a block is called and when a block ends |
| 5 | OV | **OV** | Overflow in the **last** arithmetic operation |
| 6 | A0 | **CC0** | Condition code 0 |
| 7 | A1 | **CC1** | Condition code 1 |
| 8 | BIE | **BR** | Binary result. It is used for ENO and `SAVE` |

**Meaning of CC1/CC0**:

| CC1 | CC0 | After arithmetic | After comparison (ACCU2 vs. ACCU1) | After a shift |
|---|---|---|---|---|
| 0 | 0 | result = 0 | ACCU2 = ACCU1 | last bit shifted out = 0 |
| 0 | 1 | result < 0 | ACCU2 < ACCU1 | — |
| 1 | 0 | result > 0 | ACCU2 > ACCU1 | last bit shifted out = 1 |
| 1 | 1 | division by 0 / invalid REAL | unordered (invalid REAL) | — |

### 7.3 Bit logic: RLO, first check and STA

Each logic instruction combines **the current RLO** with **the bit of the operand**:

| Instruction | If /FC = 0 (first check) | If /FC = 1 (chain in progress) |
|---|---|---|
| `A op` (AND) | RLO := op | RLO := RLO ∧ op |
| `AN op` (AND NOT) | RLO := ¬op | RLO := RLO ∧ ¬op |
| `O op` (OR) | RLO := op | RLO := RLO ∨ op |
| `ON op` (OR NOT) | RLO := ¬op | RLO := RLO ∨ ¬op |
| `X op` (exclusive OR) | RLO := op | RLO := RLO ⊕ op |
| `XN op` (exclusive OR NOT) | RLO := ¬op | RLO := RLO ⊕ ¬op |

After any of them: **/FC := 1** and **STA := value of the operand**.

**Instructions that close the chain (/FC := 0)** without changing the RLO:
- `=`, `S` and `R`.
- Timer instructions (`SP`, `SE`, `SD`, `SS`, `SF`, `R T`, `FR T`).
- Counter instructions (`CU`, `CD`, `S C`, `R C`).

That is why **several assignments can be chained** with the same RLO:

```awl
      U     E 0.0
      U     E 0.1
      =     A 4.0      // Q4.0 := I0.0 ∧ I0.1
      =     A 4.1      // Q4.1 gets the same RLO
      S     M 0.0      // and M0.0 is also set if it is 1
```

**Instructions that do NOT affect the RLO or /FC**: `L`, `T`, arithmetic, conversion, `TAK`, `INC`, `DEC`... A logic chain can carry on "over" them:

```awl
      U     E 0.0
      L     MW 10      // does not affect the RLO
      T     MW 12      // ALWAYS executed (T does not depend on the RLO)
      =     A 4.0      // Q4.0 := I0.0
```

**Direct operations on the RLO**:

| Instruction | Effect |
|---|---|
| `NOT` | RLO := ¬RLO |
| `SET` | RLO := 1 (and /FC := 0) |
| `CLR` | RLO := 0 (and /FC := 0) |
| `SAVE` | BR := RLO |

### 7.4 "AND before OR": `O` without operand and brackets

STL evaluates **sequentially**: `A I0.0 / O I0.1 / A I0.2` calculates **(I0.0 ∨ I0.1) ∧ I0.2**, not I0.0 ∨ (I0.1 ∧ I0.2). There are two tools for grouping.

**a) `O` without an operand** separates AND groups that are combined with OR:

```awl
      U     E 0.0
      U     E 0.1
      O                 // (I0.0 ∧ I0.1)  ∨ ...
      U     E 0.2
      U     E 0.3
      =     A 4.0       // Q4.0 = (I0.0 ∧ I0.1) ∨ (I0.2 ∧ I0.3)
```

How it works inside: `O` stores the result of the first group in the **OR** bit and sets /FC = 0. While OR = 1, the following `A` and `AN` leave the RLO at 1, because the result has already been decided. `=` sets OR := 0.

**b) Brackets**: `A(`, `AN(`, `O(`, `ON(`, `X(`, `XN(` ... `)`.

```awl
      U     E 0.0
      U(                // I0.0 ∧ ( ... )
      O     E 0.1
      O     E 0.2
      )
      =     A 4.1       // Q4.1 = I0.0 ∧ (I0.1 ∨ I0.2)
```

- When a bracket is opened, the RLO, the OR bit and the pending operation are saved on the **nesting stack**, and a new chain starts (/FC = 0).
- When it is closed with `)`, the saved values are restored and combined with the RLO from inside the bracket.
- **Up to 7 levels** of nesting are allowed.

### 7.5 Assignment, Set and Reset

| Instruction | Effect | Priority |
|---|---|---|
| `= op` | op := RLO, always | — |
| `S op` | if RLO = 1 → op := 1 (if RLO = 0 it does nothing) | — |
| `R op` | if RLO = 1 → op := 0 | — |

When the same bit has `S` and `R`, **the one that is executed last wins**:

```awl
      U     E 0.0           // start
      S     A 4.0
      U     E 0.1           // stop
      R     A 4.0           // R at the end → reset (stop) priority
```

### 7.6 Edges

| Instruction | Pseudocode |
|---|---|
| `FP m` | `prev := m; m := RLO; RLO := RLO ∧ ¬prev` |
| `FN m` | `prev := m; m := RLO; RLO := ¬RLO ∧ prev` |

```awl
      U     E 0.0
      FP    M 10.0          // M10.0 = edge memory bit (exclusive)
      =     M 10.1          // M10.1 = 1 only in the cycle of the edge
```

### 7.7 Timers in STL

```awl
      U     E 0.0           // start condition (RLO)
      L     S5T#5S          // time value → ACCU1
      SE    T 1             // on-delay (SP, SE, SD, SS or SF)
      U     E 0.1
      R     T 1             // reset
      L     T 1             // remaining time in binary (no time base) → ACCU1
      T     MW 10
      LC    T 1             // remaining time in BCD with time base (S5TIME) → ACCU1
      T     MW 12
      U     T 1             // timer status Q
      =     A 4.0
```

| Instruction | Function |
|---|---|
| `SP T n` | Starts as a pulse (S_PULSE) |
| `SE T n` | Starts as an extended pulse (S_PEXT) |
| `SD T n` | Starts as an on-delay (S_ODT) |
| `SS T n` | Starts as a retentive on-delay (S_ODTS) |
| `SF T n` | Starts as an off-delay (S_OFFDT) |
| `R T n` | Reset if RLO = 1 |
| `FR T n` | Enable: an edge allows a restart without an edge on the start input (rarely used) |
| `A T n` / `AN T n` / `O T n`... | Checks the status Q of the timer |
| `L T n` / `LC T n` | Loads the remaining time in binary / in BCD |

The start instruction **uses the value in ACCU1** at the moment of the edge. That is why the `L S5T#…` goes right before it.

### 7.8 Counters in STL

```awl
      U     E 1.0
      ZV    Z 1             // +1 on a rising edge
      U     E 1.1
      ZR    Z 1             // −1 on a rising edge
      U     E 1.2
      L     C#5             // value in BCD
      S     Z 1             // edge → loads 5
      U     E 1.3
      R     Z 1             // reset (on the level)
      L     Z 1             // value in binary
      T     MW 20
      LC    Z 1             // value in BCD
      T     MW 22
      U     Z 1             // 1 if value > 0
      =     A 5.1
```

### 7.9 Load and transfer

| Instruction | Effect |
|---|---|
| `L op` | **ACCU2 := ACCU1; ACCU1 := op**. A byte or a word is loaded into the low part of ACCU1 and the rest is filled with **zeros** (without sign extension) |
| `T op` | op := low part of ACCU1 (1, 2 or 4 bytes depending on the operand). **It is always executed, whatever the RLO is**. It does not change the accumulators |
| `LC T n` / `LC C n` | Loads the value of a timer or counter in BCD |
| `L STW` / `T STW` | Reads or writes the status word |
| `L DBNO` / `L DBLG` | Number / length of the open DB |

```awl
      L     MW 10           // ACCU1 = MW10             ACCU2 = (previous)
      L     MW 12           // ACCU1 = MW12             ACCU2 = MW10
      +I                    // ACCU1 = MW10 + MW12      ACCU2 = MW10 (unchanged with 2 ACCUs)
      T     MW 14           // MW14 := ACCU1-L
```

> **T is unconditional.** To transfer only when a condition is met, you have to jump over it: `A I0.0 / JCN NO / L 5 / T MW10 / NO: NOP 0`.
>
> **Zeros, not the sign.** `L MW 10` with MW10 = −1 (W#16#FFFF) leaves ACCU1 = DW#16#0000FFFF. To treat it as a DINT you have to use `ITD`.

### 7.10 Arithmetic

| Instruction | Operation | Result |
|---|---|---|
| `+I`, `-I` | ACCU2-L ± ACCU1-L (INT) | ACCU1-L |
| `*I` | ACCU2-L × ACCU1-L | **The whole of ACCU1, as a DINT** (OV = 1 if it does not fit in an INT) |
| `/I` | ACCU2-L ÷ ACCU1-L | **Quotient in ACCU1-L, remainder in ACCU1-H** |
| `+D`, `-D`, `*D` | DINT | ACCU1 |
| `/D` | DINT, integer quotient | ACCU1 (the remainder is lost) |
| `MOD` | DINT remainder | ACCU1. The sign of the remainder is the sign of the dividend |
| `+R`, `-R`, `*R`, `/R` | REAL | ACCU1 |
| `ABS`, `SQR`, `SQRT`, `EXP`, `LN`, `SIN`, `COS`, `TAN`, `ASIN`, `ACOS`, `ATAN` | REAL functions on ACCU1 (angles in radians) | ACCU1 |
| `+ const` | ACCU1 + constant | ACCU1. **It does not change the status word** |
| `INC n` / `DEC n` | Adds or subtracts n **only on the low byte** of ACCU1 (ACCU1-LL) | No carry and no status bits |

- With 2 accumulators, ACCU2 **does not change** after the operation.
- Integer division **truncates toward 0**: `-17 /I 5` gives quotient −3 and remainder −2.

**Status bits after `+I`** (the other INT and DINT operations follow the same idea):

| Mathematical result | Stored value | CC1 | CC0 | OV | OS |
|---|---|---|---|---|---|
| = 0 | 0 | 0 | 0 | 0 | — |
| −32768 ≤ r < 0 | r | 0 | 1 | 0 | — |
| 0 < r ≤ 32767 | r | 1 | 0 | 0 | — |
| r > 32767 (positive overflow) | r − 65536 (it becomes negative) | 0 | 1 | **1** | **1** |
| r < −32768 (negative overflow) | r + 65536 (it becomes positive) | 1 | 0 | **1** | **1** |
| r = −65536 | 0 | 0 | 0 | **1** | **1** |

Example: 30000 + 10000 → **−25536** is stored, with OV = 1 and OS = 1.

- **Division by 0**: CC1 = CC0 = 1, OV = OS = 1. The result is not valid.
- **REAL**: an infinite result sets OV and OS to 1. An invalid result (NaN) also sets CC1 = CC0 = 1.

### 7.11 Comparison

`==I`, `<>I`, `>I`, `<I`, `>=I`, `<=I` compare **ACCU2 with ACCU1**: `L a / L b / >I` means "a > b". The `…D` variants compare DINTs and the `…R` variants compare REALs.

- The result (1 or 0) **is written to the RLO and replaces the previous one**: it is not combined with it. To use it in series with contacts it has to go **inside brackets**:

```awl
      U     E 2.0
      U(
      L     MW 30
      L     500
      >I
      )
      =     A 5.6           // Q5.6 = I2.0 ∧ (MW30 > 500)
```

- The comparison also sets CC1/CC0 (§7.2), sets OV = 0 and leaves /FC = 1. The chain can carry on with `A`, `O`...

### 7.12 Conversion

| STL | Ladder | Conversion | Notes |
|---|---|---|---|
| `BTI` | `BCD_I` | 3-digit BCD → INT (ACCU1-L) | Invalid digit → BCD error (OB121) |
| `ITB` | `I_BCD` | INT → 3-digit BCD | Outside ±999 → OV = OS = 1 and it does not convert |
| `BTD` | `BCD_DI` | 7-digit BCD → DINT | |
| `DTB` | `DI_BCD` | DINT → 7-digit BCD | |
| `ITD` | `I_DI` | INT → DINT (extends the sign) | |
| `DTR` | `DI_R` | DINT → REAL | Above 2²⁴ it may lose precision |
| `RND` | `ROUND` | REAL → DINT, rounding to the nearest | In the exact case of x.5, the STL manual specifies rounding to even |
| `TRUNC` | `TRUNC` | REAL → DINT, truncating toward 0 | 3.9 → 3 ; −3.9 → −3 |
| `RND+` | `CEIL` | REAL → DINT toward +∞ | 3.2 → 4 ; −3.2 → −3 |
| `RND-` | `FLOOR` | REAL → DINT toward −∞ | 3.2 → 3 ; −3.2 → −4 |
| `INVI` / `INVD` | `INV_I` / `INV_DI` | Ones' complement (inverts the bits) | |
| `NEGI` / `NEGD` | `NEG_I` / `NEG_DI` | Two's complement (changes the sign) | |
| `NEGR` | `NEG_R` | Changes the sign of a REAL | |
| `CAW` | — | Swaps the 2 bytes of ACCU1-L | |
| `CAD` | — | Reverses the order of the 4 bytes of ACCU1 | |

**Typical analog scaling** (0..27648 → 0..100 %):

```awl
      L     PEW 256         // raw value (INT)
      ITD                   // INT → DINT
      DTR                   // DINT → REAL
      L     2.764800e+004
      /R
      L     1.000000e+002
      *R
      T     MD 60           // % as a REAL
```

### 7.13 Word logic and shifts

| Instruction | Effect |
|---|---|
| `AW`, `OW`, `XOW` | ACCU1-L := ACCU1-L (AND / OR / exclusive OR) ACCU2-L. With a constant (`AW W#16#00FF`), they operate with the constant |
| `AD`, `OD`, `XOD` | The same with 32 bits |
| `SLW n` / `SRW n` | Shifts ACCU1-L n bits to the left / right, filling with 0 |
| `SSI n` | Shifts ACCU1-L to the right, keeping the sign |
| `SLD n` / `SRD n` / `SSD n` | 32-bit shifts |
| `RLD n` / `RRD n` | Rotates ACCU1 n bits to the left / right |
| `RLDA` / `RRDA` | Rotates 1 bit through CC1 |

- Without an operand, the number of positions is taken from ACCU2-LL.
- After word logic: CC1 = (result ≠ 0), CC0 = 0 and OV = 0.
- After a shift: CC1 = last bit shifted out.

Example: isolating the low byte of a word with `L MW 10 / AW W#16#00FF / T MW 12`.

### 7.14 Accumulator operations

| Instruction | What it does |
|---|---|
| `TAK` | Swaps ACCU1 and ACCU2 |
| `PUSH` | ACCU2 := ACCU1 |
| `POP` | ACCU1 := ACCU2 |
| `ENT`, `LEAVE` | Only on CPUs with 4 accumulators |
| `INC n`, `DEC n` | Low byte of ACCU1 (0..255) |
| `+ n` | Adds a constant to ACCU1 |
| `NOP 0`, `NOP 1` | Do nothing (they are used as jump destinations) |

### 7.15 Jumps

| Instruction | Jumps if… | Effect on the status bits |
|---|---|---|
| `JU label` | always | none |
| `JC label` | RLO = 1 | It **always** leaves RLO := 1, /FC := 0, OR := 0, STA := 1 (whether it jumps or not) |
| `JCN label` | RLO = 0 | Same as JC |
| `JCB label` | RLO = 1 (it copies the RLO to BR first) | Same as JC, and BR := RLO |
| `JNB label` | RLO = 0 (it copies the RLO to BR first) | Same as JCN, and BR := RLO |
| `JBI` / `JNBI` | BR = 1 / BR = 0 | — |
| `JO` | OV = 1 | — |
| `JOS` | OS = 1 | Sets OS := 0 |
| `JZ` | result = 0 (CC1 = 0, CC0 = 0) | — |
| `JN` | result ≠ 0 | — |
| `JP` | result > 0 (CC1 = 1, CC0 = 0) | — |
| `JM` | result < 0 (CC1 = 0, CC0 = 1) | — |
| `JPZ` | result ≥ 0 | — |
| `JMZ` | result ≤ 0 | — |
| `JUO` | invalid (CC1 = 1, CC0 = 1) | — |
| `LOOP label` | ACCU1-L := ACCU1-L − 1; jumps if ≠ 0 | — |
| `JL label` | Jump list according to ACCU1-LL (several `JU` in a row) | — |

> **Trap**: if `JC` does not jump, the RLO is left at **1**. `A I0.0 / JC X / = Q4.0` sets Q4.0 = 1 when I0.0 = 0.
>
> **Trap with `LOOP`**: if ACCU1-L is 0 when `LOOP` is reached, it becomes 65535 and the loop body runs another 65535 times. You have to check first that the counter is greater than 0.

**Loop with `LOOP`**:

```awl
      L     5
SIG:  T     MW 10           // loop counter
      // ... loop body (uses MW10) ...
      L     MW 10
      LOOP  SIG             // MW10−1; repeats while ≠ 0
```

### 7.16 Status bits as operands

`A OV`, `A OS`, `A BR`, `A ==0`, `A <>0`, `A >0`, `A <0`, `A >=0`, `A <=0` and `A UO` (unordered). They also work with `AN`, `O`, `ON`, `X` and `XN`.

```awl
      L     MW 40
      L     MW 42
      +I
      T     MW 44
      U     OV              // did this addition overflow?
      =     M 1.0
```

### 7.17 Block end and calls

| Instruction | Effect |
|---|---|
| `BE` | Block end |
| `BEU` | Unconditional block end |
| `BEC` | Block end if RLO = 1. If RLO = 0 it carries on, with RLO := 1 and /FC := 0 |
| `CALL` | Call with parameters (§5.4) |
| `UC` / `CC` | Unconditional / conditional call, without parameters |

### 7.18 Data blocks

```awl
      AUF   DB 1            // opens DB1 as the global DB
      L     DBW 0           // DB1.DBW0
      T     MW 10
      U     DB1.DBX 2.0     // full address (it also opens DB1)
      =     A 4.0
```

### 7.19 Indirect addressing (advanced)

- **Memory-indirect**: the address is in a memory word or a data item, in pointer format. For example: `L MW [MD 30]` or `A I [MD 34]`.
- **Register-indirect**: `LAR1 P#M 100.0` and then `L MW [AR1, P#2.0]`.
- Area pointer format (32 bits): byte number × 8 + bit number. For example, `P#10.0` is equivalent to 80.

Example: adding up MW100..MW118 by stepping through them with a pointer.

```awl
      L     P#100.0
      T     MD 30           // pointer to the first element
      L     0
      T     MW 40           // sum = 0
      L     10              // 10 elements
SIG:  T     MW 34
      L     MW 40
      L     MW [MD 30]
      +I
      T     MW 40
      L     MD 30
      L     P#2.0           // next word
      +D
      T     MD 30
      L     MW 34
      LOOP  SIG
```

### 7.20 MCR (Master Control Relay)

- `MCRA` activates the MCR area and `MCRD` deactivates it.
- Inside `MCR(` … `)MCR`, if the condition before `MCR(` is 0, all `=` assignments and `T` transfers write 0. `S` and `R` have no effect.
- **It does not replace a hard-wired emergency stop circuit.**

### 7.21 Trace method (for solving exercises by hand)

Write down, line by line, the state of /FC, RLO, STA and OR. Example with I0.0 = 1, I0.1 = 0, I0.2 = 1 and I0.3 = 1:

| Instruction | /FC before | STA | RLO after | OR | Comment |
|---|---|---|---|---|---|
| `A I 0.0` | 0 | 1 | 1 | 0 | First check: RLO := 1 |
| `A I 0.1` | 1 | 0 | 0 | 0 | 1 ∧ 0 |
| `O` | 1 | 1 | 0 | 0 | OR := RLO (0); /FC := 0 |
| `A I 0.2` | 0 | 1 | 1 | 0 | First check of the 2nd group |
| `A I 0.3` | 1 | 1 | 1 | 0 | 1 ∧ 1 |
| `= Q 4.0` | 1 | 1 | 1 | 0 | **Q4.0 = 1**; /FC := 0 (STA = value written) |

With I0.0 = I0.1 = 1 and I0.2 = I0.3 = 0: after `O`, the OR bit = 1. The two following `A` instructions leave the RLO at 1, so Q4.0 = 1.

---

## 8. Ladder ↔ STL equivalences

### 8.1 Elements

| Ladder | STL |
|---|---|
| NO contact in series | `A op` |
| NC contact in series | `AN op` |
| First contact of a parallel group of single contacts | `O op` (or `A op`) |
| NO / NC contact in parallel | `O op` / `ON op` |
| Coil `( )` | `= op` |
| `(S)` / `(R)` | `S op` / `R op` |
| `NOT` | `NOT` |
| `(#)` | `= op` (and the logic carries on) |
| `(P)` / `(N)` | `FP m` / `FN m` |
| Comparator in series | `A(` `L` `L` `>I` `)` |
| Timer coil `(SD)` | `L S5T#…` + `SD T n` |
| Jump `(JMP)` / `(JMPN)` | `JC` / `JCN` (or `JU` if it is connected directly to the rail) |
| `(RET)` | `BEC` |

### 8.2 Series and parallel patterns

| Diagram | STL |
|---|---|
| a ∧ b | `A a / A b` |
| a ∨ b | `O a / O b` |
| (a ∨ b) ∧ c | `O a / O b / A c` (sequential) or `A( / O a / O b / ) / A c` |
| a ∧ (b ∨ c) | `A a / A( / O b / O c / )` |
| (a ∧ b) ∨ (c ∧ d) | `A a / A b / O / A c / A d` or `A( / A a / A b / ) / O( / A c / A d / )` |
| a ∧ ((b ∧ c) ∨ d) | `A a / A( / A b / A c / O d / )` |
| a ∧ (b ∨ (c ∧ d)) | `A a / A( / O b / O( / A c / A d / ) / )` |
| Several coils in parallel | logic + `= x / = y / = z` |

### 8.3 Boxes with EN/ENO

When a box with EN is translated into STL, the editor generates a jump that skips it if EN = 0, and sets BR so that ENO shows whether there was an error. Simplified scheme of `ADD_I` with EN:

```awl
      U     E 0.0           // EN
      SPBNB _001            // if EN = 0 → jump (and BR := 0)
      L     MW 10
      L     MW 12
      +I
      T     MW 14
      UN    OV              // no overflow…
      SAVE                  // …BR := 1
      CLR
_001: U     BIE             // ENO = BR
      =     A 4.0
```

> Not all STL code can be converted to Ladder. For example: jumps inside a network, accumulator operations (`TAK`, standalone `+I`), indirect addressing or `O` without an operand in unusual positions. Those networks stay in STL.

---

## 11. German ↔ English mnemonics

| German | English (international) | German | English |
|---|---|---|---|
| `U` | `A` | `SPA` | `JU` |
| `UN` | `AN` | `SPB` | `JC` |
| `O` / `ON` | `O` / `ON` | `SPBN` | `JCN` |
| `X` / `XN` | `X` / `XN` | `SPBB` / `SPBNB` | `JCB` / `JNB` |
| `U(` / `UN(` | `A(` / `AN(` | `SPBI` / `SPBIN` | `JBI` / `JNBI` |
| `=`, `S`, `R`, `NOT`, `SET`, `CLR`, `SAVE` | the same | `SPO` / `SPS` | `JO` / `JOS` |
| `FP` / `FN` | `FP` / `FN` | `SPZ` / `SPN` | `JZ` / `JN` |
| `SI` | `SP` | `SPP` / `SPM` | `JP` / `JM` |
| `SV` | `SE` | `SPPZ` / `SPMZ` | `JPZ` / `JMZ` |
| `SE` | `SD` | `SPU` / `SPL` | `JUO` / `JL` |
| `SS` | `SS` | `BE` / `BEB` / `BEA` | `BE` / `BEC` / `BEU` |
| `SA` | `SF` | `AUF` | `OPN` |
| `ZV` / `ZR` | `CU` / `CD` | `UW` / `UD` | `AW` / `AD` |
| `E` / `A` (operands) | `I` / `Q` | `BIE` | `BR` |
| `PE` / `PA` | `PI` / `PQ` | `Z` (counter) | `C` |
| `S5T#`, `C#`, `L#`... | the same | `KOP` / `FUP` / `AWL` | `LAD` / `FBD` / `STL` |

Watch out for confusions: `SE` in German is the on-delay timer, but in English it is the extended pulse. `A` in German is an output, but in English it is the AND instruction.

---

## 12. Glossary

| Term | Meaning |
|---|---|
| PII / PIQ (German PAE / PAA) | Process image of inputs / of outputs |
| RLO (German VKE) | Result of logic operation |
| /FC (German /ER) | First check bit |
| STA | Status bit (value of the last operand checked) |
| BR (German BIE) | Binary result (ENO, `SAVE`) |
| ACCU1 / ACCU2 | Accumulators |
| Network | Program unit in Ladder and STL (Segmento in Spanish, Netzwerk in German) |
| Latching | Self-holding of an output with its own contact |
| Edge | A change 0→1 (rising) or 1→0 (falling) |
| Retentive | Keeps its value after a power failure or a STOP→RUN |
| OB / FC / FB / DB | Organization block / function / function block / data block |
| BCD | Binary-coded decimal |
| S5TIME | Time format of the timers (time base + 3 BCD digits) |
| Clock memory | Memory byte whose bits the CPU switches on and off at fixed frequencies |
