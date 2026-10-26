# Frequently asked questions for each page

> English translation of `web/teoria/es/preguntas.md`.
> - "## id" is the page id in `web/teoria/paginas.ts`. Below it, each "### Question?" has its answer in Markdown.
> - Inline code uses the English mnemonics.

## intro

### What is a PLC (programmable logic controller)?

It is an industrial computer that controls machines and installations: it reads push buttons and sensors through its inputs, runs a program in a cycle that repeats without stopping, and drives motors, valves or lamps through its outputs. It replaces control circuits wired with relays.

### What is the difference between a PLC and an Arduino?

A PLC is built for industry: 24 V inputs and outputs, resistance to electrical noise and vibration, predictable cyclic execution, standardized languages (IEC 61131-3) and spare parts for many years. An Arduino is a microcontroller board designed for learning and prototyping, and it is programmed in C++.

### Which PLC language should I learn first?

Ladder (LAD), because it reads like an electrical diagram. Then STL, to understand how the CPU works inside, and later structured text (ST) for calculations and GRAFCET for sequences.

### Do I need a real PLC to learn to program one?

No. With a simulator you can write programs in Ladder and STL, operate the inputs and see how the outputs, timers and counters respond. When you work with a real PLC, you will arrive with the program already tested.

## ciclo

### What is the scan cycle of a PLC?

It is the loop that the CPU repeats without stopping: it reads the inputs into the process image (PII), runs OB1 from top to bottom and copies the output image (PIQ) to the physical outputs. Then it handles communication and starts again.

### If I assign the same output in two places, which value reaches the output?

The value of the last assignment executed. The PIQ is written at the end of the cycle, so the last assignment overwrites the previous ones. To combine conditions, use an OR or Set and Reset coils.

### Why is the stop button programmed with a normally open contact?

Because the stop button is wired as an NC contact: at rest the input is 1, and the NO contact in the program only asks "is it 1?". If the wire breaks, the input drops to 0 and the machine stops, which is the safe result.

### Which OB runs only once when the CPU starts?

OB100, in the complete restart when the CPU goes from STOP to RUN. It is used for initialization. After it, the OB1 cycle begins.

## memoria

### Which bytes make up the memory word MW 10?

MB10 and MB11. A word is 2 bytes starting at the given address: MB10 is the high byte and MB11 the low byte. That is why words are used in steps of 2 (MW10, MW12…).

### Why is IW 0 equal to 256 if only input I 0.0 is on?

Because the byte with the lowest address is the most significant one: IB0 is the high byte of IW0, and I0.0 is its bit 8. If only I1.0 were on, IW0 would be 1.

### What value does an analog input give at 10 V or 20 mA?

27648, the end of the nominal range. Above it is the overrange, up to 32511, and the value 32767 indicates overflow or a broken wire.

### What is retentive bit memory?

Memory bits that keep their value after a power failure or a STOP to RUN transition. It is set in the CPU properties; in many CPUs the default is MB0..MB15.

## tipos

### What is BCD and what is it used for in PLCs?

It is a way of storing numbers in which each group of 4 bits is a decimal digit from 0 to 9: `W#16#0123` in BCD is 123. It is used by thumbwheel switches, displays, and time and count values.

### How is S5T#5S stored in the accumulator?

As `W#16#0500`: time base 10 ms (bits 13-12 = 00) and the value 500 in BCD.

### Why can't `L 500` be used as a time value?

Because 500 in binary is `W#16#01F4`, which contains the digit F and is not valid BCD. When the timer starts there is an error and the CPU goes to STOP. You have to write `L S5T#5S`.

### How do I convert an INT to a REAL?

In two steps: `ITD` (INT to DINT) and then `DTR` (DINT to REAL). In Ladder, with the `I_DI` and `DI_R` boxes. There is no direct conversion from INT to REAL.

## bloques

### What is the difference between an FC and an FB?

An FB has its own memory: an instance DB where it stores its static variables (STAT), which keep their value between calls. An FC only has temporary variables, which are lost when it ends.

### Which OB runs the main program?

OB1, which the CPU runs cyclically. OB100 is the startup, OB35 the cyclic interrupt and OB80 the time error.

### What happens if an error occurs and its OB is not programmed?

The CPU goes to STOP. For example, an invalid BCD calls OB121: if OB121 is not loaded, the CPU stops.

## kop

### What is Ladder logic?

It is the graphical PLC language that looks like an electrical diagram: power comes out of a rail on the left, goes through contacts and reaches coils on the right. It is also called LAD or LD, and KOP in German.

### What is the difference between an NO and an NC contact in Ladder?

The NO contact `--| |--` conducts when its bit is 1, and the NC contact `--|/|--` when it is 0. Both only ask for the state of the bit: they do not know how the real push button is wired.

### What do two contacts in series or in parallel mean?

