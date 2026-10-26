# Theorie, die es nur auf der Website gibt

> Deutsche Übersetzung von `web/teoria/es/extra.md`: die Abschnitte der Website, die nicht in „Aprender“ der App stehen (Einführung in die SPS, Ablaufsteuerungen mit GRAFCET, gelöste Aufgaben und die Schritt-für-Schritt-Anleitungen zu KOP und AWL).
> - Die Kennungen (I.1, S.1, P.1, K.1, A.1…) bleiben gleich: `web/teoria/paginas.ts` verwendet sie.

---

### I.1 Was ist eine SPS?

Eine **SPS** (speicherprogrammierbare Steuerung) ist ein Computer, der Maschinen und Anlagen in der Industrie steuert. Sie macht immer dasselbe, ohne Pause:

1. **Sie liest die Eingänge**: Taster, Schalter, Endschalter, Anwesenheitssensoren, Füllstands- oder Temperaturfühler.
2. **Sie bearbeitet das Programm**: Sie entscheidet, was zu tun ist, abhängig vom Zustand der Eingänge, von der vergangenen Zeit und von dem, was sie sich merkt (Merker, Zeiten und Zähler).
3. **Sie schreibt die Ausgänge**: Sie schaltet Motoren über Schütze, öffnet Ventile, schaltet Leuchten ein oder bewegt Zylinder.

Diese Wiederholung heißt **Zyklus** und dauert meist wenige Millisekunden (§1.1).

Vor der SPS wurde die Logik einer Maschine **mit Relais verdrahtet**: Um die Funktion zu ändern, musste der Schaltschrank neu verdrahtet werden. Mit einer SPS bleibt die Verdrahtung der Ein- und Ausgänge gleich, und es ändert sich nur das **Programm**.

### I.2 Aufbau einer SPS

| Teil | Wofür |
|---|---|
| **Stromversorgung** | Wandelt die Netzspannung in die 24 V DC um, die CPU und Baugruppen brauchen |
| **CPU** | Bearbeitet das Programm und speichert die Daten: Prozessabbild, Merker, Zeiten, Zähler und Datenbausteine (§2.1) |
| **Digitaleingänge** | Lesen Signale, die nur 0 oder 1 sind, meist mit 24 V |
| **Digitalausgänge** | Schalten Schütze, Magnetventile oder Leuchten, über Transistor oder Relais |
| **Analoge Ein- und Ausgänge** | Lesen oder erzeugen stetige Werte wie 0..10 V oder 4..20 mA, die die CPU als Zahlen von 0 bis 27648 sieht (§2.3) |
| **Kommunikation** | Verbindet mit dem Programmiergerät, mit Bediengeräten (HMI) und mit anderen Steuerungen |

Bei **Kompaktsteuerungen** steckt alles in einem Gehäuse: die CPU mit ihren integrierten Ein- und Ausgängen. Bei **modularen** Steuerungen ist jedes Teil eine Baugruppe, die neben der CPU auf einen Baugruppenträger montiert wird, und man fügt hinzu, was man braucht.

### I.3 SPS, Relais und Mikrocontroller

| | Verbindungsprogrammiert (Relais) | SPS | Mikrocontroller (zum Beispiel Arduino) |
|---|---|---|---|
| Funktion ändern | Neu verdrahten | Programm ändern | Programm ändern |
| Umgebung | Industrie | Industrie: unempfindlich gegen Störungen, Vibrationen und Temperatur | Labor, Prototypen und Lernen |
| Ein- und Ausgänge | Kontakte und Spulen | 24 V, genormte Baugruppen | 3,3 oder 5 V: für die Industrie müssen sie angepasst werden |
| Sprachen | — | Genormt (IEC 61131-3): KOP, FUP, AWL, strukturierter Text, GRAFCET | C oder C++ |
| Ausführung | Sofort | Zyklisch und vorhersehbar (Zyklus) | So, wie man es programmiert |

Ein Mikrocontroller eignet sich zum Lernen von Elektronik und für Prototypen. In einer Industriemaschine verwendet man eine SPS, weil sie für diese Umgebung gebaut ist, jeder Instandhalter sie versteht und sie über viele Jahre ersetzt und repariert werden kann.

### I.4 Programmiersprachen der SPS

