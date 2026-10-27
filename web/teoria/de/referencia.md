# Referenz KOP und AWL

<!--
Deutsche Übersetzung von `src/content/referencia_KOP_AWL.md`, für die Website (`npm run web:teoria`) und für die App („Lernen“).
- Die Nummerierung der Abschnitte bleibt gleich: Die Seiten der Website werden daraus erzeugt (`web/teoria/paginas.ts`).
- Die Kapitel 9 und 10 verwendet nur die App.
-->

> **Wozu dieses Dokument dient**
> - Lernstoff für die Prüfung.
> - Funktionale Spezifikation des Simulators der Übungs-App. Alles, was hier als *Verhalten* beschrieben ist, muss der Simulator nachbilden.
>
> **Konventionen**
> - **Deutsche** Mnemonik: `U`, `O`, `E`, `A`, `M`, `Z`... Die englischen Entsprechungen stehen in §11.
> - Referenz-CPU: eine **CPU mit 2 Akkumulatoren**. Die Unterschiede zu CPUs mit 4 Akkumulatoren werden genannt, wo sie wichtig sind.
> - „KOP“ = Kontaktplan. Im Englischen heißt er LAD.
> - „AWL“ = Anweisungsliste. Im Englischen heißt sie STL.
> - In den KOP-Plänen in ASCII ist `|` die linke Stromschiene.

---

## 1. Wie die SPS arbeitet

### 1.1 Der Zyklus

Die CPU bearbeitet das Programm zyklisch. In jedem Zyklus:

1. **Sie liest die Eingänge.** Sie kopiert den Zustand der physischen Eingänge in das **Prozessabbild der Eingänge (PAE)**.
2. **Sie bearbeitet das Programm.** Sie führt den **OB1** und alle Bausteine aus, die er aufruft (FC, FB...), Anweisung für Anweisung und von oben nach unten.
3. **Sie schreibt die Ausgänge.** Sie kopiert das **Prozessabbild der Ausgänge (PAA)** auf die physischen Ausgänge.
4. **Interne Aufgaben.** Sie bearbeitet die Kommunikation (PG, HMI) und die Eigendiagnose und beginnt wieder bei Schritt 1.

```text
   ┌────────────┐   ┌───────────────────┐   ┌─────────────┐   ┌──────────────┐
──►│ PAE lesen  │──►│ OB1 bearbeiten    │──►│ PAA ausgeben│──►│ Kommunikation│──┐
   │ (Eingänge) │   │ (Anwenderprogr.)  │   │ (Ausgänge)  │   │ Diagnose     │  │
   └────────────┘   └───────────────────┘   └─────────────┘   └──────────────┘  │
        ▲                                                                       │
        └───────────────────────────────────────────────────────────────────────┘
```

Die Zykluszeit wird überwacht. Die Grenze liegt standardmäßig bei **150 ms** und wird in den Eigenschaften der CPU eingestellt. Wird sie überschritten, wird der OB80 aufgerufen, und wenn der OB80 nicht vorhanden ist, geht die CPU in STOP. Eine Endlosschleife (zum Beispiel ein Rücksprung, der nie endet) führt genau dazu.

Die Zeiten laufen **asynchron** zum Programm: Sie werden vom Betriebssystem aktualisiert, nicht vom Zyklus.

### 1.2 Praktische Folgen (oft gefragt)

| Tatsache | Folge |
|---|---|
| Das PAE wird einmal zu Beginn des Zyklus gelesen | Ein Eingang hat während des ganzen Zyklus denselben Wert, auch wenn er sich mitten im Zyklus physisch ändert |
| Das PAA wird am Ende geschrieben | Wird derselbe Ausgang zweimal zugewiesen, **zählt nur die letzte Zuweisung** (Doppelzuweisung) |
| Das Programm läuft der Reihe nach ab | Was ein Netzwerk berechnet, sehen **die folgenden Netzwerke im selben Zyklus**. Die vorherigen sehen es erst im **nächsten Zyklus** |
| Ausgänge können gelesen werden | `U A 4.0` liest das PAA, also den letzten Wert, den das Programm geschrieben hat. So funktioniert die Selbsthaltung |
| Direkter Peripheriezugriff (`PEW`, `PAW`) | Umgeht das Prozessabbild: liest oder schreibt die Baugruppe genau in diesem Moment |

### 1.3 Sicherheitsverdrahtung: physischer Kontakt ≠ Kontakt im Programm

- Ein **Kontakt im Programm** **fragt** nur den Zustand eines Bits **ab**: ob es 1 oder 0 ist. Er weiß nicht, wie der Taster verdrahtet ist.
- **Halt**-Taster, Not-Halt und Sicherheits-Endschalter werden als **Öffner** verdrahtet. In Ruhe ist der Eingang 1. Bricht der Draht, fällt der Eingang auf 0 und die Maschine hält an (drahtbruchsicher).
- Deshalb **wird ein Halt-Taster mit Öffner im Programm mit einem Schließer abgefragt** (`U E 0.1`): Der Motor darf laufen, solange der Eingang 1 ist.

| Physischer Taster | Zustand des Eingangs in Ruhe | Kontakt im Programm für „laufen, solange NICHT gedrückt“ |
|---|---|---|
| Ein, Schließer | 0 | — (für „wenn gedrückt“ wird ein Schließer `U` verwendet) |
| Halt, **Öffner** | **1** | **Schließer** (`U E 0.1`) |
| Halt, Schließer (nicht empfohlen) | 0 | Öffner (`UN E 0.1`) |

### 1.4 Betriebszustände und Anlauf der CPU

- **Betriebsarten**: RUN, RUN-P (RUN mit Programmierung), STOP und MRES (Urlöschen). Sie werden mit dem Betriebsartenschalter der CPU gewählt.
- **Status-LEDs**:
  - SF: Sammelfehler.
  - BF: Busfehler.
  - DC5V: Stromversorgung.
  - FRCE: Forceauftrag aktiv.
  - RUN und STOP: aktuelle Betriebsart.
- **Anlauf (Neustart / Warmstart)**: Der **OB100** wird einmal bearbeitet, danach beginnt der Zyklus des OB1. Bei diesem Anlauf:
  - werden die **nicht remanenten** Merker, Zeiten und Zähler auf 0 gesetzt;
  - wird das PAA auf 0 gesetzt;
  - behalten die **remanenten** Daten ihren Wert.

---

## 2. Speicherbereiche (Operanden)

### 2.1 Überblick

| Bereich | Deutsch | Englisch | Inhalt | Zugriff im Programm | Mögliche Zugriffe |
|---|---|---|---|---|---|
| Eingänge | **E** | I | Prozessabbild der Eingänge (PAE) | Lesen. Schreiben ist möglich, wird aber im nächsten Zyklus überschrieben | `E`, `EB`, `EW`, `ED` |
| Ausgänge | **A** | Q | Prozessabbild der Ausgänge (PAA) | Lesen und Schreiben | `A`, `AB`, `AW`, `AD` |
| Merker | **M** | M | Allgemeiner interner Speicher | Lesen und Schreiben | `M`, `MB`, `MW`, `MD` |
| Zeiten | **T** | T | Zeiten (zum Beispiel T0..T255) | Zeitoperationen | `T n` |
| Zähler | **Z** | C | Zähler (0..999) | Zähloperationen | `Z n` |
| Datenbausteine | **DB / DI** | DB / DI | Globale Daten (DB) oder Instanzdaten (DI) | Lesen und Schreiben | `DBX`, `DBB`, `DBW`, `DBD` / `DIX`... |
| Lokaldaten | **L** | L | Temporäre Variablen des laufenden Bausteins | Lesen und Schreiben | `L`, `LB`, `LW`, `LD` |
| Peripherie | **PE / PA** | PI / PQ | Direkter Zugriff auf die Baugruppen, ohne Prozessabbild | Lesen (PE) und Schreiben (PA) | `PEB`, `PEW`, `PED`, `PAB`, `PAW`, `PAD` (**kein Bitzugriff**) |

### 2.2 Bit, Byte, Wort und Doppelwort

| Format | Größe | Beispiel | Bedeutung des Beispiels |
|---|---|---|---|
| Bit | 1 Bit | `E 0.3` | Eingang, Byte 0, Bit 3 (Bits 0 bis 7) |
| Byte (B) | 8 Bit | `MB 10` | Merkerbyte 10 |
| Wort (W) | 16 Bit | `MW 10` | Bytes MB10 und MB11 |
| Doppelwort (D) | 32 Bit | `MD 10` | Bytes MB10, MB11, MB12 und MB13 |

**Bytereihenfolge (Big Endian)**: Das Byte mit der **niedrigsten Adresse ist das höchstwertige**.

```text
                     MD 10
 ┌──────────────────────────────────────────────┐
 │        MW 10          │        MW 12         │
 ├───────────┬───────────┼───────────┬──────────┤
 │   MB 10   │   MB 11   │   MB 12   │  MB 13   │
 │ (Bits 31…24)│(Bits 23…16)│(Bits 15…8)│(Bits 7…0)│   ← Position in MD10
 └───────────┴───────────┴───────────┴──────────┘
   MW10 = MB10·256 + MB11        (MB10 ist das HIGH-Byte von MW10)
```

Position jedes Bits in einem Wort, zum Beispiel `EW 0`:

| Bit von `EW 0` | 15 | 14 | … | 8 | 7 | … | 0 |
|---|---|---|---|---|---|---|---|
| Physisches Bit | E0.7 | E0.6 | … | **E0.0** | E1.7 | … | **E1.0** |