In series, an AND function: power only gets through if both conduct. In parallel, an OR function: it is enough for one of them to conduct.

## awl

### What is the RLO in STL?

The result of logic operation: the bit of the status word where the result of the logic instructions (`A`, `O`, `X`…) builds up. The assignments `=`, `S` and `R` write it to an operand.

### What is the /FC (first check) bit for?

It shows whether the next logic instruction starts a new chain. With /FC = 0, the next `A`, `O` or `X` copies the operand into the RLO instead of combining it with it.

### Why doesn't `A a / O b / A c` calculate "a or (b and c)"?

Because STL evaluates sequentially: it calculates (a ∨ b) ∧ c. To get a ∨ (b ∧ c) you need `O` without an operand or brackets.

### How many nested brackets does STL allow?

Seven levels. If they are exceeded, there is an error and the CPU goes to STOP.

### What does the SET instruction do in STL?

It sets the RLO to 1 and closes the logic chain (/FC = 0). It does not set any operand to 1: that is what `S` is for.

## setreset

### What is latching (self-holding)?

A circuit in which the output stays on through its own contact: the start button switches it on and, when it is released, the contact of the output itself keeps it on until the stop button is pressed.

### If a bit has Set and Reset active at the same time, which one wins?

The instruction that is executed last. With the Reset after it, stop wins; with the Set after it, start wins. The priority comes from the order, not from the type of coil.

### Which STL instruction is equivalent to the (S) coil in Ladder?

`S`. Do not confuse it with `SET`, which sets the RLO to 1, or with `SE`, which starts a timer (an extended pulse, in English mnemonics).

### What is the difference between the SR and RS flip-flops?

With both inputs at 1, SR gives priority to reset (Q = 0) and RS to set (Q = 1).

## flancos

### What is a rising edge in a PLC?

The change of a signal from 0 to 1. An edge detector gives 1 only during the cycle in which that change happens, even if the signal stays at 1 afterwards. The falling edge is the change from 1 to 0.

### Why does each edge need its own memory bit?

Because the edge memory bit stores the state of the previous cycle. If two `FP` share the same bit, each one overwrites what the other has stored and both fail.

### How do I make one push button switch a lamp on and off?

With a toggle relay: a rising edge of the push button and a latching circuit that changes the state of the output on each edge (example E11). Without the edge, the output would change on every cycle while the button is held down.

## temporizadores

### What is the difference between the SD and SS timers?

Both are on-delays. SD only turns on Q if S stays at 1 the whole time; if S drops earlier, it stops. SS keeps timing even if S drops and, when it finishes, keeps Q at 1 until it is reset. In German mnemonics they are SE and SS.

### Which timer keeps Q at 1 for the whole time even if S drops earlier?

SE in English mnemonics (SV in German): the extended pulse, S_PEXT. The pulse SP, on the other hand, is cut short if S drops early.

### Which timer turns Q on as soon as S = 1 and keeps it on for a while after S drops?

SF, the off-delay (S_OFFDT; SA in German): the time starts counting on the falling edge of S.

### Why doesn't my timer start again after a reset?

Because it needs a new edge on S. If the start condition was already 1 when the reset ended, it has to go back to 0 and then to 1 again.

## contadores

### What is the range of values of a counter?

From 0 to 999, because the value is stored as 3 BCD digits. It does not go below 0 or above 999.

### Why does the counter only add 1 even if I hold the button down?

Because it counts edges, not levels: to add another unit, the input has to go back to 0 and then to 1.

### How do I read the value of a counter in STL?

`L C 1` gives the value in binary and `LC C 1` in BCD. `A C 1` returns 1 if the value is greater than 0.

## marcaciclo

### With MB100 as clock memory, which bit oscillates at 1 Hz?

`M 100.5`, which has a period of 1 s. The periods of bits 0 to 7 are 0.1 / 0.2 / 0.4 / 0.5 / 0.8 / 1 / 1.6 / 2 s.

### Can I write to the clock memory byte?

No: the CPU overwrites it every cycle, so anything the program writes is lost. The program should only read it.

### Should I use the clock memory or timers for a flashing light?

The clock memory, if one of its frequencies is good for you and it does not matter at which point the flashing starts. Timers, if you need different on and off times or the flashing must start exactly when the condition becomes true (example E17).

## secuencias

### What is a GRAFCET?

A diagram that describes a sequence as steps (states of the machine) linked by transitions (the conditions for moving from one step to the next). Each step has its actions, for example turning on an output.

### How is a GRAFCET programmed in Ladder or STL?

With one memory bit per step. Each transition is programmed with the current step in series with its condition: Set of the next step and Reset of the current one. The outputs are assigned at the end, only once, from the step bits.

### How is the initial step activated?

At startup, from OB100, or with a condition that activates it when no step is active, as in the traffic light of example E28.