Die Norm **IEC 61131-3** legt die Programmiersprachen für Steuerungen fest. Die deutschen Bezeichnungen KOP, FUP und AWL sind auch in der Ausbildung weit verbreitet:

| Sprache | Auch genannt | Wie sie aussieht | Wofür sie gut ist |
|---|---|---|---|
| **KOP** | Kontaktplan, Ladder (LD, LAD) | Grafisch, wie ein Stromlaufplan mit Kontakten und Spulen | Bitverknüpfungen, Selbsthaltung und Zeiten. Elektriker verstehen sie sofort |
| **FUP** | Funktionsplan (FBD) | Grafisch, mit Boxen für UND, ODER, Flipflops… wie in der Digitaltechnik | Dieselbe Logik wie KOP, mit Logikgattern gezeichnet |
| **AWL** | Anweisungsliste (STL, IL) | Text, eine Anweisung pro Zeile, sehr nah an der Arbeitsweise der CPU | Die CPU von innen verstehen, bestehende Programme, Prüfungen |
| **Strukturierter Text** | ST | Text ähnlich wie Pascal, mit `IF`, `FOR` und Formeln | Berechnungen, Schleifen und Datenverarbeitung |
| **GRAFCET** | Ablaufsprache (SFC) | Grafisch, mit Schritten und Transitionen | Schrittketten (§S.1) |

Dasselbe Programm kann in KOP oder in AWL geschrieben werden: Der Editor übersetzt jedes KOP-Netzwerk in AWL (§8.1). Nicht jede AWL hat eine Darstellung in KOP, aber jedes KOP hat seine AWL.

### I.5 Welche Sprache lernen?

- **Fang mit KOP an.** KOP liest sich wie ein Stromlaufplan und vermittelt das Wesentliche: Kontakte, Spulen, Selbsthaltung, Flanken, Zeiten und Zähler.
- **Lerne AWL, um die CPU zu verstehen.** In AWL siehst du das VKE, die Akkus und die Reihenfolge, in der jede Anweisung ausgeführt wird, und verstehst, warum ein Programm tut, was es tut. Die Ausgabe 2013 der IEC 61131-3 hat AWL als veraltet eingestuft, und in neuen Anlagen wird sie immer seltener verwendet, aber sie steckt in sehr vielen laufenden Maschinen und kommt in Prüfungen der Berufsausbildung und des Studiums vor.
- **Danach strukturierter Text (ST)** für Berechnungen und Datenverarbeitung und **GRAFCET** für Ablaufsteuerungen.

---

### S.1 Was eine Ablaufsteuerung ist

Viele Maschinen arbeiten **in Schritten**: Eine Ampel wechselt von Grün auf Gelb und auf Rot, eine Presse fährt herunter, wartet und fährt hoch, eine Waschmaschine füllt, wäscht, pumpt ab und schleudert. Jeder Schritt dauert, bis eine Bedingung erfüllt ist (eine Zeit, ein Sensor, ein Taster), und dann beginnt der nächste.

Eine Ablaufsteuerung mit einzelnen Kontakten zu programmieren, wird schnell unübersichtlich. Viel klarer ist es, **sie zuerst als GRAFCET zu zeichnen** und ihn dann mit einer festen Methode in KOP oder AWL umzusetzen.

### S.2 GRAFCET: Schritte und Transitionen

Ein **GRAFCET** ist ein Diagramm aus Schritten und Transitionen:

- **Schritt**: ein Zustand der Maschine. Er wird als nummeriertes Quadrat gezeichnet. Der **Anfangsschritt**, der beim Start aktiv ist, wird als Doppelquadrat gezeichnet.
- **Aktion**: was getan wird, solange der Schritt aktiv ist (einen Ausgang einschalten, eine Zeit starten). Sie steht in einem Rechteck rechts neben dem Schritt.
- **Transition**: die Bedingung, um von einem Schritt zum nächsten zu wechseln. Sie wird als waagerechter Strich zwischen den beiden Schritten gezeichnet, mit ihrer Bedingung daneben.

**Entwicklungsregeln**:

1. Eine Transition **schaltet**, wenn der vorherige Schritt aktiv ist **und** ihre Bedingung erfüllt ist.
2. Beim Schalten wird der nächste Schritt **aktiviert** und der vorherige **deaktiviert**.
3. Mehrere Transitionen, die gleichzeitig schalten können, schalten gleichzeitig.

