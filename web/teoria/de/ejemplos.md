# Beispiele zu KOP und AWL

> Deutsche Übersetzung der Beispiele aus `src/content/ejemplos_KOP_AWL.md`: die der Website und die 31 Beispiele der App („Beispiele“).
> - Die Kennungen (E01, Q01…) bleiben gleich: Die Seiten werden daraus erzeugt (`web/teoria/paginas.ts`).
> - Die Tests (```yaml) werden hier nicht wiederholt: Die interaktiven Felder lesen sie immer aus der spanischen Datei.
> - Auf der Website wird der erste ```text-Block eines Beispiels mit KOP-Modell durch die Zeichnung ersetzt.

---

### E09 — Doppelzuweisung (typischer Fehler)

**Aufgabe**: A4.0 soll mit E0.0 **oder** mit E0.1 einschalten. Dieses Programm **ist falsch**.
**Konzepte**: Das PAA wird am Ende des Zyklus geschrieben, deshalb zählt nur die letzte Zuweisung.

```awl
      U     E 0.0
      =     A 4.0
      U     E 0.1
      =     A 4.0       // überschreibt die vorherige
```

### E09b — Doppelzuweisung, korrigiert

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

### Q12 — Reihenfolge der Netzwerke

E0.0 wird auf 1 gesetzt. Welchen Wert hat A4.0 am Ende des ersten Zyklus? Und am Ende des zweiten?

```awl
      U     M 0.0
      =     A 4.0
      U     E 0.0
      =     M 0.0
```

<details><summary>Lösung</summary>

- **Zyklus 1: A4.0 = 0.** M0.0 wird erst berechnet, nachdem es verwendet wurde.
- **Zyklus 2: A4.0 = 1.**

</details>

### Q06 — Bytereihenfolge

Wenn nur E0.0 = 1 ist, welchen Wert hat MW30? Und wenn nur E1.0 = 1 ist?

```awl
      L     EW 0
      T     MW 30
```

<details><summary>Lösung</summary>

- Nur E0.0 = 1: **256**. EB0 ist das höherwertige Byte von EW0.
- Nur E1.0 = 1: **1**.

</details>

### E24 — BCD-Ziffernrad und Anzeige

**Aufgabe**:
- EW2 = 3-stelliges Ziffernrad in BCD. MW70 = sein ganzzahliger Wert.
- MW72 = MW70 + 1.
- AW6 = MW72 in BCD, für eine 3-stellige Anzeige.

**Konzepte**: BCD und Bytereihenfolge. AW6 = AB6 (höherwertiges Byte) + AB7 (niederwertiges Byte).

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

### E01 — Schließer und Öffner

**Aufgabe**: Die Leuchte A4.0 leuchtet, wenn E0.0 = 1 ist, und die Leuchte A4.1, wenn E0.0 = 0 ist.
**Konzepte**: Ein Kontakt **fragt** den Zustand eines Bits **ab** (§1.3 und §6.2 der Referenz).

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

### E02 — UND (Reihe) und ODER (parallel)

**Aufgabe**: A4.0 = E0.0 UND E0.1. A4.1 = E0.0 ODER E0.1.

```text
     E0.0     E0.1      A4.0
 |---| |------| |-------( )

     E0.0               A4.1
 |---| |----+-----------( )
 |   E0.1   |
 |---| |----+
```

```awl
// Netzwerk 1: UND
      U     E 0.0
      U     E 0.1
      =     A 4.0
// Netzwerk 2: ODER
      O     E 0.0
      O     E 0.1
      =     A 4.1
```

### E03 — NAND, NOR und Exklusiv-ODER

**Aufgabe**: A4.0 = NAND, A4.1 = NOR und A4.2 = XOR von E0.0 und E0.1.

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
// XOR (AWL hat dafür die Anweisung X)
      X     E 0.0
      X     E 0.1
      =     A 4.2
```

### E04 — „UND vor ODER“ mit `O` ohne Operand

**Aufgabe**: A4.0 = (E0.0 ∧ E0.1) ∨ (E0.2 ∧ E0.3).
**Konzepte**: das Bit OR und die Erstabfrage (§7.4 der Referenz).

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

### E05 — Klammern: UND mit einer ODER-Gruppe

**Aufgabe**: A4.1 = E0.0 ∧ (E0.1 ∨ E0.2).

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

### Q01 — AWL wird der Reihe nach ausgewertet

Mit E0.0 = 1, E0.1 = 0 und E0.2 = 0: Welchen Wert hat A4.0?

```awl
      U     E 0.0
      O     E 0.1
      U     E 0.2
      =     A 4.0
```

<details><summary>Lösung</summary>

**A4.0 = 0**. Berechnet wird (E0.0 ∨ E0.1) ∧ E0.2 = (1 ∨ 0) ∧ 0 = 0, nicht 1 ∨ (0 ∧ 0).

</details>

### Q02 — `O` ohne Operand

Dieselben Eingänge wie in Q01. Welchen Wert hat A4.0?

```awl
      U     E 0.0
      O
      U     E 0.1
      U     E 0.2
      =     A 4.0
```

<details><summary>Lösung</summary>

**A4.0 = 1**. Berechnet wird E0.0 ∨ (E0.1 ∧ E0.2).

</details>

### E06 — Ein und Aus mit Selbsthaltung (Aus hat Vorrang)

**Aufgabe**: E0.0 = Ein (Taster, Schließer). E0.1 = Halt (**Taster als Öffner verdrahtet**, in Ruhe also 1). A4.0 = Motor.
**Konzepte**: Selbsthaltung, Sicherheit durch die Verdrahtung und Vorrang für Aus.

```text
     E0.0 Ein      E0.1 Halt (Öffner)   A4.0 Motor
 |---| |------+-------| |---------------( )
 |            |
 |   A4.0     |
 |---| |------+
```

```awl
      U(
      O     E 0.0       // Ein
      O     A 4.0       // Rückführung (Selbsthaltung)
      )
      U     E 0.1       // Halt als Öffner: 1 = nicht gedrückt
      =     A 4.0
```

### E07 — Ein und Aus mit Setzen/Rücksetzen (Aus hat Vorrang)

**Konzepte**: Den Vorrang bestimmt die **Reihenfolge**: Die letzte Anweisung gewinnt.

```text
     E0.0                 A4.0
 |---| |------------------(S)
     E0.1 (Öffner)        A4.0
 |---|/|------------------(R)
```

```awl
      U     E 0.0
      S     A 4.0
      UN    E 0.1       // Halt gedrückt (E0.1 = 0)
      R     A 4.0       // R am Ende → Aus hat Vorrang
```

### E08 — Ein und Aus mit Vorrang für Ein

**Aufgabe**: wie E07, aber wenn beide gedrückt werden, soll Ein gewinnen.

```text
     E0.1 (Öffner)        A4.0
 |---|/|------------------(R)
     E0.0                 A4.0
 |---| |------------------(S)      ← S am Ende
```

```awl
      UN    E 0.1
      R     A 4.0
      U     E 0.0
      S     A 4.0
```

### E10 — Positive und negative Flanke

**Aufgabe**: M10.1 = Impuls für einen Zyklus beim Drücken von E0.0. M10.3 = Impuls für einen Zyklus beim Loslassen.
**Konzepte**: Jede Flanke braucht **ihren eigenen** Flankenmerker (M10.0 und M10.2).

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

### E11 — Stromstoßschalter (ein Taster schaltet ein und aus)

**Aufgabe**: Jeder Druck auf E0.0 ändert den Zustand der Leuchte A4.0.
**Konzepte**: Flanke + Selbsthaltung mit zwei Zweigen.

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
      =     M 10.1      // Impuls
      U     M 10.1
      UN    A 4.0
      O
      UN    M 10.1
      U     A 4.0
      =     A 4.0
```

### E11b — Stromstoßschalter mit Exklusiv-ODER (nur AWL)

```awl
      U     E 0.0
      FP    M 10.0
      =     M 10.1
      U     M 10.1
      X     A 4.0       // Impuls XOR aktueller Zustand
      =     A 4.0
```

### E12 — Einschaltverzögerung (SE / S_EVERZ)

**Aufgabe**: A4.0 schaltet 5 s nach dem Einschalten von E0.0 ein, und nur wenn E0.0 noch 1 ist. E0.1 setzt zurück. MW10 enthält die Restzeit binär und MW12 in BCD.

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
      L     T 1         // Restzeit (binär, in Einheiten von 10 ms)
      T     MW 10
      LC    T 1         // Restzeit in BCD mit Zeitbasis
      T     MW 12
      U     T 1
      =     A 4.0
```

### E13 — Ausschaltverzögerung (SA / S_AVERZ)

**Aufgabe**: Der Lüfter A4.1 läuft, solange E0.2 = 1 ist, und nach dem Ausschalten noch 3 s weiter.

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

### E14 — Impuls (SI / S_IMPULS)

**Aufgabe**: A4.2 = 1 für höchstens 2 s, solange E0.3 gedrückt ist.

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

### E15 — Verlängerter Impuls (SV / S_VIMP)

**Aufgabe**: Ein kurzer Impuls an E0.4 hält A4.3 für 2 s eingeschaltet. Ein neuer Impuls startet die Zeit neu.

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

### E16 — Speichernde Einschaltverzögerung (SS / S_SEVERZ)

**Aufgabe**: Ein Impuls an E0.5 schaltet A4.4 nach 3 s ein, und A4.4 bleibt an, bis das Rücksetzen E0.6 gedrückt wird.

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

### E17 — Blinker (1 s an / 1 s aus) mit zwei Zeiten

**Aufgabe**: Solange E0.7 = 1 ist, blinkt die Leuchte A4.5.
**Konzepte**: Jede Zeit startet die andere neu. Alternative: den Taktmerker verwenden (§2.6 der Referenz).

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
      SE    T 6         // Aus-Zeit
      U     T 6
      L     S5T#1S
      SE    T 7         // Ein-Zeit
      U     T 6
      =     A 4.5
```

### Q10 — Falsch geladener Zeitwert

Was passiert, wenn E0.0 eingeschaltet wird?

```awl
      U     E 0.0
      L     500
      SE    T 1
      U     T 1
      =     A 4.0
```

<details><summary>Lösung</summary>

Die CPU geht in **STOP**. 500 = W#16#01F4 ist kein gültiges S5TIME (die Ziffer F ist kein BCD), also tritt ein Programmierfehler auf (OB121). Solange E0.0 = 0 ist, passiert nichts, weil der Wert erst beim Starten der Zeit ausgewertet wird.

</details>

### E18 — Parkhaus mit 10 Plätzen

**Aufgabe**:
- E1.0 = ein Auto fährt ein; E1.1 = ein Auto fährt aus.
- E1.2 lädt eine Anfangsbelegung von 5; E1.3 setzt den Zähler auf null.
- MW30 = Belegung. A5.0 = „BESETZT“ (Belegung ≥ 10). A5.1 = mindestens ein Auto ist da.

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
      L     10          // AKKU2 = Belegung, AKKU1 = 10
      >=I
      =     A 5.0
      U     Z 1
      =     A 5.1
```

### E19 — Abwärtszählen

**Aufgabe**: E1.4 lädt 3. Jeder Impuls an E1.5 zählt um 1 herunter. A5.2 = Ende des Zählens (Wert 0). MW32 = Wert in BCD.

```awl
      U     E 1.4
      L     C#3
      S     Z 2
      U     E 1.5
      ZR    Z 2
      UN    Z 2         // Q = 0 → Wert = 0
      =     A 5.2
      LC    Z 2
      T     MW 32
```

### E20 — Füllstandsvergleich

**Aufgabe**: MW30 = Füllstand in Litern.
- A5.4 = hoher Füllstand (> 500).
- A5.5 = niedriger Füllstand (< 100).
- A5.6 = Alarm hoher Füllstand, nur wenn E2.0 (Freigabe) = 1.

**Konzepte**: Der Vergleich **ersetzt** das VKE, deshalb steht er in Klammern, wenn er mit einem Kontakt verknüpft wird.

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

### E21 — Addition mit Überlauferkennung

**Aufgabe**: MW44 = MW40 + MW42. M1.0 = diese Addition ist übergelaufen. M1.1 = Überlaufspeicher (wird mit E0.0 gelöscht).

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

### E22 — Ganzzahlige Multiplikation und Division (Quotient und Rest)

**Konzepte**: `*I` hinterlässt ein DINT in AKKU1. `/I` hinterlässt den Quotienten in AKKU1-L und den Rest in AKKU1-H.

```awl
      L     MW 50
      L     MW 52
      *I
      T     MD 54       // vollständiges Produkt (32 Bit)
      L     MW 50
      L     MW 52
      /I
      T     MW 58       // Quotient
      SRD   16          // holt den Rest (AKKU1-H) in den niederwertigen Teil
      T     MW 60       // Rest
```

### Q03 — Hängt T vom VKE ab?

Mit E0.0 = 0: Welche Werte haben MW30 und A4.0?

```awl
      U     E 0.0
      L     5
      T     MW 30
      =     A 4.0
```

<details><summary>Lösung</summary>

**MW30 = 5** (T ist unbedingt) und **A4.0 = 0** (L und T ändern das VKE nicht).

</details>

### E23 — Analogwert in % skalieren (REAL)

**Aufgabe**: PEW256 (0..27648) → MD100 = 0,0..100,0 %. A5.7 = Alarm über 80 %.

**In KOP** ist es eine Kette von Boxen, verbunden über ENO → EN, mit Zwischenergebnissen in Merkern oder temporären Daten:

```text
 I_DI  (IN = PEW256        → OUT = MD104)
 DI_R  (IN = MD104         → OUT = MD108)
 DIV_R (IN1 = MD108, IN2 = 27648.0 → OUT = MD112)
 MUL_R (IN1 = MD112, IN2 = 100.0   → OUT = MD100)
 CMP >R (IN1 = MD100, IN2 = 80.0)  → Spule A5.7
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

### E25 — REAL → DINT: RND, TRUNC, RND+ und RND−

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

### E26 — Addieren oder subtrahieren je nach Wahlschalter (Sprünge)

**Aufgabe**: Wenn E0.0 = 1 ist, MW34 = MW30 + MW32. Sonst MW34 = MW30 − MW32.

```text
 Netzwerk 1:  E0.0          SUMA
          |---| |-----------(JMP)
 Netzwerk 2:  SUB_I (MW30 − MW32 → MW34), danach unbedingter (JMP) nach FIN
 Netzwerk 3:  LABEL SUMA → ADD_I (MW30 + MW32 → MW34)
 Netzwerk 4:  LABEL FIN
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

### E27 — Fakultät mit LOOP

**Aufgabe**: MD100 = MW30! Ist MW30 ≤ 1, ist das Ergebnis 1.
**Konzepte**: `LOOP` verringert AKKU1-L und springt, solange er ≠ 0 ist. Der **Fall 0 muss abgefangen werden**: Sonst würde `LOOP` von 0 auf 65535 gehen und die Schleife weitere 65535 Mal wiederholen.

```awl
      L     L#1
      T     MD 100      // Ergebnis = 1
      L     MW 30       // N
      L     1
      <=I               // N <= 1?
      SPB   FIN
      L     MW 30
SIG:  T     MW 32       // Schleifenzähler
      L     MD 100
      L     MW 32
      *D
      T     MD 100
      L     MW 32
      LOOP  SIG
FIN:  NOP   0
```

### Q08 — SPB springt nicht

Welchen Wert hat A4.0 in jedem Schritt? Der Eingang ändert sich: erst E0.0 = 1, dann E0.0 = 0 und dann wieder E0.0 = 1.

```awl
      U     E 0.0
      SPB   FIN
      =     A 4.0
FIN:  NOP   0
```

<details><summary>Lösung</summary>

- Mit E0.0 = 1: Es wird gesprungen, A4.0 **wird nicht geschrieben** und bleibt 0.
- Mit E0.0 = 0: **Es wird nicht gesprungen, aber SPB hinterlässt VKE = 1**, deshalb wird A4.0 = 1.
- Wieder mit E0.0 = 1: Es wird gesprungen, und A4.0 **bleibt 1**.

</details>

### E29 — Tabelle mit indirekter Adressierung aufsummieren

**Aufgabe**: MW40 = Summe der 10 Wörter MW100, MW102, …, MW118.
**Konzepte**: Bereichszeiger (`P#Byte.Bit` = Byte × 8 + Bit), `L MW [MD 30]` und `LOOP` (§7.19 der Referenz). Gibt es nur in AWL: In KOP gibt es keine Darstellung dafür.

```awl
      L     P#100.0
      T     MD 30       // Zeiger auf das erste Element (100 × 8 = 800)
      L     0
      T     MW 40       // Summe = 0
      L     10          // 10 Elemente
SIG:  T     MW 34       // Schleifenzähler
      L     MW 40
      L     MW [MD 30]
      +I
      T     MW 40
      L     MD 30
      L     P#2.0       // ein Wort weiter (2 Bytes = 16)
      +D
      T     MD 30
      L     MW 34
      LOOP  SIG
```

### C01 — In AWL umsetzen

```text
     E0.0              E0.2        A4.0
 |---| |-----+---------|/|---------( )
 |   E0.1    |
 |---| |-----+
```

<details><summary>Lösung</summary>

Zwei gültige Lösungen: `U( / O E0.0 / O E0.1 / ) / UN E0.2 / = A4.0` und, wenn man die Auswertung der Reihe nach ausnutzt, die folgende.
</details>

```awl
      O     E 0.0
      O     E 0.1
      UN    E 0.2
      =     A 4.0
```

### C04 — In KOP umsetzen (Vergleicher und Zeit)

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

<details><summary>Lösung</summary>

```text
     E2.0      CMP >I              T2
 |---| |------+-------+-------+-----------+           A4.3
 |     MW30 --|IN1    |       | S_EVERZ   |
 |     100  --|IN2    |       |S         Q|-----------( )
 |            +-------+       |           |
 |                   S5T#3S --|TW         |
 |                            +-----------+
```
(Der Ausgang des Vergleichers geht an den Anschluss S der Zeit.)
</details>

### E28 — Ampel mit Schrittmerkern (wie im GRAFCET)

**Aufgabe**: Mit dem Schalter E0.0 = 1 durchläuft die Ampel einen Dauerzyklus:
- **Grün** A4.0 für 5 s,
- **Gelb** A4.1 für 2 s,
- **Rot** A4.2 für 5 s.

Mit E0.0 = 0 geht alles aus.

**Konzepte**: Jeder Schritt ist ein Merker (M20.0, M20.1, M20.2). Eine Transition aktiviert den nächsten Schritt mit `S` und deaktiviert den aktuellen mit `R`. Die Ausgänge werden **nur einmal** zugewiesen, am Ende.

```awl
// Anfangsschritt: Start und kein Schritt aktiv
      U     E 0.0
      UN    M 20.0
      UN    M 20.1
      UN    M 20.2
      S     M 20.0
// Schritt 1: Grün (5 s)
      U     M 20.0
      L     S5T#5S
      SE    T 10
      U     T 10
      S     M 20.1
      R     M 20.0
// Schritt 2: Gelb (2 s)
      U     M 20.1
      L     S5T#2S
      SE    T 11
      U     T 11
      S     M 20.2
      R     M 20.1
// Schritt 3: Rot (5 s)
      U     M 20.2
      L     S5T#5S
      SE    T 12
      U     T 12
      S     M 20.0
      R     M 20.2
// Halt: alle Schritte zurücksetzen
      UN    E 0.0
      R     M 20.0
      R     M 20.1
      R     M 20.2
// Ausgänge
      U     M 20.0
      =     A 4.0
      U     M 20.1
      =     A 4.1
      U     M 20.2
      =     A 4.2
```

### P01 — Behälter füllen mit Hysterese

**Aufgabe**:
- E0.2 = Minimalsonde (1 = das Wasser steht über dem Minimum).
- E0.3 = Maximalsonde (1 = das Wasser erreicht das Maximum).
- E0.1 = Halt (Öffner).

Die Pumpe A4.0 läuft an, wenn der Füllstand unter das Minimum fällt, und hält beim Erreichen des Maximums an. Zwischen den beiden Sonden behält sie ihren Zustand. Der Halt-Taster stoppt sie.

<details><summary>Lösung</summary>

Setzen unter dem Minimum; Rücksetzen beim Maximum oder mit dem Halt-Taster (das Rücksetzen steht danach: Aus hat Vorrang).
</details>

```awl
      UN    E 0.2
      S     A 4.0
      U     E 0.3
      R     A 4.0
      UN    E 0.1
      R     A 4.0
```

### P02 — Treppenhausautomat

**Aufgabe**: Ein Impuls an E0.0 schaltet das Licht A4.0 für 30 s ein. Wird erneut gedrückt, während es leuchtet, beginnen die 30 s von vorn.

<details><summary>Lösung</summary>

Verlängerter Impuls (SV): Er startet bei jeder Flanke neu.
</details>

```awl
      U     E 0.0
      L     S5T#30S
      SV    T 1
      U     T 1
      =     A 4.0
```

### P03 — Verpacken: Meldung alle 5 Teile

**Aufgabe**: E1.0 = Teilesensor. Sind 5 Teile angekommen, leuchtet die Meldung A5.0 für 2 s, und der Zähler geht automatisch auf 0 zurück.

<details><summary>Lösung</summary>

Vorwärtszähler + Vergleich ≥ 5, der einen verlängerten Impuls von 2 s startet und den Zähler zurücksetzt.
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

### P04 — Stern-Dreieck-Anlauf

**Aufgabe**:
- E0.0 = Ein; E0.1 = Halt (Öffner).
- A4.0 = Netzschütz (KM1), A4.1 = Stern (KM2), A4.2 = Dreieck (KM3).

Bei Ein ziehen Netz und Stern an. Nach 5 s fällt der Stern ab und das Dreieck zieht an. Stern und Dreieck dürfen **nie** gleichzeitig anziehen (gegenseitige Verriegelung).

<details><summary>Lösung</summary>

Netz mit Selbsthaltung; Einschaltverzögerung von 5 s; Stern = Netz ∧ ¬T1 ∧ ¬Dreieck; Dreieck = Netz ∧ T1 ∧ ¬Stern.
</details>

```awl
// Netz (Selbsthaltung)
      U(
      O     E 0.0
      O     A 4.0
      )
      U     E 0.1
      =     A 4.0
// Sternzeit
      U     A 4.0
      L     S5T#5S
      SE    T 1
// Stern
      U     A 4.0
      UN    T 1
      UN    A 4.2
      =     A 4.1
// Dreieck
      U     A 4.0
      U     T 1
      UN    A 4.1
      =     A 4.2
```