> **Klassische Falle**: Ist nur `E 0.0` = 1, dann ist `EW 0` = 256 (W#16#0100), nicht 1. Ist nur `E 1.0` = 1, ist `EW 0` = 1.

**Überlappungen**: `MW 10` und `MW 11` teilen sich das Byte `MB 11`. Damit keine Daten überschrieben werden, verwendet man Wörter in Zweierschritten (`MW10`, `MW12`...) und Doppelwörter in Viererschritten (`MD20`, `MD24`...).

### 2.3 E/A-Adressen

- **Steckplatzorientierte Adressierung (Standard)**: Im Baugruppenträger 0 ist Steckplatz 1 die Stromversorgung, Steckplatz 2 die CPU, Steckplatz 3 die Anschaltungsbaugruppe (IM) und die Steckplätze 4 bis 11 die Signalbaugruppen.
  - **Digitale** Baugruppen: Anfangsbyte = (Steckplatz − 4) × 4. Zum Beispiel belegt Steckplatz 4 E0.0..E3.7, und Steckplatz 5 beginnt bei Byte 4.
  - **Analoge** Baugruppen: Anfangsadresse = 256 + (Steckplatz − 4) × 16. Zum Beispiel belegt Steckplatz 4 PEW256..PEW270.
- **Kompakt-CPUs** (in Übungsgeräten sehr verbreitet): Die integrierte E/A liegt meist bei E124.0..E126.7 und A124.0..A125.7, die analogen Kanäle bei PEW752.. / PAW752... Prüfe sie immer in der **Hardwarekonfiguration**, denn sie lässt sich ändern.
- **Analogwerte**: Der Nennbereich ist **0..27648** und entspricht zum Beispiel 0..10 V oder 4..20 mA. Über 27648 liegt der Übersteuerungsbereich (bis 32511). Der Wert **32767** zeigt einen Überlauf oder Drahtbruch an.

### 2.4 Merker (M)

Merker sind der „Bit-Arbeitsspeicher“ des Programmierers. Sie werden verwendet als:

- **Hilfsmerker**: Zwischenergebnisse, die an mehreren Stellen gebraucht werden.
- **Schrittmerker**: In Ablaufsteuerungen und GRAFCET ist jeder Schritt ein Merker, der mit S gesetzt und mit R rückgesetzt wird.
- **Flankenmerker**: der Speicher, den `FP` und `FN` brauchen. **Für jede Flanke ein eigener Merker, der für nichts anderes verwendet wird.**
- **Zahlenwerte**: `MW` für INT, `MD` für DINT oder REAL.

**Remanente Merker**: Sie behalten ihren Wert nach einem Spannungsausfall oder einem Übergang STOP→RUN. Das wird unter *Eigenschaften der CPU → Remanenz* eingestellt. Bei vielen CPUs sind standardmäßig **MB0..MB15** remanent.

**Taktmerker**: ein Merkerbyte, dessen Bits sich von selbst ändern, jedes mit einer festen Frequenz. Damit lassen sich Leuchten ohne Zeiten blinken lassen (§2.6).

### 2.5 Lokaldaten (L) und Datenbausteine (DB)

- **L (temporäre Daten)**: Sie existieren nur, während der Baustein läuft. **Zu Beginn des Bausteins ist ihr Wert undefiniert**, deshalb müssen sie geschrieben werden, bevor sie gelesen werden. Im OB1 enthalten die ersten 20 Bytes (LB0..LB19) die Startinformation des OB, deshalb beginnen die temporären Daten des Anwenders bei LB20.
- **Globale DBs**: Der Zugriff erfolgt mit der vollständigen Adresse (`DB1.DBW 0`) oder indem man den DB zuerst öffnet (`AUF DB 1`) und dann `DBW 0`, `DBX 2.0` usw. verwendet.
- **Instanz-DB (DI)**: der eigene Speicher jedes Aufrufs eines FB. Dort werden seine Parameter und seine statischen Variablen (STAT) gespeichert.

### 2.6 Taktmerker

Der **Taktmerker** ist ein Merkerbyte, das die CPU selbst schreibt: Jedes seiner 8 Bits schwingt mit einer festen Frequenz und ist die Hälfte der Periode 0 und die andere Hälfte 1. Damit lassen sich Leuchten blinken lassen und Aktionen in regelmäßigen Abständen wiederholen, ohne Zeiten zu programmieren.

**So wird er aktiviert**:
- In der echten CPU: *Eigenschaften der CPU → Zyklus/Taktmerker*. Das Kästchen anhaken, das Byte wählen (zum Beispiel MB100) und die Hardwarekonfiguration laden.
- Im Simulator: Schaltfläche **Hardware** → CPU → *Ciclo / marca de ciclo* (die Oberfläche ist auf Spanisch). Standardmäßig wird MB0 verwendet, aber jedes Byte kann gewählt werden.

| Bit | 7 | 6 | 5 | 4 | 3 | 2 | 1 | 0 |
|---|---|---|---|---|---|---|---|---|
| Periodendauer (s) | 2,0 | 1,6 | 1,0 | 0,8 | 0,5 | 0,4 | 0,2 | 0,1 |
| Frequenz (Hz) | 0,5 | 0,625 | 1 | 1,25 | 2 | 2,5 | 5 | 10 |

<!-- cronograma -->

Mit MB100 als Taktmerker hat `M 100.5` eine Periodendauer von 1 s: 0,5 s auf 0 und 0,5 s auf 1. Das heißt, er blinkt mit 1 Hz.

**Typische Anwendungen**:
- **Blinkleuchte**: Der Taktmerker wird in Reihe mit der Bedingung geschaltet. `U E 0.0 / U M 100.5 / = A 4.0` lässt A4.0 mit 1 Hz blinken, solange E0.0 = 1 ist.
- **Zwei Blinkrhythmen mit derselben Leuchte**: langsam mit `M 100.7` (0,5 Hz) für eine Warnung und schnell mit `M 100.3` (2 Hz) für einen Alarm.
- **Periodische Aktion**: `M 100.5` liefert eine steigende Flanke pro Sekunde. Mit einem Zähler (`ZV`) zählt man Sekunden, und mit `FP` führt man etwas einmal pro Sekunde aus.

**Achtung**:
- **Das Programm darf dieses Byte nur lesen.** Die CPU überschreibt es in jedem Zyklus, deshalb geht alles verloren, was das Programm hineinschreibt. Der Simulator warnt, wenn das Programm in dieses Byte schreibt.
- Das Byte muss frei bleiben: Verwende es für nichts anderes, auch nicht als Teil eines Wortes (`MW 99` und `MW 100` enthalten `MB 100`).
- Für genaue Zeitmessungen ist er nicht geeignet: Wenn die Bedingung erfüllt wird, kann das Bit mitten in seiner Periode stehen, deshalb kann das erste Blinken kürzer sein. Für genaue Verzögerungen verwendet man Zeiten (§6.6).
- Im Simulator wird das Byte zu Beginn jedes Zyklus aktualisiert, bevor die Eingänge gelesen werden. Wird der Taktmerker deaktiviert oder das Byte geändert, wird das alte Byte auf 0 gesetzt.

---

## 3. Datentypen und Konstanten

### 3.1 Elementare Datentypen

| Typ | Bits | Wertebereich | Beispielkonstante (AWL) |
|---|---|---|---|
| BOOL | 1 | 0 / 1 | (Bits werden nicht mit `L` geladen) |
| BYTE | 8 | 0..255 | `B#16#1F` |
| WORD | 16 | 0..FFFF | `W#16#00FF`, `2#0000000011111111`, `C#123` (BCD), `B#(1,2)` |
| DWORD | 32 | 0..FFFF FFFF | `DW#16#00010000`, `B#(1,2,3,4)` |
| CHAR | 8 | ASCII-Zeichen | `'A'` |
| INT | 16 | −32768..32767 | `123`, `-5` |
| DINT | 32 | −2147483648..2147483647 | `L#100000`, `L#-1` |
| REAL | 32 | ±1,175495e−38..±3,402823e+38 (IEEE 754) | `1.5`, `2.764800e+004` |
| S5TIME | 16 | 0 ms..2 h 46 min 30 s | `S5T#5S`, `S5T#1M30S`, `S5T#500MS` |
| TIME | 32 | ±24 Tage 20 h 31 min 23 s 647 ms (in ms) | `T#1M30S`, `T#500MS` |
| DATE | 16 | 1990-01-01..2168-12-31 (Tage seit 1990) | `D#2026-10-13` |
| TIME_OF_DAY | 32 | 0:00:00.000..23:59:59.999 (ms seit Mitternacht) | `TOD#12:30:00.000` |

- **Zusammengesetzte Datentypen**: DATE_AND_TIME (8 Bytes in BCD), STRING[n] (n+2 Bytes), ARRAY, STRUCT und UDT.
- **Parametertypen**: TIMER, COUNTER, BLOCK_FC, BLOCK_FB, BLOCK_DB, POINTER (6 Bytes) und ANY (10 Bytes).

### 3.2 BCD (binär codierte Dezimalzahl)

In BCD ist jede Gruppe von 4 Bits (Nibble) eine Dezimalziffer von 0 bis 9. Zum Beispiel ist `W#16#0123` in BCD **123**. BCD verwenden Ziffernräder (Vorwahlschalter), Anzeigen sowie Zeitwerte (S5TIME) und Zählwerte.

- **BCD im Wort (3 Stellen mit Vorzeichen)**: Die Bits 11..0 sind die drei Ziffern und die Bits 15..12 das Vorzeichen (`0000` positiv, `1111` negativ). Bereich ±999.
- **BCD im Doppelwort (7 Stellen mit Vorzeichen)**: Bereich ±9 999 999.
- Eine Ziffer von A bis F **ist kein gültiges BCD**. Zum Beispiel löst `BTI` auf `W#16#00A1` einen **BCD-Wandlungsfehler** aus (OB121), und wenn der OB121 nicht vorhanden ist, geht die CPU in STOP.

### 3.3 Internes Format von S5TIME

```text
 Bit  15 14 | 13 12 | 11 … 8 | 7 … 4 | 3 … 0
      x  x  | Basis | Hunderte| Zehner | Einer      (Wert 0..999 in BCD)
```

| Zeitbasis (Bits 13–12) | Auflösung | Bereich |
|---|---|---|
| 00 | 10 ms | 10 ms – 9 s 990 ms |
| 01 | 100 ms | 100 ms – 1 min 39 s 900 ms |
| 10 | 1 s | 1 s – 16 min 39 s |
| 11 | 10 s | 10 s – 2 h 46 min 30 s |

Der Editor wählt automatisch die feinste Zeitbasis, in die der Wert passt:

- `S5T#5S` = 500 × 10 ms → **W#16#0500**
- `S5T#12S` = 120 × 100 ms → **W#16#1120**
- `S5T#2M` = 120 × 1 s → **W#16#2120**

> **Falle**: `L 500` sind **keine** 5 Sekunden. 500 ist binär W#16#01F4 und enthält die Ziffer F, ist also kein gültiges BCD und löst einen Fehler aus. Man muss `L S5T#5S` oder `L W#16#0500` schreiben.

### 3.4 REAL

REAL-Zahlen folgen dem 32-Bit-Standard IEEE 754. Zwei Dinge sind zu beachten:

- Um Ganzzahlen mit REAL zu verrechnen, muss man sie vorher umwandeln: **INT → DINT → REAL** (`ITD` und dann `DTR`).
- Zwei REAL-Zahlen vergleicht man besser nicht mit `==R`, sondern mit einer Toleranz.

---

## 4. Symbolische Adressierung

- Die **Symboltabelle** gibt jedem Operanden einen Namen, einen Datentyp und einen Kommentar. Zum Beispiel: `"Ein"` → E 0.0, BOOL, „Ein-Taster, Schließer“.
- Im Code stehen globale Symbole **in Anführungszeichen** (`U "Ein"`), und die lokalen Variablen des Bausteins beginnen mit **#** (`U #Halt`).
- Im Editor: *Ansicht → Symbolische Darstellung* und *Ansicht → Anzeigen mit → Symbolinformation*.

---

## 5. Programmstruktur (Bausteine)

### 5.1 Bausteinarten

| Baustein | Was er ist | Eigener Speicher |
|---|---|---|
| **OB** | Organisationsbaustein. Wird vom Betriebssystem aufgerufen: Zyklus, Anlauf, Alarme oder Fehler | Temporäre Daten (L) |
| **FC** | Funktion. Code mit Parametern | Nein: nur temporäre Daten |
| **FB** | Funktionsbaustein. Code mit Parametern **und Gedächtnis** | Ja: ein **Instanz-DB** für jeden Aufruf |
| **DB** | Datenbaustein (global oder Instanz) | Er ist selbst Daten, immer remanent |
| **SFC / SFB** | Systemfunktionen und Systemfunktionsbausteine, die in der CPU enthalten sind | — |
| **UDT** | Anwenderdefinierter Datentyp | — |

### 5.2 Wichtige OBs

| OB | Wann er bearbeitet wird |
|---|---|
| OB1 | Zyklisch (Hauptprogramm) |
| OB10 | Uhrzeitalarm (Datum und Uhrzeit) |
| OB20 | Verzögerungsalarm |
| OB35 | Weckalarm (standardmäßig alle 100 ms) |
| OB40 | Prozessalarm (Flanke an einer alarmfähigen Baugruppe) |
| OB80 | Zeitfehler (Zykluszeit überschritten) |
| OB82 | Diagnosealarm einer Baugruppe |
| OB85 / OB86 / OB87 | Programmablauffehler / Ausfall eines Baugruppenträgers oder der dezentralen Peripherie / Kommunikationsfehler |
| OB100 | Anlauf (Neustart) |
| OB121 | Programmierfehler (zum Beispiel ungültiges BCD, nicht vorhandener Baustein) |
| OB122 | Peripheriezugriffsfehler |

> Tritt ein Fehler auf und ist der zugehörige Fehler-OB **nicht geladen**, geht die CPU in **STOP**.

### 5.3 Variablendeklaration eines Bausteins

| Abschnitt | FC | FB | Wofür |
|---|---|---|---|
| IN | ✓ | ✓ | Eingangsparameter |
| OUT | ✓ | ✓ | Ausgangsparameter |
| IN_OUT | ✓ | ✓ | Parameter, die gelesen und geschrieben werden |
| STAT | — | ✓ | Statische Variablen: Sie werden im Instanz-DB gespeichert und behalten ihren Wert zwischen zwei Aufrufen |
| TEMP | ✓ | ✓ | Temporäre Daten: zu Beginn undefiniert |

### 5.4 Aufrufe

```text
// FC mit Parametern (AWL)
      CALL  FC     1
       Ein  :=E0.0
       Halt :=E0.1
       Motor:=A4.0

// FB mit seinem Instanz-DB
      CALL  FB     1 , DB     1
       Eingang:=E0.2
       Ausgang:=A4.1

// FC ohne Parameter
      UC    FC     2              // unbedingter Aufruf
      U     E      0.3
      CC    FC     3              // bedingter Aufruf: nur wenn VKE = 1
```

So sieht eine allgemeine FC in einer **AWL-Quelle** aus (eine Textdatei mit den Bausteinen; die Anweisungen enden mit `;`):

```text
FUNCTION FC 1 : VOID
TITLE = Allgemeines Ein/Aus
VAR_INPUT
  Ein : BOOL ;
  Halt : BOOL ;
END_VAR
VAR_IN_OUT
  Motor : BOOL ;
END_VAR
BEGIN
NETWORK
TITLE = Selbsthaltung
      U(    ;
      O     #Ein;
      O     #Motor;
      )     ;
      U     #Halt;
      =     #Motor;
END_FUNCTION
```

In KOP ist ein Aufruf eine **Box** mit EN/ENO, und die Parameter sind ihre Anschlüsse.

---

## 6. KOP — Kontaktplan

### 6.1 Begriffe und Regeln

- **Netzwerk**: die Programmeinheit. Jedes Netzwerk hat einen Titel, einen Kommentar und seine Schaltung.
- **Stromschiene**: links. Der „Strom“ fließt von links nach rechts.
- **Kontakt**: **fragt** den Zustand eines Bits **ab**.
  - Schließer `--| |--` leitet, wenn das Bit 1 ist.
  - Öffner `--|/|--` leitet, wenn das Bit 0 ist.
- **Reihenschaltung** = UND. **Parallelschaltung** = ODER.
- **Spule**: **schreibt** das Ergebnis der Verknüpfung links von ihr (das VKE) in ein Bit.
- **Box**: eine Funktion mit dem Freigabeeingang **EN** und dem Ausgang **ENO**. ENO = 1, wenn EN = 1 ist und die Operation fehlerfrei ausgeführt wurde.

**Regeln für den Aufbau**:

- Die Ausgangselemente (Spulen und abschließende Boxen) stehen rechts. Am Ende eines Netzwerks können **mehrere Spulen parallel** stehen.
- Der Konnektor `--(#)--` und einige Boxen können mitten in einem Zweig stehen.
- Strom darf nicht von rechts nach links fließen, und Zweige dürfen nicht offen bleiben.
- Ein Sprungziel (`LABEL`) steht immer **am Anfang eines Netzwerks**.
- Hat ein in AWL geschriebenes Netzwerk keine grafische Darstellung, bleibt es beim Umschalten der Ansicht in AWL.

**Online-Beobachtung**: Stromfluss wird **grün durchgezogen** angezeigt, kein Stromfluss **blau gestrichelt**.

### 6.2 Bitverknüpfungen

| KOP-Symbol | Name | Funktion | AWL |
|---|---|---|---|
| `--\| \|--` | Schließer | Leitet, wenn der Operand = 1 | `U op` |
| `--\|/\|--` | Öffner | Leitet, wenn der Operand = 0 | `UN op` |
| `--\|NOT\|--` | Negieren | Kehrt den Stromfluss (VKE) um | `NOT` |
| `--( )` | Spule | Operand := VKE | `= op` |
| `--(#)--` | Konnektor | Speichert das Zwischen-VKE in einem Bit und macht weiter | `= op` (in der Mitte) |
| `--(S)` | Setzen | Wenn VKE = 1 → Operand := 1 | `S op` |
| `--(R)` | Rücksetzen | Wenn VKE = 1 → Operand := 0 | `R op` |
| Box `SR` | Flipflop, **rücksetzdominant** | S setzt, R setzt zurück; sind beide = 1, gewinnt R | `U s / S op / U r / R op` |
| Box `RS` | Flipflop, **setzdominant** | Sind beide = 1, gewinnt S | `U r / R op / U s / S op` |
| `--(P)--` | Positive Flanke des VKE | 1 für **einen Zyklus**, wenn das VKE von 0 auf 1 wechselt | `FP Merker` |
| `--(N)--` | Negative Flanke des VKE | 1 für einen Zyklus, wenn das VKE von 1 auf 0 wechselt | `FN Merker` |
| Box `POS` / `NEG` | Flanke eines Operanden | Erkennt die Flanke eines bestimmten Bits (mit seinem Merker M_BIT) | (Code mit `FP`/`FN`) |
| `--(SAVE)` | VKE sichern | Kopiert das VKE in das Bit BIE | `SAVE` |

### 6.3 Verknüpfungen mit Kontakten

```text
 UND                              ODER
     E0.0     E0.1     A4.0           E0.0               A4.0
 |---| |------| |------( )        |---| |----+-----------( )
                                  |   E0.1   |
                                  |---| |----+

 NAND                             NOR
     E0.0     E0.1           A4.0      E0.0              A4.0
 |---| |------| |----|NOT|---( )   |---| |----+--|NOT|---( )
                                   |   E0.1   |
                                   |---| |----+

 Exklusiv-ODER (XOR): a·b̄ + ā·b
     E0.0     E0.1     A4.2
 |---| |------|/|---+--( )
 |   E0.0     E0.1  |
 |---|/|------| |---+
```

| a | b | UND | ODER | NAND | NOR | XOR | XNOR |
|---|---|---|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 1 | 1 | 0 | 1 |
| 0 | 1 | 0 | 1 | 1 | 0 | 1 | 0 |
| 1 | 0 | 0 | 1 | 1 | 0 | 1 | 0 |
| 1 | 1 | 1 | 1 | 0 | 0 | 0 | 1 |

### 6.4 Spulen, Selbsthaltung und Flipflops

**Selbsthaltung**: Ein und Aus mit Vorrang für Aus.

```text
     E0.0 (Ein)     E0.1 (Halt, Öffner)        A4.0 (Motor)
 |---| |------+-------| |-----------------------( )
 |            |
 |   A4.0     |
 |---| |------+
```

**Setzen/Rücksetzen mit Spulen**: Vorrang hat die Spule, die **zuletzt** bearbeitet wird.

```text
     E0.0           A4.0
 |---| |------------(S)
     E0.1           A4.0
 |---|/|------------(R)          ← R steht danach: rücksetzdominant
```

**Box SR / RS**:

```text
                 A4.0                               A4.0
             +---------+                        +---------+
     E0.0    |   SR    |                E0.1    |   RS    |
 |---| |-----|S       Q|---           |---|/|---|R       Q|---
     E0.1    |         |                E0.0    |         |
 |---|/|-----|R        |              |---| |---|S        |
             +---------+                        +---------+
 SR: beide = 1 → Q = 0             RS: beide = 1 → Q = 1
```

> **Eine Spule `( )` pro Operand.** Hat dasselbe Bit zwei Spulen `( )`, zählt nur die letzte. Spulen `S` und `R` für dasselbe Bit dürfen mehrfach vorkommen: Das ist normal.

### 6.5 Flanken

`--(P)--` trägt oben einen **Flankenmerker**, in dem das VKE des vorherigen Zyklus gespeichert wird. Sein Ausgang ist nur in dem Zyklus 1, in dem das VKE von 0 auf 1 wechselt.

```text
     E0.0     M10.0        M10.1
 |---| |-------(P)---------( )        M10.1 = Impuls für einen Zyklus beim Drücken von E0.0
```

Zeitdiagramm:

<!-- cronograma -->

Typische Anwendungen: Tastendrücke zählen, der **Stromstoßschalter** (ein einziger Taster schaltet ein und aus) und eine Aktion nur einmal ausführen.

### 6.6 Zeiten

**Boxen und Anschlüsse** (deutsche Namen, englische in Klammern):

```text
                 T1
             +-----------+
   E0.0      | S_EVERZ   |                         A4.0
 |---| |-----|S         Q|-------------------------( )
             |           |
 S5T#5S -----|TW     DUAL|-- MW10   (Restzeit binär)
             |           |
   E0.1      |        DEZ|-- MW12   (Restzeit in BCD mit Zeitbasis)
 |---| |-----|R          |
             +-----------+
```

| Anschluss | Bedeutung |
|---|---|
| S | Start. Je nach Typ startet die Zeit mit einer **Flanke** oder wirkt auf den Pegel |
| TW (TV) | Zeitwert im Format S5TIME |
| R | Rücksetzen: setzt die Zeit auf 0 und Q = 0. Hat **Vorrang** |
| Q | Zustand der Zeit, wie `U T1` |
| DUAL (BI) | Restzeit binär, ohne Zeitbasis |
| DEZ (BCD) | Restzeit in BCD mit Zeitbasis (Format S5TIME) |

| Box | Spule | AWL | Typ | Verhalten |
|---|---|---|---|---|
| S_IMPULS (S_PULSE) | `(SI)` | `SI` | **Impuls** | Q = 1 ab der Flanke von S, höchstens für die Zeit TW. **Fällt S vorher ab, wird Q sofort 0** |
| S_VIMP (S_PEXT) | `(SV)` | `SV` | **Verlängerter Impuls** | Q = 1 für die ganze Zeit TW, auch wenn S abfällt. Eine neue Flanke von S **startet die Zeit neu** |
| S_EVERZ (S_ODT) | `(SE)` | `SE` | **Einschaltverzögerung** | Q = 1, wenn TW abgelaufen ist **und S noch 1 ist**. Fällt S ab, hält die Zeit an und Q = 0 |
| S_SEVERZ (S_ODTS) | `(SS)` | `SS` | **Speichernde Einschaltverzögerung** | Startet mit der Flanke von S und läuft weiter, auch wenn S abfällt. Q = 1 am Ende und **bleibt bis zum Rücksetzen 1** |
| S_AVERZ (S_OFFDT) | `(SA)` | `SA` | **Ausschaltverzögerung** | Q = 1, sobald S = 1. **Fällt** S ab, läuft TW ab und danach wird Q = 0. Wird S während des Ablaufs wieder 1, hält die Zeit an und Q bleibt 1 |

Zeitdiagramme (TW = t):

<!-- cronograma -->

**Zeitspulen**: `T1 --(SE)` mit dem Wert `S5T#5S` darunter. Rückgesetzt wird mit einer Spule `--(R)` auf `T1`, und der Zustand wird mit einem Kontakt `T1 --| |--` abgefragt.

**Hinweise**:
- Jede Zeit (T1, T2...) wird **nur an einer Stelle** im Programm gestartet.
- Der Wert TW wird bei der **Startflanke** übernommen.
- Die Zeit läuft von TW bis 0 herunter. Die Genauigkeit entspricht der Zeitbasis.
- Ist R = 1, bleibt die Zeit stehen, auch wenn S = 1 ist. Wird R wieder 0, startet sie erst bei einer **neuen Flanke** von S.

### 6.7 Zähler

```text
                 Z1
             +-----------+
   E1.0      | Z_VORW    |
 |---| |-----|ZV        Q|------------------( ) A5.1    (Q = 1, wenn Wert > 0)
   E1.2      |           |
 |---| |-----|S      DUAL|-- MW20   (Wert binär)
 C#5 --------|ZW      DEZ|-- MW22   (Wert in BCD)
   E1.3      |           |
 |---| |-----|R          |
             +-----------+
```

| Box | Funktion |
|---|---|
| Z_VORW (S_CU) | Vorwärtszähler: +1 bei jeder **steigenden Flanke** an ZV |
| Z_RUECK (S_CD) | Rückwärtszähler: −1 bei jeder steigenden Flanke an ZR |
| ZAEHLER (S_CUD) | Vorwärts- und Rückwärtszähler (hat ZV und ZR) |

| Anschluss | Bedeutung |
|---|---|
| ZV / ZR (CU / CD) | Vorwärts / rückwärts zählen (mit der Flanke) |
| S | **Steigende Flanke** → lädt den Wert ZW |
| ZW (PV) | Zählwert in BCD (`C#0`..`C#999`) |
| R | Rücksetzen über den Pegel → Wert = 0 |
| Q | 1, wenn der Wert größer als 0 ist |
| DUAL / DEZ | Aktueller Wert binär / in BCD |

- Bereich **0..999**: Der Zähler geht nicht unter 0 und nicht über 999.
- Bleibt der Eingang auf 1, **wird nicht mehrfach gezählt**: Für jede Einheit braucht es eine Flanke.
- Spulen: `(ZV)`, `(ZR)`, `(SZ)` (Zählwert setzen) und `(R)`.

### 6.8 Boxen mit EN/ENO

**Vergleicher** (sie wirken wie ein Kontakt: Man schaltet sie in Reihe oder parallel):

```text
         E2.0       CMP >I                    A5.6
 |-------| |-------+-------+------------------( )
                   |  >I   |
           MW30 ---|IN1    |
           500  ---|IN2    |
                   +-------+
```

| Gruppe | Boxen |
|---|---|
| INT vergleichen | `CMP ==I`, `<>I`, `>I`, `<I`, `>=I`, `<=I` |
| DINT / REAL vergleichen | ebenso mit `D` / `R` |
| Übertragen | `MOVE` (IN → OUT, mit 8, 16 oder 32 Bit) |
| INT-Arithmetik | `ADD_I`, `SUB_I`, `MUL_I`, `DIV_I` |
| DINT-Arithmetik | `ADD_DI`, `SUB_DI`, `MUL_DI`, `DIV_DI`, `MOD_DI` |
| REAL-Arithmetik | `ADD_R`, `SUB_R`, `MUL_R`, `DIV_R`, `ABS`, `SQR`, `SQRT`, `EXP`, `LN`, `SIN`, `COS`, `TAN`, `ASIN`, `ACOS`, `ATAN` |
| Umwandlung | `BCD_I`, `I_BCD`, `BCD_DI`, `DI_BCD`, `I_DI`, `DI_R`, `ROUND`, `TRUNC`, `CEIL`, `FLOOR`, `INV_I`, `INV_DI`, `NEG_I`, `NEG_DI`, `NEG_R` |
| Wortverknüpfung | `WAND_W`, `WOR_W`, `WXOR_W`, `WAND_DW`, `WOR_DW`, `WXOR_DW` |
| Schieben | `SHL_W`, `SHR_W`, `SHR_I`, `SHL_DW`, `SHR_DW`, `SHR_DI`, `ROL_DW`, `ROR_DW` |

- **ENO = 0**, wenn EN = 0 ist oder ein Fehler aufgetreten ist. Zum Beispiel `ADD_I` mit Überlauf oder `I_BCD` außerhalb von ±999.
- Boxen lassen sich **verketten**: ENO der einen → EN der nächsten.
- Es gibt kein `I_R`: Um von INT nach REAL zu kommen, verwendet man `I_DI` und danach `DI_R`.

### 6.9 Programmsteuerung

| Element | Funktion | AWL |
|---|---|---|
| `--(JMP)` mit Sprungziel | Springt, wenn VKE = 1. Ist sie direkt an der Stromschiene angeschlossen, springt sie immer | `SPB` / `SPA` |
| `--(JMPN)` | Springt, wenn VKE = 0 | `SPBN` |
| `LABEL` | Sprungziel, am Anfang eines Netzwerks | `ZIEL:` |
| `--(CALL)` | Ruft eine FC oder SFC ohne Parameter auf | `UC` / `CC` |
| `--(RET)` | Bedingtes Bausteinende | `BEB` |
| `--(OPN)` | Öffnet einen DB | `AUF` |
| `--(MCRA)`, `--(MCR<)`, `--(MCR>)`, `--(MCRD)` | Master Control Relay | `MCRA`, `MCR(`, `)MCR`, `MCRD` |

### 6.10 Statusbits als Kontakte

Kontakte `OV`, `OS`, `UO`, `BR`, `==0`, `<>0`, `>0`, `<0`, `>=0` und `<=0`. Sie fragen das Ergebnis der letzten Arithmetik- oder Vergleichsoperation ab (§7.2).

---

## 7. AWL — Anweisungsliste

### 7.1 Format

```text
[ZIEL:]  OPERATION   OPERAND         // Kommentar
 ENDE:   U           E 0.0           // UND mit Eingang 0.0
```

- Eine Anweisung pro Zeile. Der Code ist wie in KOP in **Netzwerke** gegliedert.
- **Sprungziele (Marken)**: bis zu 4 Zeichen, beginnen mit einem Buchstaben und enden mit `:`.
- Kommentare beginnen mit `//`. In AWL-Quellen endet jede Anweisung mit `;`.
- Leerzeichen zwischen Bereich und Adresse spielen keine Rolle: `E 0.0` ist dasselbe wie `E0.0`.

### 7.2 CPU-Register

| Register | Größe | Verwendung |
|---|---|---|
| **AKKU1**, **AKKU2** | 32 Bit | Akkumulatoren. `L` lädt in AKKU1, der bisherige Inhalt wandert in AKKU2. Die Operationen rechnen AKKU2 (op) AKKU1. CPUs mit 4 Akkus haben zusätzlich AKKU3 und AKKU4 |
| **AR1**, **AR2** | 32 Bit | Adressregister (indirekte Adressierung) |
| **DB / DI** | 16 Bit | Nummer des geöffneten globalen DB und des geöffneten Instanz-DB |
| **Statuswort** | 16 Bit (9 werden verwendet) | Siehe Tabelle |

**Statuswort**:

| Bit | Name | Englisch | Bedeutung |
|---|---|---|---|
| 0 | **/ER** | /FC | **Erstabfrage**. 0 = die nächste Verknüpfung beginnt eine neue Kette. 1 = Kette läuft |
| 1 | **VKE** | RLO | **Verknüpfungsergebnis** der Kette |
| 2 | **STA** | STA | **Status** des zuletzt abgefragten Bits (sein tatsächlicher Wert, vor einer Negation) |
| 3 | **OR** | OR | Speicher für „UND vor ODER“ (§7.4) |
| 4 | **OS** | OS | **Gespeicherter** Überlauf. Wird durch `SPS`, beim Aufruf eines Bausteins und am Bausteinende auf 0 gesetzt |
| 5 | **OV** | OV | Überlauf bei der **letzten** Arithmetikoperation |
| 6 | **A0** | CC0 | Anzeige 0 |
| 7 | **A1** | CC1 | Anzeige 1 |
| 8 | **BIE** | BR | Binärergebnis. Wird für ENO und `SAVE` verwendet |

**Bedeutung von A1/A0**:

| A1 | A0 | Nach Arithmetik | Nach Vergleich (AKKU2 mit AKKU1) | Nach Schieben |
|---|---|---|---|---|
| 0 | 0 | Ergebnis = 0 | AKKU2 = AKKU1 | zuletzt hinausgeschobenes Bit = 0 |
| 0 | 1 | Ergebnis < 0 | AKKU2 < AKKU1 | — |
| 1 | 0 | Ergebnis > 0 | AKKU2 > AKKU1 | zuletzt hinausgeschobenes Bit = 1 |
| 1 | 1 | Division durch 0 / ungültige REAL-Zahl | ungeordnet (ungültige REAL-Zahl) | — |

### 7.3 Bitverknüpfung: VKE, Erstabfrage und STA

Jede Verknüpfungsanweisung verknüpft **das aktuelle VKE** mit **dem Bit des Operanden**:

| Anweisung | Wenn /ER = 0 (Erstabfrage) | Wenn /ER = 1 (Kette läuft) |
|---|---|---|
| `U op` (UND) | VKE := op | VKE := VKE ∧ op |
| `UN op` (UND NICHT) | VKE := ¬op | VKE := VKE ∧ ¬op |
| `O op` (ODER) | VKE := op | VKE := VKE ∨ op |
| `ON op` (ODER NICHT) | VKE := ¬op | VKE := VKE ∨ ¬op |
| `X op` (Exklusiv-ODER) | VKE := op | VKE := VKE ⊕ op |
| `XN op` (Exklusiv-ODER NICHT) | VKE := ¬op | VKE := VKE ⊕ ¬op |

Nach jeder von ihnen gilt: **/ER := 1** und **STA := Wert des Operanden**.

**Anweisungen, die die Kette abschließen (/ER := 0)**, ohne das VKE zu ändern:
- `=`, `S` und `R`.
- Die Zeitoperationen (`SI`, `SV`, `SE`, `SS`, `SA`, `R T`, `FR T`).
- Die Zähloperationen (`ZV`, `ZR`, `S Z`, `R Z`).

Deshalb **lassen sich mehrere Zuweisungen** mit demselben VKE **aneinanderreihen**:

```awl
      U     E 0.0
      U     E 0.1
      =     A 4.0      // A4.0 := E0.0 ∧ E0.1
      =     A 4.1      // A4.1 bekommt dasselbe VKE
      S     M 0.0      // und setzt auch M0.0, wenn es 1 ist
```

**Anweisungen, die VKE und /ER NICHT verändern**: `L`, `T`, Arithmetik, Umwandlung, `TAK`, `INC`, `DEC`... Eine Verknüpfungskette kann „über sie hinweg“ weiterlaufen:

```awl
      U     E 0.0
      L     MW 10      // ändert das VKE nicht
      T     MW 12      // wird IMMER ausgeführt (T hängt nicht vom VKE ab)
      =     A 4.0      // A4.0 := E0.0
```

**Operationen direkt auf das VKE**:

| Anweisung | Wirkung |
|---|---|
| `NOT` | VKE := ¬VKE |
| `SET` | VKE := 1 (und /ER := 0) |
| `CLR` | VKE := 0 (und /ER := 0) |
| `SAVE` | BIE := VKE |

### 7.4 „UND vor ODER“: `O` ohne Operand und Klammern

AWL wertet **der Reihe nach** aus: `U E0.0 / O E0.1 / U E0.2` berechnet **(E0.0 ∨ E0.1) ∧ E0.2** und nicht E0.0 ∨ (E0.1 ∧ E0.2). Zum Gruppieren gibt es zwei Werkzeuge.

**a) `O` ohne Operand** trennt UND-Gruppen, die mit ODER verknüpft werden:

```awl
      U     E 0.0
      U     E 0.1
      O                 // (E0.0 ∧ E0.1)  ∨ ...
      U     E 0.2
      U     E 0.3
      =     A 4.0       // A4.0 = (E0.0 ∧ E0.1) ∨ (E0.2 ∧ E0.3)
```

Was intern passiert: `O` speichert das Ergebnis der ersten Gruppe im Bit **OR** und setzt /ER = 0. Solange OR = 1 ist, lassen die folgenden `U` und `UN` das VKE auf 1, weil das Ergebnis schon feststeht. `=` setzt OR := 0.

**b) Klammern**: `U(`, `UN(`, `O(`, `ON(`, `X(`, `XN(` ... `)`.

```awl
      U     E 0.0
      U(                // E0.0 ∧ ( ... )
      O     E 0.1
      O     E 0.2
      )
      =     A 4.1       // A4.1 = E0.0 ∧ (E0.1 ∨ E0.2)
```

- Beim Öffnen der Klammer werden das VKE, das Bit OR und die ausstehende Verknüpfung im **Klammerstack** gespeichert, und eine neue Kette beginnt (/ER = 0).
- Beim Schließen mit `)` wird das Gespeicherte zurückgeholt und mit dem VKE aus der Klammer verknüpft.
- Es sind **bis zu 7 Klammerebenen** erlaubt.