<!-- figura -->

### S.3 Vom GRAFCET zu KOP und AWL mit Schrittmerkern

Die häufigste Methode ordnet **jedem Schritt einen Merker** zu (zum Beispiel M20.0, M20.1, M20.2…), der 1 ist, solange der Schritt aktiv ist. Jede Transition wird mit **Setzen und Rücksetzen** programmiert:

```awl
// Transition von Schritt 1 (M20.0) zu Schritt 2 (M20.1)
      U     M 20.0          // Schritt 1 ist aktiv
      U     T 10            // und die Bedingung ist erfüllt: die 5 s sind abgelaufen
      S     M 20.1          // aktiviert Schritt 2
      R     M 20.0          // deaktiviert Schritt 1
```

In KOP ist es genauso: ein Kontakt des Schritts in Reihe mit der Bedingung und zwei Spulen parallel, `(S)` auf den nächsten Schritt und `(R)` auf den aktuellen.

Das vollständige Programm hat immer denselben Aufbau:

1. **Anfangsschritt**: Er wird beim Anlauf im OB100 aktiviert oder dann, wenn kein Schritt aktiv ist.
2. **Transitionen**: ein Netzwerk pro Transition, mit ihrem Setzen und Rücksetzen.
3. **Halt**: falls nötig ein Netzwerk, das alle Schritte zurücksetzt.
4. **Ausgänge (Aktionen)**: am Ende wird jeder Ausgang **nur einmal** aus den Schrittmerkern zugewiesen. Wirkt ein Ausgang in mehreren Schritten, werden sie mit ODER verknüpft: `O M 20.1 / O M 20.3 / = A 4.0`.

Die Ausgänge stehen wegen der **Doppelzuweisung** am Ende (§1.2): Würde derselbe Ausgang in mehreren Schritten zugewiesen, zählte nur die letzte Zuweisung.

**Zeiten in den Schritten**: Die Zeit wird vom Schrittmerker selbst gestartet (`U M 20.0 / L S5T#5S / SE T 10`), und ihr Ausgang ist die Bedingung der Transition (`U T 10`). Wird der Schritt deaktiviert, hält die Zeit von selbst an.

### S.4 Tipps

- **Prüfe, dass in einer linearen Schrittkette nur ein Schritt aktiv ist.** Leuchten im Simulator zwei Schrittmerker gleichzeitig, fehlt ein Rücksetzen.
- **Vorsicht beim Durchschalten mehrerer Schritte.** Ist die Bedingung der nächsten Transition schon erfüllt, kann die Kette im selben Zyklus zwei Schritte weitergehen, weil das Programm von oben nach unten bearbeitet wird. Um das zu vermeiden, programmiere die Transitionen in umgekehrter Reihenfolge (von der letzten zur ersten) oder berechne zuerst alle Transitionen in Hilfsmerkern und wende danach das Setzen und Rücksetzen an.
- **Verwende einen Merkerbereich nur für die Schritte**, zum Beispiel M20.0..M29.7, und für jeden Schritt, der eine Zeit braucht, eine eigene Zeit.

---

### P.1 So arbeitest du mit diesen Aufgaben

Es sind typische Unterrichts- und Prüfungsaufgaben, gelöst und mit automatischen Tests im Simulator geprüft. Bei jeder Aufgabe:

1. Lies die Aufgabe und versuche sie zu lösen, bevor du irgendetwas anschaust. Wenn du nicht weiterkommst, öffne den **Hinweis** unter „Lösung“.
2. Vergleiche dein Programm mit der Lösung in KOP und in AWL.
3. Probiere es im Feld aus: Betätige die Eingänge und prüfe, ob die Ausgänge tun, was die Aufgabe verlangt.

Die Aufgaben verwenden Taster und Sensoren mit absoluten Adressen. Halt-Taster sind als **Öffner** verdrahtet und stehen deshalb am Anfang auf 1 (§1.3).

---

### K.1 Wie man einen Kontaktplan liest

Ein KOP-Programm wird wie ein **Stromlaufplan aus Kontakten und Spulen** gezeichnet und genauso gelesen:

- Das Programm ist in **Netzwerke** gegliedert. Jedes Netzwerk ist eine „Zeile“ des Plans, mit seiner Logik und seinem Ausgang.
- Links steht die **Stromschiene**: Von ihr geht der „Strom“ aus.
- Der Strom fließt **von links nach rechts** durch die **Kontakte**. Jeder Kontakt lässt den Strom durch oder unterbricht ihn, je nach dem Wert eines Bits (eines Eingangs, eines Ausgangs, eines Merkers…).
- Rechts steht die **Spule**: Kommt Strom an, schreibt sie eine 1 in ihr Bit; kommt keiner an, schreibt sie eine 0.

Dieser „Strom“ ist kein echter Strom: Es ist das **Verknüpfungsergebnis**, das die CPU beim Bearbeiten des Netzwerks berechnet, eine 1 oder eine 0. In AWL heißt es **VKE** (§7.3). Im Simulator wird der Teil mit Stromfluss **grün durchgezogen** angezeigt und der Teil ohne Stromfluss **blau gestrichelt**.

Probiere es aus: Schalte den Eingang E 0.0 ein und beobachte, wie der Strom durch den Kontakt zur Spule fließt, die den Ausgang A 4.0 einschaltet.

<!-- probar: na -->

### K.2 Schließer

Der Schließer `--| |--` **fragt: „Ist dieses Bit 1?“**

| Bit des Kontakts | Leitet er? |
|---|---|
| 0 | Nein: Er unterbricht den Strom |
| 1 | Ja: Er lässt den Strom durch |

Er funktioniert wie ein Taster mit Schließer: Ist das Bit 1, „schließt“ er den Stromkreis. Er ist der meistverwendete Kontakt: Mit ihm fragt man Taster, Sensoren, Merker und auch Ausgänge ab. In AWL entspricht er der Anweisung `U` (§A.2).

### K.3 Öffner

Der Öffner `--|/|--` **fragt: „Ist dieses Bit 0?“** Er ist der umgekehrte Schließer:

| Bit des Kontakts | Leitet er? |
|---|---|
| 0 | Ja: Er lässt den Strom durch |
| 1 | Nein: Er unterbricht den Strom |

Probiere es aus: Mit E 0.0 auf 0 leuchtet die Leuchte. Schaltest du E 0.0 ein, öffnet der Kontakt und die Leuchte geht aus.

<!-- probar: nc -->

In AWL entspricht er `UN` (§A.3).

> **Verwechsle den Kontakt im Programm nicht mit dem echten Taster.** Der Kontakt im Programm fragt nur den Wert des Bits ab; er weiß nicht, wie der Taster verdrahtet ist. Ein Halt-Taster wird als Öffner verdrahtet (in Ruhe 1) und im Programm mit einem **Schließer** abgefragt (§1.3).

### K.4 Kontakte in Reihe: die UND-Verknüpfung

Setzt du Kontakte **hintereinander**, kommt der Strom nur dann an der Spule an, wenn **alle leiten**. Das ist die **UND**-Verknüpfung:

| E 0.0 | E 0.1 | A 4.0 |
|---|---|---|
| 0 | 0 | 0 |
| 0 | 1 | 0 |
| 1 | 0 | 0 |
| 1 | 1 | **1** |

Probiere es aus: A 4.0 schaltet nur ein, wenn beide Eingänge eingeschaltet sind.

<!-- probar: y -->

In Reihe kannst du Schließer und Öffner mischen. „Ein **und kein** Alarm“ ist zum Beispiel ein Schließer für Ein in Reihe mit einem Öffner für den Alarm:

<!-- probar: y-no -->

### K.5 Kontakte parallel: die ODER-Verknüpfung

Setzt du Kontakte in **parallele Zweige**, kommt Strom an der Spule an, wenn **mindestens ein** Zweig leitet. Das ist die **ODER**-Verknüpfung:

| E 0.0 | E 0.1 | A 4.0 |
|---|---|---|
| 0 | 0 | 0 |
| 0 | 1 | **1** |
| 1 | 0 | **1** |
| 1 | 1 | **1** |

Damit schaltet man zum Beispiel ein Licht von zwei verschiedenen Tastern aus ein. Probiere es aus:

<!-- probar: o -->