### Why are the outputs of a sequence assigned at the end of the program?

To avoid double assignment: if the same output were assigned in several steps, only the last assignment would count. At the end, the steps in which it is active are combined with OR.

## aritmetica

### What happens if an INT addition goes out of range?

The result wraps around: 30000 + 10000 leaves −25536 in the accumulator and the overflow bits OV and OS are set. The CPU does not stop.

### Does the T instruction depend on the RLO?

No. `L` and `T` are always executed, whatever the RLO is. To transfer only when a condition is met, you have to jump over it with `JCN`.

### What does /I leave in the accumulator?

The quotient in the low part (ACCU1-L) and the remainder in the high part (ACCU1-H). For example, `L 17 / L 5 / /I` leaves 3 at the bottom and 2 at the top.

### Why does a comparison in series with a contact go inside brackets?

Because the comparison replaces the RLO instead of combining with it. Inside `A( … )` it is calculated separately and then combined with the contact.

## conversiones

### How do I scale an analog input to a percentage?

Convert the value to REAL (`ITD` and `DTR`), divide it by 27648 and multiply it by 100. With 13824 on the input, the result is 50.0 %.

### What is the difference between RND and TRUNC?

`RND` rounds to the nearest integer (3.6 → 4) and `TRUNC` cuts off the decimal part toward 0 (3.6 → 3). `RND+` rounds up and `RND-` rounds down.

### With MW10 = −1, why doesn't `L MW 10` leave −1 in the 32-bit accumulator?

Because `L` fills the high part with zeros, without extending the sign: ACCU1 is `DW#16#0000FFFF`. To treat it as a negative DINT you have to use `ITD`.

## saltos

### What are the RLO and /FC when a JC does not jump?

RLO = 1 and /FC = 0. `JC` and `JCN` always leave the RLO at 1 and close the chain, whether they jump or not. That is why an assignment right after a `JC` that does not jump writes a 1.

### How do you make a loop in STL?

With `LOOP`: it subtracts 1 from the low part of ACCU1 and jumps to the label as long as it does not reach 0. Check first that the counter is not 0, because it would become 65535 and the loop would repeat 65535 times.

### How do I make a transfer happen only when a condition is met?

By jumping over it: `A I0.0 / JCN NO / L 5 / T MW10 / NO: NOP 0`. `T` does not depend on the RLO, so putting the condition in front of it is not enough.

## indirecto

### What is indirect addressing in STL?

Using an address that is stored somewhere else, instead of writing it fixed in the code. For example, `L MW [MD 30]` loads the word whose address is held in MD30. It is used to step through tables in a loop.

### How is a P# pointer calculated?

Byte number × 8 + bit number. `P#10.0` is 80 and `P#2.0` is 16: that is why adding `P#2.0` to a pointer moves it on by one word.

### Does the MCR replace an emergency stop?

No. The MCR only makes the `=` assignments and the `T` transfers of one area of the program write 0. An emergency stop has to be wired separately, outside the program.

## equivalencias

### Can any STL program be converted to Ladder?

No. Jumps inside a network, standalone accumulator operations, indirect addressing or `O` without an operand in unusual positions have no Ladder drawing, and those networks stay in STL. The other way round, yes: all Ladder has its STL.

### How are two contacts in parallel written in STL?

With `O a / O b`. If they are then in series with another contact, `A c` is added: `O a / O b / A c` calculates (a ∨ b) ∧ c.

### How do you put a comparison in series with a contact in STL?

Inside brackets: `A I 2.0 / A( / L MW 30 / L 500 / >I / )`.

## ejercicios

### How do you program a star-delta start in a PLC?

With a latched line contactor, an on-delay timer (SD in English mnemonics) that starts with the line contactor, the star contactor while the time has not elapsed and the delta contactor when it has. Star and delta are interlocked so that they never come on together (exercise P04).

### How do you control a tank with a low-level and a high-level probe?

With Set and Reset: Set the pump when the level drops below the minimum and Reset it when it reaches the maximum or the stop button is pressed. Between the two probes the pump keeps its state: this is hysteresis (exercise P01).

### Which timer should I use for a staircase light timer?

The extended pulse (SE in English mnemonics, SV in German): the light stays on for the full time even if the button is released, and each new press starts the time again (exercise P02).

## nemotecnica

### What is the difference between the German and the English mnemonics?

They are two ways of writing the same instructions. In German, `U` is AND, `E` an input and `A` an output; in English, `A` is AND, `I` an input and `Q` an output. The program is the same.

### How is "SE T 1" (German on-delay) written in English mnemonics?

`SD T 1`. In English, `SE` is the extended pulse, which in German is `SV`.

### What do LAD, FBD and STL mean?

They are the English names of the languages: LAD, ladder diagram (KOP in German); FBD, function block diagram (FUP), and STL, statement list (AWL).