### 7.5 Zuweisung, Setzen und Rücksetzen

| Anweisung | Wirkung | Vorrang |
|---|---|---|
| `= op` | op := VKE, immer | — |
| `S op` | wenn VKE = 1 → op := 1 (bei VKE = 0 passiert nichts) | — |
| `R op` | wenn VKE = 1 → op := 0 | — |

Hat dasselbe Bit `S` und `R`, **gewinnt die Anweisung, die zuletzt bearbeitet wird**:

```awl
      U     E 0.0           // Ein
      S     A 4.0
      U     E 0.1           // Aus
      R     A 4.0           // R am Ende → rücksetzdominant (Aus hat Vorrang)
```

### 7.6 Flanken

| Anweisung | Pseudocode |
|---|---|
| `FP m` | `alt := m; m := VKE; VKE := VKE ∧ ¬alt` |
| `FN m` | `alt := m; m := VKE; VKE := ¬VKE ∧ alt` |

```awl
      U     E 0.0
      FP    M 10.0          // M10.0 = Flankenmerker (nur dafür)
      =     M 10.1          // M10.1 = 1 nur im Zyklus der Flanke
```

### 7.7 Zeiten in AWL

```awl
      U     E 0.0           // Startbedingung (VKE)
      L     S5T#5S          // Zeitwert → AKKU1
      SE    T 1             // Einschaltverzögerung (SI, SV, SE, SS oder SA)
      U     E 0.1
      R     T 1             // Rücksetzen
      L     T 1             // Restzeit binär (ohne Zeitbasis) → AKKU1
      T     MW 10
      LC    T 1             // Restzeit in BCD mit Zeitbasis (S5TIME) → AKKU1
      T     MW 12
      U     T 1             // Zustand Q der Zeit
      =     A 4.0
```