Ein paralleler Zweig kann auch einen Öffner haben: Hier schaltet A 4.0 ein, wenn E 0.0 gleich 1 ist **oder** wenn E 0.1 gleich 0 ist.

<!-- probar: o-no -->

### K.6 Reihe und parallel kombinieren

Echte Pläne mischen beides, und man liest sie wie einen Stromkreis: Der Strom muss **durch einen der parallelen Zweige und danach durch die Kontakte in Reihe** fließen.

In diesem Beispiel ist A 4.0 = (E 0.0 **oder** E 0.1) **und** E 0.2. Probiere es aus: Schalte E 0.2 ein und danach einen der beiden anderen.

<!-- probar: combinado -->

So sind fast alle Steuerungen aufgebaut. Eine Ein/Aus-Schaltung mit Selbsthaltung ist zum Beispiel „(Ein **oder** der Motor selbst) **und** Halt“ (§6.4). Um so eine Kombination in AWL umzusetzen, verwendet man Klammern oder `O` ohne Operand (§7.4 und §8.2).

### K.7 Spulen, Setzen, Rücksetzen und NOT

Rechts im Netzwerk stehen die Elemente, die das Ergebnis **schreiben**:

- **Spule `( )`**: Sie schreibt das Ergebnis immer: 1, wenn Strom ankommt, 0, wenn nicht. Jeder Operand sollte im ganzen Programm **nur eine Spule** haben; hat er zwei, zählt nur die letzte (§1.2).
- **Mehrere Spulen parallel** am Ende eines Netzwerks bekommen denselben Strom: Sie haben alle denselben Wert.
- **Setzen `(S)`** und **Rücksetzen `(R)`**: Kommt Strom an, setzen sie das Bit auf 1 bzw. auf 0; kommt keiner an, **tun sie nichts**, und das Bit behält seinen Wert. Damit „merkt“ sich das Programm etwas (§6.4).
- **NOT `--|NOT|--`**: Es kehrt den Strom um. Was als 1 ankommt, geht als 0 weiter, und umgekehrt.

Probiere es aus: Mit E 0.0 schalten die beiden Spulen des ersten Netzwerks gleichzeitig ein; die des zweiten macht das Gegenteil, wegen des NOT.

<!-- probar: bobinas -->

---

### A.1 Wie man ein AWL-Programm liest

In AWL wird das Programm **als Text** geschrieben, eine Anweisung pro Zeile. Jede Zeile hat eine **Operation** und fast immer einen **Operanden**:

| Zeile | Operation | Operand | Gelesen als |
|---|---|---|---|
| `U E 0.0` | `U` (UND) | `E 0.0` | „und Eingang 0.0“ |
| `UN E 0.1` | `UN` (UND NICHT) | `E 0.1` | „und nicht Eingang 0.1“ |
| `= A 4.0` | `=` (zuweisen) | `A 4.0` | „das Ergebnis an Ausgang 4.0“ |

Die CPU bearbeitet die Zeilen **von oben nach unten**. Die Verknüpfungsanweisungen berechnen nach und nach ein Ergebnis, das **VKE** (Verknüpfungsergebnis), das dem „Strom“ in KOP entspricht: Jede Anweisung verknüpft das VKE mit ihrem Operanden, und am Ende schreibt `=` es in einen Ausgang.

Beispiel, Zeile für Zeile, mit E 0.0 = 1 und E 0.1 = 0:

| Anweisung | Was sie macht | VKE danach |
|---|---|---|
| `U E 0.0` | Erste Anweisung der Kette: kopiert E 0.0 | 1 |
| `U E 0.1` | 1 UND 0 | 0 |
| `= A 4.0` | Schreibt das VKE in A 4.0 | A 4.0 = 0 |

Die **erste** Verknüpfungsanweisung nach einer Zuweisung verknüpft nichts: Sie **kopiert** ihren Operanden ins VKE. Das ist die „Erstabfrage“ (§7.3).

### A.2 U: UND

`U` bedeutet **„und außerdem ist dieses Bit 1“**. Es verknüpft das VKE mit dem Operanden über ein **UND**: Das Ergebnis bleibt nur 1, wenn der Operand 1 ist.

- In KOP entspricht das einem **Schließer in Reihe**.
- Mehrere `U` hintereinander: Das Ergebnis ist nur 1, wenn **alle** erfüllt sind.