| Anweisung | Funktion |
|---|---|
| `SI T n` | Startet als Impuls (S_IMPULS) |
| `SV T n` | Startet als verlängerter Impuls (S_VIMP) |
| `SE T n` | Startet als Einschaltverzögerung (S_EVERZ) |
| `SS T n` | Startet als speichernde Einschaltverzögerung (S_SEVERZ) |
| `SA T n` | Startet als Ausschaltverzögerung (S_AVERZ) |
| `R T n` | Rücksetzen, wenn VKE = 1 |
| `FR T n` | Freigabe: Eine Flanke erlaubt einen Neustart ohne Flanke am Starteingang (selten verwendet) |
| `U T n` / `UN T n` / `O T n`... | Fragt den Zustand Q der Zeit ab |
| `L T n` / `LC T n` | Lädt die Restzeit binär / in BCD |

Die Startanweisung **verwendet den Wert in AKKU1** zum Zeitpunkt der Flanke. Deshalb steht das `L S5T#…` direkt davor.

### 7.8 Zähler in AWL

```awl
      U     E 1.0
      ZV    Z 1             // +1 bei steigender Flanke
      U     E 1.1
      ZR    Z 1             // −1 bei steigender Flanke
      U     E 1.2
      L     C#5             // Wert in BCD
      S     Z 1             // Flanke → lädt 5
      U     E 1.3
      R     Z 1             // Rücksetzen (über den Pegel)
      L     Z 1             // Wert binär
      T     MW 20
      LC    Z 1             // Wert in BCD
      T     MW 22
      U     Z 1             // 1, wenn Wert > 0
      =     A 5.1
```

### 7.9 Laden und Transferieren

| Anweisung | Wirkung |
|---|---|
| `L op` | **AKKU2 := AKKU1; AKKU1 := op**. Ein Byte oder Wort wird in den niederwertigen Teil von AKKU1 geladen, der Rest wird mit **Nullen** aufgefüllt (ohne Vorzeichenerweiterung) |
| `T op` | op := niederwertiger Teil von AKKU1 (1, 2 oder 4 Bytes je nach Operand). **Wird immer ausgeführt, unabhängig vom VKE**. Ändert die Akkus nicht |
| `LC T n` / `LC Z n` | Lädt den Wert einer Zeit oder eines Zählers in BCD |
| `L STW` / `T STW` | Liest oder schreibt das Statuswort |
| `L DBNO` / `L DBLG` | Nummer / Länge des geöffneten DB |

```awl
      L     MW 10           // AKKU1 = MW10             AKKU2 = (vorher)
      L     MW 12           // AKKU1 = MW12             AKKU2 = MW10
      +I                    // AKKU1 = MW10 + MW12      AKKU2 = MW10 (bei 2 Akkus unverändert)
      T     MW 14           // MW14 := AKKU1-L
```

> **T ist unbedingt.** Um nur bei erfüllter Bedingung zu transferieren, muss man darüber springen: `U E0.0 / SPBN NEIN / L 5 / T MW10 / NEIN: NOP 0`.
>
> **Nullen, kein Vorzeichen.** `L MW 10` mit MW10 = −1 (W#16#FFFF) ergibt AKKU1 = DW#16#0000FFFF. Um den Wert als DINT zu behandeln, verwendet man `ITD`.

### 7.10 Arithmetik

| Anweisung | Operation | Ergebnis |
|---|---|---|
| `+I`, `-I` | AKKU2-L ± AKKU1-L (INT) | AKKU1-L |
| `*I` | AKKU2-L × AKKU1-L | **Ganzer AKKU1, als DINT** (OV = 1, wenn es nicht in INT passt) |
| `/I` | AKKU2-L ÷ AKKU1-L | **Quotient in AKKU1-L, Rest in AKKU1-H** |
| `+D`, `-D`, `*D` | DINT | AKKU1 |
| `/D` | DINT, ganzzahliger Quotient | AKKU1 (der Rest geht verloren) |
| `MOD` | DINT-Rest | AKKU1. Das Vorzeichen des Rests ist das des Dividenden |
| `+R`, `-R`, `*R`, `/R` | REAL | AKKU1 |
| `ABS`, `SQR`, `SQRT`, `EXP`, `LN`, `SIN`, `COS`, `TAN`, `ASIN`, `ACOS`, `ATAN` | REAL-Funktionen auf AKKU1 (Winkel im Bogenmaß) | AKKU1 |
| `+ Konst` | AKKU1 + Konstante | AKKU1. **Ändert das Statuswort nicht** |
| `INC n` / `DEC n` | Addiert oder subtrahiert n **nur im niederwertigen Byte** von AKKU1 (AKKU1-LL) | Ohne Übertrag und ohne Statusbits |

- Mit 2 Akkus **ändert sich AKKU2** nach der Operation **nicht**.
- Die Ganzzahldivision **schneidet in Richtung 0 ab**: `-17 /I 5` ergibt den Quotienten −3 und den Rest −2.

**Statusbits nach `+I`** (die übrigen INT- und DINT-Operationen funktionieren genauso):

| Mathematisches Ergebnis | Gespeicherter Wert | A1 | A0 | OV | OS |
|---|---|---|---|---|---|
| = 0 | 0 | 0 | 0 | 0 | — |
| −32768 ≤ r < 0 | r | 0 | 1 | 0 | — |
| 0 < r ≤ 32767 | r | 1 | 0 | 0 | — |
| r > 32767 (positiver Überlauf) | r − 65536 (wird negativ) | 0 | 1 | **1** | **1** |
| r < −32768 (negativer Überlauf) | r + 65536 (wird positiv) | 1 | 0 | **1** | **1** |
| r = −65536 | 0 | 0 | 0 | **1** | **1** |

Beispiel: 30000 + 10000 → gespeichert wird **−25536**, mit OV = 1 und OS = 1.

- **Division durch 0**: A1 = A0 = 1, OV = OS = 1. Das Ergebnis ist ungültig.
- **REAL**: Ein unendliches Ergebnis setzt OV und OS auf 1. Ein ungültiges Ergebnis (NaN) setzt zusätzlich A1 = A0 = 1.

### 7.11 Vergleich

`==I`, `<>I`, `>I`, `<I`, `>=I`, `<=I` vergleichen **AKKU2 mit AKKU1**: `L a / L b / >I` bedeutet „a > b“. Die Varianten `…D` vergleichen DINT und die Varianten `…R` vergleichen REAL.

- Das Ergebnis (1 oder 0) **wird ins VKE geschrieben und ersetzt das bisherige**: Es wird nicht damit verknüpft. Um es in Reihe mit Kontakten zu verwenden, muss es **in Klammern** stehen:

```awl
      U     E 2.0
      U(
      L     MW 30
      L     500
      >I
      )
      =     A 5.6           // A5.6 = E2.0 ∧ (MW30 > 500)
```

- Der Vergleich setzt außerdem A1/A0 (§7.2), setzt OV = 0 und lässt /ER = 1. Die Kette kann mit `U`, `O`... weiterlaufen.

### 7.12 Umwandlung

| AWL | KOP | Umwandlung | Hinweise |
|---|---|---|---|
| `BTI` | `BCD_I` | 3-stelliges BCD → INT (AKKU1-L) | Ungültige Ziffer → BCD-Fehler (OB121) |
| `ITB` | `I_BCD` | INT → 3-stelliges BCD | Außerhalb von ±999 → OV = OS = 1, keine Umwandlung |
| `BTD` | `BCD_DI` | 7-stelliges BCD → DINT | |
| `DTB` | `DI_BCD` | DINT → 7-stelliges BCD | |
| `ITD` | `I_DI` | INT → DINT (erweitert das Vorzeichen) | |
| `DTR` | `DI_R` | DINT → REAL | Über 2²⁴ kann Genauigkeit verloren gehen |
| `RND` | `ROUND` | REAL → DINT, auf die nächste Ganzzahl gerundet | Im genauen Fall x,5 wird laut AWL-Handbuch zur geraden Zahl gerundet |
| `TRUNC` | `TRUNC` | REAL → DINT, in Richtung 0 abgeschnitten | 3,9 → 3 ; −3,9 → −3 |
| `RND+` | `CEIL` | REAL → DINT in Richtung +∞ | 3,2 → 4 ; −3,2 → −3 |
| `RND-` | `FLOOR` | REAL → DINT in Richtung −∞ | 3,2 → 3 ; −3,2 → −4 |
| `INVI` / `INVD` | `INV_I` / `INV_DI` | Einerkomplement (invertiert die Bits) | |
| `NEGI` / `NEGD` | `NEG_I` / `NEG_DI` | Zweierkomplement (ändert das Vorzeichen) | |
| `NEGR` | `NEG_R` | Ändert das Vorzeichen einer REAL-Zahl | |
| `CAW` | — | Tauscht die 2 Bytes von AKKU1-L | |
| `CAD` | — | Kehrt die Reihenfolge der 4 Bytes von AKKU1 um | |

**Typische Analogwertskalierung** (0..27648 → 0..100 %):

```awl
      L     PEW 256         // Rohwert (INT)
      ITD                   // INT → DINT
      DTR                   // DINT → REAL
      L     2.764800e+004
      /R
      L     1.000000e+002
      *R
      T     MD 60           // % als REAL
```

### 7.13 Wortverknüpfung und Schieben

| Anweisung | Wirkung |
|---|---|
| `UW`, `OW`, `XOW` | AKKU1-L := AKKU1-L (UND / ODER / Exklusiv-ODER) AKKU2-L. Mit einer Konstanten (`UW W#16#00FF`) wird mit der Konstanten verknüpft |
| `UD`, `OD`, `XOD` | Dasselbe mit 32 Bit |
| `SLW n` / `SRW n` | Schiebt AKKU1-L um n Bits nach links / rechts und füllt mit 0 auf |
| `SSI n` | Schiebt AKKU1-L nach rechts und behält das Vorzeichen |
| `SLD n` / `SRD n` / `SSD n` | Schieben mit 32 Bit |
| `RLD n` / `RRD n` | Rotiert AKKU1 um n Bits nach links / rechts |
| `RLDA` / `RRDA` | Rotiert 1 Bit über A1 |

- Ohne Operand wird die Anzahl der Stellen aus AKKU2-LL genommen.
- Nach einer Wortverknüpfung: A1 = (Ergebnis ≠ 0), A0 = 0 und OV = 0.
- Nach dem Schieben: A1 = zuletzt hinausgeschobenes Bit.

Beispiel: das niederwertige Byte eines Wortes ausblenden mit `L MW 10 / UW W#16#00FF / T MW 12`.

### 7.14 Akkumulatoroperationen

| Anweisung | Was sie macht |
|---|---|
| `TAK` | Tauscht AKKU1 und AKKU2 |
| `PUSH` | AKKU2 := AKKU1 |
| `POP` | AKKU1 := AKKU2 |
| `ENT`, `LEAVE` | Nur bei CPUs mit 4 Akkus |
| `INC n`, `DEC n` | Niederwertiges Byte von AKKU1 (0..255) |
| `+ n` | Addiert eine Konstante zu AKKU1 |
| `NOP 0`, `NOP 1` | Tun nichts (werden als Sprungziel verwendet) |

### 7.15 Sprünge

| Anweisung | Springt, wenn… | Wirkung auf die Statusbits |
|---|---|---|
| `SPA Ziel` | immer | keine |
| `SPB Ziel` | VKE = 1 | Setzt **immer** VKE := 1, /ER := 0, OR := 0, STA := 1 (ob gesprungen wird oder nicht) |
| `SPBN Ziel` | VKE = 0 | Wie SPB |
| `SPBB Ziel` | VKE = 1 (kopiert vorher das VKE in BIE) | Wie SPB, und BIE := VKE |
| `SPBNB Ziel` | VKE = 0 (kopiert vorher das VKE in BIE) | Wie SPBN, und BIE := VKE |
| `SPBI` / `SPBIN` | BIE = 1 / BIE = 0 | — |
| `SPO` | OV = 1 | — |
| `SPS` | OS = 1 | Setzt OS := 0 |
| `SPZ` | Ergebnis = 0 (A1 = 0, A0 = 0) | — |
| `SPN` | Ergebnis ≠ 0 | — |
| `SPP` | Ergebnis > 0 (A1 = 1, A0 = 0) | — |
| `SPM` | Ergebnis < 0 (A1 = 0, A0 = 1) | — |
| `SPPZ` | Ergebnis ≥ 0 | — |
| `SPMZ` | Ergebnis ≤ 0 | — |
| `SPU` | ungültig (A1 = 1, A0 = 1) | — |
| `LOOP Ziel` | AKKU1-L := AKKU1-L − 1; springt, wenn ≠ 0 | — |
| `SPL Ziel` | Sprungverteiler nach AKKU1-LL (mehrere `SPA` hintereinander) | — |

> **Falle**: Springt `SPB` nicht, bleibt das VKE auf **1**. `U E0.0 / SPB X / = A4.0` setzt A4.0 = 1, wenn E0.0 = 0 ist.
>
> **Falle mit `LOOP`**: Ist AKKU1-L beim Erreichen von `LOOP` gleich 0, wird er zu 65535, und der Schleifenrumpf läuft weitere 65535 Mal. Man muss vorher prüfen, dass der Zähler größer als 0 ist.

**Schleife mit `LOOP`**:

```awl
      L     5
SIG:  T     MW 10           // Schleifenzähler
      // ... Schleifenrumpf (verwendet MW10) ...
      L     MW 10
      LOOP  SIG             // MW10−1; wiederholt, solange ≠ 0
```

### 7.16 Statusbits als Operanden

`U OV`, `U OS`, `U BIE`, `U ==0`, `U <>0`, `U >0`, `U <0`, `U >=0`, `U <=0` und `U UO` (ungeordnet). Sie funktionieren auch mit `UN`, `O`, `ON`, `X` und `XN`.

```awl
      L     MW 40
      L     MW 42
      +I
      T     MW 44
      U     OV              // ist diese Addition übergelaufen?
      =     M 1.0
```

### 7.17 Bausteinende und Aufrufe

| Anweisung | Wirkung |
|---|---|
| `BE` | Bausteinende |
| `BEA` | Unbedingtes Bausteinende |
| `BEB` | Bausteinende, wenn VKE = 1. Bei VKE = 0 geht es weiter, mit VKE := 1 und /ER := 0 |
| `CALL` | Aufruf mit Parametern (§5.4) |
| `UC` / `CC` | Unbedingter / bedingter Aufruf, ohne Parameter |

### 7.18 Datenbausteine

```awl
      AUF   DB 1            // öffnet DB1 als globalen DB
      L     DBW 0           // DB1.DBW0
      T     MW 10
      U     DB1.DBX 2.0     // vollständige Adresse (öffnet ebenfalls DB1)
      =     A 4.0
```

### 7.19 Indirekte Adressierung (fortgeschritten)

- **Speicherindirekt**: Die Adresse steht in einem Merker oder einem Datum, im Zeigerformat. Zum Beispiel: `L MW [MD 30]` oder `U E [MD 34]`.
- **Registerindirekt**: `LAR1 P#M 100.0` und danach `L MW [AR1, P#2.0]`.
- Format des Bereichszeigers (32 Bit): Bytenummer × 8 + Bitnummer. Zum Beispiel entspricht `P#10.0` dem Wert 80.

Beispiel: MW100..MW118 mit einem Zeiger durchlaufen und aufsummieren.

```awl
      L     P#100.0
      T     MD 30           // Zeiger auf das erste Element
      L     0
      T     MW 40           // Summe = 0
      L     10              // 10 Elemente
SIG:  T     MW 34
      L     MW 40
      L     MW [MD 30]
      +I
      T     MW 40
      L     MD 30
      L     P#2.0           // nächstes Wort
      +D
      T     MD 30
      L     MW 34
      LOOP  SIG
```

### 7.20 MCR (Master Control Relay)

- `MCRA` aktiviert den MCR-Bereich und `MCRD` deaktiviert ihn.
- Innerhalb von `MCR(` … `)MCR` schreiben alle Zuweisungen `=` und alle Transfers `T` den Wert 0, wenn die Bedingung vor `MCR(` gleich 0 ist. `S` und `R` wirken dann nicht.
- **Es ersetzt keinen fest verdrahteten Not-Halt-Kreis.**

### 7.21 Zustandstabelle (Aufgaben von Hand lösen)

Man notiert Zeile für Zeile den Zustand von /ER, VKE, STA und OR. Beispiel mit E0.0 = 1, E0.1 = 0, E0.2 = 1 und E0.3 = 1:

| Anweisung | /ER vorher | STA | VKE nachher | OR | Kommentar |
|---|---|---|---|---|---|
| `U E 0.0` | 0 | 1 | 1 | 0 | Erstabfrage: VKE := 1 |
| `U E 0.1` | 1 | 0 | 0 | 0 | 1 ∧ 0 |
| `O` | 1 | 1 | 0 | 0 | OR := VKE (0); /ER := 0 |
| `U E 0.2` | 0 | 1 | 1 | 0 | Erstabfrage der 2. Gruppe |
| `U E 0.3` | 1 | 1 | 1 | 0 | 1 ∧ 1 |
| `= A 4.0` | 1 | 1 | 1 | 0 | **A4.0 = 1**; /ER := 0 (STA = geschriebener Wert) |

Mit E0.0 = E0.1 = 1 und E0.2 = E0.3 = 0: Nach `O` ist das Bit OR = 1. Die beiden folgenden `U` lassen das VKE auf 1, deshalb ist A4.0 = 1.

---

## 8. Entsprechungen KOP ↔ AWL

### 8.1 Elemente

| KOP | AWL |
|---|---|
| Schließer in Reihe | `U op` |
| Öffner in Reihe | `UN op` |
| Erster Kontakt einer Parallelschaltung einzelner Kontakte | `O op` (oder `U op`) |
| Schließer / Öffner parallel | `O op` / `ON op` |
| Spule `( )` | `= op` |
| `(S)` / `(R)` | `S op` / `R op` |
| `NOT` | `NOT` |
| `(#)` | `= op` (und die Verknüpfung geht weiter) |
| `(P)` / `(N)` | `FP m` / `FN m` |
| Vergleicher in Reihe | `U(` `L` `L` `>I` `)` |
| Zeitspule `(SE)` | `L S5T#…` + `SE T n` |
| Sprung `(JMP)` / `(JMPN)` | `SPB` / `SPBN` (oder `SPA`, wenn direkt an der Stromschiene) |
| `(RET)` | `BEB` |

### 8.2 Muster für Reihen- und Parallelschaltung

| Schaltung | AWL |
|---|---|
| a ∧ b | `U a / U b` |
| a ∨ b | `O a / O b` |
| (a ∨ b) ∧ c | `O a / O b / U c` (der Reihe nach) oder `U( / O a / O b / ) / U c` |
| a ∧ (b ∨ c) | `U a / U( / O b / O c / )` |
| (a ∧ b) ∨ (c ∧ d) | `U a / U b / O / U c / U d` oder `U( / U a / U b / ) / O( / U c / U d / )` |
| a ∧ ((b ∧ c) ∨ d) | `U a / U( / U b / U c / O d / )` |
| a ∧ (b ∨ (c ∧ d)) | `U a / U( / O b / O( / U c / U d / ) / )` |
| Mehrere Spulen parallel | Verknüpfung + `= x / = y / = z` |

### 8.3 Boxen mit EN/ENO

Wird eine Box mit EN in AWL übersetzt, erzeugt der Editor einen Sprung, der sie bei EN = 0 überspringt, und setzt BIE so, dass ENO anzeigt, ob ein Fehler aufgetreten ist. Vereinfachtes Schema von `ADD_I` mit EN:

```awl
      U     E 0.0           // EN
      SPBNB _001            // wenn EN = 0 → springen (und BIE := 0)
      L     MW 10
      L     MW 12
      +I
      T     MW 14
      UN    OV              // kein Überlauf…
      SAVE                  // …BIE := 1
      CLR
_001: U     BIE             // ENO = BIE
      =     A 4.0
```

> Nicht jede AWL lässt sich in KOP umwandeln. Zum Beispiel: Sprünge innerhalb eines Netzwerks, Akkumulatoroperationen (`TAK`, ein einzelnes `+I`), indirekte Adressierung oder `O` ohne Operand an ungewöhnlichen Stellen. Diese Netzwerke bleiben in AWL.

---

## 9. Typische Fehler und Prüfungsfallen

1. **Doppelzuweisung**: `= A4.0` an zwei Stellen. Nur die letzte zählt. Um Bedingungen zusammenzufassen, verwende `O` oder `S`/`R`.
2. **AWL ist sequenziell**: `U a / O b / U c` = (a ∨ b) ∧ c. Für a ∨ (b ∧ c) brauchst du `O` ohne Operand oder Klammern.
3. **Der Vergleich ersetzt das VKE**: in Reihe mit Kontakten immer innerhalb von `U( … )`.
4. **`T` ist unbedingt**: Es hängt nicht vom VKE ab.
5. **Ein nicht ausgeführtes `SPB` lässt VKE = 1.**
6. **Aus-Öffner → Schließerkontakt im Programm** (§1.3).
7. **Die Zeit braucht eine Flanke**: Ist die Bedingung schon 1, wenn ein Rücksetzen endet, startet sie erst wieder, wenn die Bedingung auf 0 und dann wieder auf 1 geht.
8. **`L 500` ist keine Zeit**: Verwende `S5T#5S`. Ein Wert, der kein BCD ist, ergibt einen Fehler, und die CPU geht in STOP.
9. **Bytereihenfolge**: `E0.0` ist Bit 8 von `EW0`; `MW10` = MB10 (höherwertig) + MB11 (niederwertig).
10. **Überlappung**: `MW10` und `MW11` teilen sich `MB11`.
11. **`L MW` erweitert das Vorzeichen nicht**: Um nach DINT zu wandeln, verwende `ITD`.
12. **`INC`/`DEC` wirken nur auf das niederwertige Byte**: `L 255 / INC 1` ergibt 0, nicht 256.
13. **`*I` lässt einen DINT in AKKU1**; **`/I` lässt den Rest in AKKU1-H**.
14. **Überlauf**: 30000 + 10000 = −25536, mit OV = 1.
15. **Zähler**: Hält man den Eingang auf 1, wird nicht mehrfach gezählt. Der Bereich ist 0..999.
16. **Gemeinsamer Flankenmerker**: Verwenden zwei `FP` denselben Merker, funktionieren beide nicht.
17. **Nicht initialisierte Lokaldaten (L)**: Sie enthalten zufällige Werte.
18. **Reihenfolge der Netzwerke**: Ein Merker, der erst nach seiner Verwendung berechnet wird, kommt einen Zyklus zu spät an.
19. **`LOOP` mit Zähler 0**: Die Schleife läuft 65535 Mal zu oft.
20. **Setzen/Rücksetzen**: Den Vorrang bestimmt die Reihenfolge der Bearbeitung, nicht die Art der Spule.

---

## 10. Speicherkonvention für die Übungen

Damit alle Übungen der App einheitlich sind:

| Bereich | Verwendung |
|---|---|
| E0.0..E3.7 | Taster und Schalter (E0.1 = **Aus-Öffner** in den Beispielen mit Ein und Aus) |
| EW2 | BCD-Ziffernrad (Beispiele zur Umwandlung) |
| A4.0..A7.7 | Leuchten, Motoren und Anzeigen (AW6 = BCD-Anzeige) |
| PEW256 | Analogeingang 0..27648 |
| M0.0..M9.7 | Hilfsmerker |
| M10.0..M19.7 | Flankenmerker |
| M20.0..M29.7 | Schrittmerker (Ablaufsteuerungen) |
| MW30..MW98 | INT-Werte |
| MD100.. | DINT- oder REAL-Werte |
| MB200 | Taktmerker (wenn er im Simulator aktiviert ist) |
| T1..T20, Z1..Z10 | Zeiten und Zähler der Übungen |

---

## 11. Mnemonik Deutsch ↔ Englisch

| Deutsch | Englisch (international) | Deutsch | Englisch |
|---|---|---|---|
| `U` | `A` | `SPA` | `JU` |
| `UN` | `AN` | `SPB` | `JC` |
| `O` / `ON` | `O` / `ON` | `SPBN` | `JCN` |
| `X` / `XN` | `X` / `XN` | `SPBB` / `SPBNB` | `JCB` / `JNB` |
| `U(` / `UN(` | `A(` / `AN(` | `SPBI` / `SPBIN` | `JBI` / `JNBI` |
| `=`, `S`, `R`, `NOT`, `SET`, `CLR`, `SAVE` | gleich | `SPO` / `SPS` | `JO` / `JOS` |
| `FP` / `FN` | `FP` / `FN` | `SPZ` / `SPN` | `JZ` / `JN` |
| `SI` | `SP` | `SPP` / `SPM` | `JP` / `JM` |
| `SV` | `SE` | `SPPZ` / `SPMZ` | `JPZ` / `JMZ` |
| `SE` | `SD` | `SPU` / `SPL` | `JUO` / `JL` |
| `SS` | `SS` | `BE` / `BEB` / `BEA` | `BE` / `BEC` / `BEU` |
| `SA` | `SF` | `AUF` | `OPN` |
| `ZV` / `ZR` | `CU` / `CD` | `UW` / `UD` | `AW` / `AD` |
| `E` / `A` (Operanden) | `I` / `Q` | `BIE` | `BR` |
| `PE` / `PA` | `PI` / `PQ` | `Z` (Zähler) | `C` |
| `S5T#`, `C#`, `L#`... | gleich | `KOP` / `FUP` / `AWL` | `LAD` / `FBD` / `STL` |

Vorsicht vor Verwechslungen: `SE` ist im Deutschen die Einschaltverzögerung, im Englischen aber der verlängerte Impuls. `A` ist im Deutschen ein Ausgang, im Englischen aber die UND-Anweisung.

---

## 12. Glossar

| Begriff | Bedeutung |
|---|---|
| PAE / PAA | Prozessabbild der Eingänge / der Ausgänge |
| VKE (RLO) | Verknüpfungsergebnis |
| /ER | Bit der Erstabfrage |
| STA | Statusbit (Wert des zuletzt abgefragten Operanden) |
| BIE (BR) | Binärergebnis (ENO, `SAVE`) |
| AKKU1 / AKKU2 | Akkumulatoren |
| Netzwerk | Programmeinheit in KOP und AWL |
| Selbsthaltung | Ein Ausgang hält sich über seinen eigenen Kontakt |
| Flanke | Wechsel 0→1 (steigend) oder 1→0 (fallend) |
| Remanent | Behält seinen Wert nach einem Spannungsausfall oder einem STOP→RUN |
| OB / FC / FB / DB | Organisationsbaustein / Funktion / Funktionsbaustein / Datenbaustein |
| BCD | Binär codierte Dezimalzahl |
| S5TIME | Zeitformat der Zeiten (Zeitbasis + 3 BCD-Ziffern) |
| Taktmerker | Merkerbyte, dessen Bits die CPU mit festen Frequenzen ein- und ausschaltet |