<!-- probar: y -->

### A.3 UN: UND NICHT

`UN` bedeutet **„und außerdem ist dieses Bit 0“**. Es ist ein UND mit negiertem Operanden: VKE := VKE ∧ ¬Operand.

- In KOP entspricht das einem **Öffner in Reihe**.
- So schreibt man Bedingungen wie „Ein **und kein** Alarm“:

<!-- probar: y-no -->

### A.4 O: ODER

`O` bedeutet **„oder dieses Bit ist 1“**. Es verknüpft das VKE mit dem Operanden über ein **ODER**: Das Ergebnis ist 1, wenn irgendeine der Bedingungen erfüllt ist.

- In KOP entspricht das einem **Schließer parallel**.
- Bei einer Parallelschaltung einzelner Kontakte schreibt man auch in die erste Zeile `O` (`O E 0.0 / O E 0.1`), obwohl `U E 0.0 / O E 0.1` dasselbe ergäbe: Die erste Anweisung kopiert nur den Operanden.

<!-- probar: o -->

### A.5 ON: ODER NICHT

`ON` bedeutet **„oder dieses Bit ist 0“**: VKE := VKE ∨ ¬Operand. In KOP entspricht das einem **Öffner parallel**.

<!-- probar: o-no -->

### A.6 X und XN: Exklusiv-ODER

`X` ist das **Exklusiv-ODER**: Das Ergebnis ist 1, wenn **nur einer** der beiden 1 ist, und 0, wenn beide gleich sind. `XN` ist das Gegenteil: 1, wenn beide gleich sind.

| E 0.0 | E 0.1 | `X E 0.0 / X E 0.1` | `X E 0.0 / XN E 0.1` |
|---|---|---|---|
| 0 | 0 | 0 | 1 |
| 0 | 1 | 1 | 0 |
| 1 | 0 | 1 | 0 |
| 1 | 1 | 0 | 1 |

Eine typische Anwendung ist die **Wechselschaltung** im Flur: zwei Schalter, einer an jedem Ende, und jeder von beiden wechselt den Zustand des Lichts. In KOP gibt es keinen Exklusiv-ODER-Kontakt: Man zeichnet es mit zwei Zweigen (§6.3), wie in diesem Netzwerk.

<!-- probar: xor -->

### A.7 =, S und R: das Ergebnis schreiben

Wenn die Verknüpfung berechnet ist, muss das VKE irgendwohin geschrieben werden:

| Anweisung | Was sie macht | In KOP |
|---|---|---|
| `= A 4.0` | A 4.0 := VKE, immer (1 oder 0) | Spule `( )` |
| `S A 4.0` | Wenn VKE = 1, A 4.0 := 1. Bei VKE = 0 passiert nichts | Spule `(S)` |
| `R A 4.0` | Wenn VKE = 1, A 4.0 := 0. Bei VKE = 0 passiert nichts | Spule `(R)` |

- Nach `=`, `S` oder `R` ist die Kette abgeschlossen: Das nächste `U` oder `O` beginnt eine neue Verknüpfung.
- Man kann mehrere `=` hintereinander schreiben, um dasselbe Ergebnis mehreren Ausgängen zuzuweisen.
- Mit `S` und `R` „merkt“ sich das Bit seinen Wert. Probiere es aus: Ein Impuls an E 0.0 schaltet A 4.0 ein, das nach dem Loslassen von E 0.0 eingeschaltet bleibt, bis E 0.1 es ausschaltet.

<!-- probar: set-reset -->

### A.8 NOT, SET und CLR

Diese drei Anweisungen haben keinen Operanden und wirken **direkt auf das VKE**:

| Anweisung | Was sie macht | Anwendungsbeispiel |
|---|---|---|
| `NOT` | Negiert das VKE | `U E 0.0 / U E 0.1 / NOT / = A 4.0` ist ein NAND |
| `SET` | Setzt das VKE auf 1 | Eine feste 1 schreiben: `SET / = M 0.0` |
| `CLR` | Setzt das VKE auf 0 | Eine feste 0 schreiben: `CLR / = M 0.0` |

> **Vorsicht mit `SET`**: Es setzt keinen Operanden auf 1, sondern nur das VKE. Um ein Bit zu setzen, verwendet man `S`.
