# Häufige Fragen zu jeder Seite

> Deutsche Übersetzung von `web/teoria/es/preguntas.md`.
> - „## id“ ist die Kennung der Seite in `web/teoria/paginas.ts`. Darunter hat jede „### Frage?“ ihre Antwort in Markdown.

## intro

### Was ist eine SPS (speicherprogrammierbare Steuerung)?

Ein Industriecomputer, der Maschinen und Anlagen steuert: Er liest über seine Eingänge Taster und Sensoren, bearbeitet ein Programm in einem Zyklus, der sich ständig wiederholt, und steuert über seine Ausgänge Motoren, Ventile oder Leuchten. Er ersetzt Steuerungen, die mit Relais verdrahtet sind.

### Was ist der Unterschied zwischen einer SPS und einem Arduino?

Die SPS ist für die Industrie gebaut: Ein- und Ausgänge mit 24 V, unempfindlich gegen elektrische Störungen und Vibrationen, vorhersehbare zyklische Bearbeitung, genormte Sprachen (IEC 61131-3) und Ersatzteile über viele Jahre. Ein Arduino ist eine Mikrocontroller-Platine zum Lernen und für Prototypen und wird in C++ programmiert.

### Mit welcher SPS-Sprache sollte man anfangen?

Mit KOP (Kontaktplan), weil er sich wie ein Stromlaufplan liest. Danach AWL, um zu verstehen, wie die CPU intern arbeitet, und später strukturierter Text (ST) für Berechnungen und GRAFCET für Ablaufsteuerungen.

### Brauche ich eine echte SPS, um das Programmieren zu lernen?

Nein. Mit einem Simulator kannst du Programme in KOP und AWL schreiben, die Eingänge betätigen und sehen, wie Ausgänge, Zeiten und Zähler reagieren. Wenn du mit einer echten SPS arbeitest, kommst du mit einem bereits getesteten Programm.

## ciclo

### Was ist der Zyklus einer SPS?

Die Runde, die die CPU ständig wiederholt: Sie liest die Eingänge in das Prozessabbild (PAE), bearbeitet den OB1 von oben nach unten und kopiert das Abbild der Ausgänge (PAA) auf die physischen Ausgänge. Danach bearbeitet sie die Kommunikation und beginnt von vorn.

### Wenn ich denselben Ausgang an zwei Stellen zuweise, welcher Wert kommt am Ausgang an?

Der Wert der zuletzt bearbeiteten Zuweisung. Das PAA wird am Ende des Zyklus geschrieben, also überschreibt die letzte Zuweisung die vorherigen. Um Bedingungen zusammenzufassen, verwendet man ein ODER oder Setz- und Rücksetzspulen.

### Warum wird der Halt-Taster mit einem Schließer programmiert?

Weil der Halt-Taster als Öffner verdrahtet ist: In Ruhe ist der Eingang 1, und der Schließer im Programm fragt nur: „Ist er 1?“ Bricht der Draht, fällt der Eingang auf 0 und die Maschine hält an, was der sichere Zustand ist.

### Welcher OB wird beim Anlauf der CPU nur einmal bearbeitet?

Der OB100, beim Neustart, wenn die CPU von STOP in RUN geht. Er dient zur Initialisierung. Danach beginnt der Zyklus des OB1.

## memoria

### Aus welchen Bytes besteht das Merkerwort MW 10?

Aus MB10 und MB11. Ein Wort sind 2 Bytes ab der angegebenen Adresse: MB10 ist das höherwertige und MB11 das niederwertige Byte. Deshalb verwendet man Wörter in Zweierschritten (MW10, MW12…).

### Warum ist EW 0 gleich 256, wenn nur der Eingang E 0.0 an ist?

Weil das Byte mit der niedrigsten Adresse das höchstwertige ist: EB0 ist das höherwertige Byte von EW0, und E0.0 ist sein Bit 8. Wäre nur E1.0 an, wäre EW0 gleich 1.

### Welchen Wert liefert ein Analogeingang bei 10 V oder 20 mA?

27648, das Ende des Nennbereichs. Darüber liegt der Übersteuerungsbereich bis 32511, und der Wert 32767 zeigt einen Überlauf oder Drahtbruch an.

### Was sind remanente Merker?

Merker, die ihren Wert nach einem Spannungsausfall oder einem Übergang von STOP nach RUN behalten. Das wird in den Eigenschaften der CPU eingestellt; bei vielen CPUs sind standardmäßig MB0..MB15 remanent.

## tipos

### Was ist BCD und wofür wird es in der SPS verwendet?

Eine Art, Zahlen zu speichern, bei der jede Gruppe von 4 Bits eine Dezimalziffer von 0 bis 9 ist: `W#16#0123` in BCD ist 123. BCD verwenden Ziffernräder, Anzeigen sowie Zeit- und Zählwerte.

### Wie wird S5T#5S im Akku gespeichert?

Als `W#16#0500`: Zeitbasis 10 ms (Bits 13-12 = 00) und der Wert 500 in BCD.

### Warum kann `L 500` nicht als Zeitwert verwendet werden?

Weil 500 binär `W#16#01F4` ist, die Ziffer F enthält und deshalb kein gültiges BCD ist. Beim Start der Zeit tritt ein Fehler auf und die CPU geht in STOP. Man muss `L S5T#5S` schreiben.

### Wie wandle ich eine INT in eine REAL um?

In zwei Schritten: `ITD` (INT nach DINT) und danach `DTR` (DINT nach REAL). In KOP mit den Boxen `I_DI` und `DI_R`. Eine direkte Umwandlung von INT nach REAL gibt es nicht.

## bloques

### Was ist der Unterschied zwischen einer FC und einem FB?

Der FB hat ein eigenes Gedächtnis: einen Instanz-DB, in dem er seine statischen Variablen (STAT) speichert, die ihren Wert zwischen zwei Aufrufen behalten. Eine FC hat nur temporäre Variablen, die am Ende verloren gehen.

### Welcher OB bearbeitet das Hauptprogramm?

Der OB1, den die CPU zyklisch bearbeitet. Der OB100 ist der Anlauf, der OB35 der Weckalarm und der OB80 der Zeitfehler.

### Was passiert, wenn ein Fehler auftritt und sein OB nicht programmiert ist?

Die CPU geht in STOP. Ein ungültiges BCD ruft zum Beispiel den OB121 auf: Ist der OB121 nicht geladen, hält die CPU an.

## kop

### Was ist KOP (Kontaktplan)?

Die grafische SPS-Sprache, die wie ein Stromlaufplan aussieht: Der Strom kommt aus einer Schiene links, fließt durch Kontakte und kommt rechts an Spulen an. Auf Englisch heißt sie Ladder (LAD oder LD).

### Was ist der Unterschied zwischen einem Schließer und einem Öffner in KOP?

Der Schließer `--| |--` leitet, wenn sein Bit 1 ist, der Öffner `--|/|--`, wenn es 0 ist. Beide fragen nur den Zustand des Bits ab: Sie wissen nicht, wie der echte Taster verdrahtet ist.

### Was bedeuten zwei Kontakte in Reihe oder parallel?

In Reihe eine UND-Verknüpfung: Der Strom fließt nur, wenn beide leiten. Parallel eine ODER-Verknüpfung: Es reicht, wenn einer leitet.

## awl

### Was ist das VKE in AWL?

Das Verknüpfungsergebnis: das Bit des Statusworts, in dem sich das Ergebnis der Verknüpfungsanweisungen (`U`, `O`, `X`…) aufbaut. Die Zuweisungen `=`, `S` und `R` schreiben es in einen Operanden.

### Wofür ist das Bit /ER (Erstabfrage)?

Es zeigt an, ob die nächste Verknüpfungsanweisung eine neue Kette beginnt. Bei /ER = 0 kopiert das nächste `U`, `O` oder `X` den Operanden ins VKE, statt ihn damit zu verknüpfen.

### Warum berechnet `U a / O b / U c` nicht „a oder (b und c)“?

Weil AWL der Reihe nach auswertet: Es berechnet (a ∨ b) ∧ c. Für a ∨ (b ∧ c) braucht man `O` ohne Operand oder Klammern.

### Wie viele verschachtelte Klammern erlaubt AWL?

Sieben Ebenen. Werden sie überschritten, tritt ein Fehler auf und die CPU geht in STOP.

### Was macht die Anweisung SET in AWL?

Sie setzt das VKE auf 1 und schließt die Verknüpfungskette ab (/ER = 0). Sie setzt keinen Operanden auf 1: Dafür gibt es `S`.

## setreset

### Was ist eine Selbsthaltung?

Eine Schaltung, bei der sich der Ausgang über seinen eigenen Kontakt hält: Der Ein-Taster schaltet ihn ein, und beim Loslassen hält der Kontakt des Ausgangs selbst ihn eingeschaltet, bis der Halt-Taster gedrückt wird.

### Wenn ein Bit gleichzeitig Setzen und Rücksetzen hat, was gewinnt?

Die Anweisung, die zuletzt bearbeitet wird. Steht das Rücksetzen danach, gewinnt Aus; steht das Setzen danach, gewinnt Ein. Den Vorrang bestimmt die Reihenfolge, nicht die Art der Spule.

### Welche AWL-Anweisung entspricht der Spule (S) in KOP?

`S`. Nicht zu verwechseln mit `SET`, das das VKE auf 1 setzt, und mit `SE`, das eine Zeit startet.

### Was ist der Unterschied zwischen den Flipflops SR und RS?

Sind beide Eingänge 1, hat beim SR das Rücksetzen Vorrang (Q = 0) und beim RS das Setzen (Q = 1).

## flancos

### Was ist eine positive Flanke in einer SPS?

Der Wechsel eines Signals von 0 auf 1. Eine Flankenauswertung liefert nur in dem Zyklus eine 1, in dem dieser Wechsel stattfindet, auch wenn das Signal danach auf 1 bleibt. Die negative Flanke ist der Wechsel von 1 auf 0.

### Warum braucht jede Flanke einen eigenen Merker?

Weil der Flankenmerker den Zustand des vorherigen Zyklus speichert. Teilen sich zwei `FP` denselben Merker, überschreibt jede den gespeicherten Wert der anderen, und beide funktionieren nicht.

### Wie schalte ich mit einem einzigen Taster eine Leuchte ein und aus?

Mit einem Stromstoßschalter: eine positive Flanke des Tasters und eine Selbsthaltung, die bei jeder Flanke den Zustand des Ausgangs wechselt (Beispiel E11). Ohne Flanke würde der Ausgang bei gedrücktem Taster in jedem Zyklus wechseln.

## temporizadores

### Was ist der Unterschied zwischen den Zeiten SE und SS?

Beide sind Einschaltverzögerungen. SE schaltet Q nur ein, wenn S die ganze Zeit auf 1 bleibt; fällt S vorher ab, hält sie an. SS läuft weiter, auch wenn S abfällt, und hält Q nach Ablauf auf 1, bis sie zurückgesetzt wird.

### Welche Zeit hält Q die ganze Zeit auf 1, auch wenn S vorher abfällt?

SV, der verlängerte Impuls (S_VIMP). Der Impuls SI wird dagegen abgebrochen, wenn S vorzeitig abfällt.

### Welche Zeit schaltet Q ein, sobald S = 1 ist, und hält es nach dem Abfallen von S noch eine Zeit lang?

SA, die Ausschaltverzögerung (S_AVERZ): Die Zeit läuft ab der fallenden Flanke von S.

### Warum startet meine Zeit nach einem Rücksetzen nicht wieder?

Weil sie eine neue Flanke an S braucht. War die Startbedingung beim Ende des Rücksetzens schon 1, muss sie wieder auf 0 und dann erneut auf 1 gehen.

## contadores

### Welchen Wertebereich hat ein Zähler?

Von 0 bis 999, weil der Wert als 3 BCD-Ziffern gespeichert wird. Er geht nicht unter 0 und nicht über 999.

### Warum zählt der Zähler nur 1, auch wenn ich den Taster gedrückt halte?

Weil er Flanken zählt, keine Pegel: Für eine weitere Einheit muss der Eingang wieder auf 0 und dann auf 1 gehen.

### Wie lese ich den Wert eines Zählers in AWL?

Mit `L Z 1` bekommst du den Wert binär und mit `LC Z 1` in BCD. `U Z 1` liefert 1, wenn der Wert größer als 0 ist.

## marcaciclo

### Welches Bit schwingt mit 1 Hz, wenn MB100 der Taktmerker ist?

`M 100.5`, das eine Periodendauer von 1 s hat. Die Periodendauern der Bits 0 bis 7 sind 0,1 / 0,2 / 0,4 / 0,5 / 0,8 / 1 / 1,6 / 2 s.

### Darf ich in das Byte des Taktmerkers schreiben?

Nein: Die CPU überschreibt es in jedem Zyklus, deshalb geht alles verloren, was das Programm hineinschreibt. Das Programm darf es nur lesen.

### Taktmerker oder Zeiten für ein Blinklicht?

Den Taktmerker, wenn dir eine seiner Frequenzen genügt und es egal ist, an welcher Stelle das Blinken beginnt. Zeiten, wenn du unterschiedliche Ein- und Auszeiten brauchst oder das Blinken genau beim Erfüllen der Bedingung beginnen muss (Beispiel E17).

## secuencias

### Was ist ein GRAFCET?

Ein Diagramm, das eine Ablaufsteuerung als Schritte (Zustände der Maschine) darstellt, die durch Transitionen (die Bedingungen für den Wechsel zum nächsten Schritt) verbunden sind. Jeder Schritt hat seine Aktionen, zum Beispiel einen Ausgang einschalten.

### Wie programmiert man einen GRAFCET in KOP oder AWL?

Mit einem Merker pro Schritt. Jede Transition wird mit dem aktuellen Schritt in Reihe mit ihrer Bedingung programmiert: Setzen des nächsten Schritts und Rücksetzen des aktuellen. Die Ausgänge werden am Ende nur einmal aus den Schrittmerkern zugewiesen.

### Wie wird der Anfangsschritt aktiviert?

Beim Anlauf im OB100 oder mit einer Bedingung, die ihn aktiviert, wenn kein Schritt aktiv ist, wie bei der Ampel in Beispiel E28.

### Warum werden die Ausgänge einer Ablaufsteuerung am Ende des Programms zugewiesen?

Um Doppelzuweisungen zu vermeiden: Würde derselbe Ausgang in mehreren Schritten zugewiesen, zählte nur die letzte Zuweisung. Am Ende werden die Schritte, in denen er aktiv ist, mit ODER verknüpft.

## aritmetica

### Was passiert, wenn eine INT-Addition den Wertebereich verlässt?

Das Ergebnis läuft über: 30000 + 10000 hinterlässt −25536 im Akku, und die Überlaufbits OV und OS werden gesetzt. Die CPU hält nicht an.

### Hängt die Anweisung T vom VKE ab?

Nein. `L` und `T` werden immer ausgeführt, egal welchen Wert das VKE hat. Um nur bei erfüllter Bedingung zu transferieren, muss man mit `SPBN` darüber springen.

### Was hinterlässt /I im Akku?

Den Quotienten im niederwertigen Teil (AKKU1-L) und den Rest im höherwertigen Teil (AKKU1-H). Zum Beispiel hinterlässt `L 17 / L 5 / /I` unten 3 und oben 2.

### Warum steht ein Vergleich in Reihe mit einem Kontakt in Klammern?

Weil der Vergleich das VKE ersetzt, statt sich damit zu verknüpfen. Innerhalb von `U( … )` wird er getrennt berechnet und danach mit dem Kontakt verknüpft.

## conversiones

### Wie skaliere ich einen Analogeingang in Prozent?

Wandle den Wert in REAL um (`ITD` und `DTR`), teile ihn durch 27648 und multipliziere ihn mit 100. Mit 13824 am Eingang ergibt sich 50,0 %.

### Was ist der Unterschied zwischen RND und TRUNC?

`RND` rundet auf die nächste Ganzzahl (3,6 → 4), und `TRUNC` schneidet die Nachkommastellen in Richtung 0 ab (3,6 → 3). `RND+` rundet auf und `RND-` rundet ab.

### Warum hinterlässt `L MW 10` mit MW10 = −1 nicht −1 im 32-Bit-Akku?

Weil `L` den höherwertigen Teil mit Nullen füllt, ohne das Vorzeichen zu erweitern: AKKU1 ist dann `DW#16#0000FFFF`. Um den Wert als negatives DINT zu behandeln, verwendet man `ITD`.

## saltos

### Wie stehen VKE und /ER, wenn ein SPB nicht springt?

VKE = 1 und /ER = 0. `SPB` und `SPBN` lassen das VKE immer auf 1 und schließen die Kette ab, ob sie springen oder nicht. Deshalb schreibt eine Zuweisung direkt nach einem nicht springenden `SPB` eine 1.

### Wie programmiert man eine Schleife in AWL?

Mit `LOOP`: Es zieht 1 vom niederwertigen Teil von AKKU1 ab und springt zur Marke, solange er nicht 0 erreicht. Prüfe vorher, dass der Zähler nicht 0 ist, denn sonst würde er zu 65535 und die Schleife liefe 65535 Mal.

### Wie führe ich einen Transfer nur aus, wenn eine Bedingung erfüllt ist?

Indem man darüber springt: `U E0.0 / SPBN NEIN / L 5 / T MW10 / NEIN: NOP 0`. `T` hängt nicht vom VKE ab, deshalb reicht es nicht, die Bedingung davorzuschreiben.

## indirecto

### Was ist indirekte Adressierung in AWL?

Eine Adresse zu verwenden, die an anderer Stelle gespeichert ist, statt sie fest in den Code zu schreiben. Zum Beispiel lädt `L MW [MD 30]` das Wort, dessen Adresse in MD30 steht. Damit durchläuft man Tabellen in einer Schleife.

### Wie berechnet man einen Zeiger P#?

Bytenummer × 8 + Bitnummer. `P#10.0` ist 80 und `P#2.0` ist 16: Deshalb rückt ein Zeiger um ein Wort weiter, wenn man `P#2.0` addiert.

### Ersetzt das MCR einen Not-Halt?

Nein. Das MCR bewirkt nur, dass in einem Bereich des Programms die Zuweisungen `=` und die Transfers `T` eine 0 schreiben. Ein Not-Halt muss getrennt verdrahtet werden, außerhalb des Programms.

## equivalencias

### Lässt sich jedes AWL-Programm in KOP umwandeln?

Nein. Sprünge innerhalb eines Netzwerks, einzelne Akkumulatoroperationen, indirekte Adressierung oder `O` ohne Operand an ungewöhnlichen Stellen haben keine Darstellung in KOP, und diese Netzwerke bleiben in AWL. Umgekehrt schon: Jedes KOP hat seine AWL.

### Wie schreibt man zwei parallele Kontakte in AWL?

Mit `O a / O b`. Stehen sie danach in Reihe mit einem weiteren Kontakt, kommt `U c` dazu: `O a / O b / U c` berechnet (a ∨ b) ∧ c.

### Wie schaltet man in AWL einen Vergleich in Reihe mit einem Kontakt?

In Klammern: `U E 2.0 / U( / L MW 30 / L 500 / >I / )`.

## ejercicios

### Wie programmiert man einen Stern-Dreieck-Anlauf in einer SPS?

Mit einem Netzschütz in Selbsthaltung, einer Einschaltverzögerung (SE), die mit dem Netzschütz startet, dem Sternschütz, solange die Zeit nicht abgelaufen ist, und dem Dreieckschütz, wenn sie abgelaufen ist. Stern und Dreieck sind gegeneinander verriegelt, damit sie nie gleichzeitig einschalten (Aufgabe P04).

### Wie steuert man einen Behälter mit einer Minimal- und einer Maximalsonde?

Mit Setzen und Rücksetzen: Die Pumpe wird gesetzt, wenn der Füllstand unter das Minimum fällt, und zurückgesetzt, wenn er das Maximum erreicht oder der Halt-Taster gedrückt wird. Zwischen den beiden Sonden behält die Pumpe ihren Zustand: Das ist eine Hysterese (Aufgabe P01).

### Welche Zeit verwendet man für einen Treppenhausautomaten?

Den verlängerten Impuls (SV): Das Licht bleibt die ganze Zeit an, auch wenn der Taster losgelassen wird, und jeder neue Tastendruck startet die Zeit neu (Aufgabe P02).

## nemotecnica

### Was ist der Unterschied zwischen der deutschen und der englischen Mnemonik?

Es sind zwei Schreibweisen für dieselben Anweisungen. Im Deutschen ist `U` das UND, `E` ein Eingang und `A` ein Ausgang; im Englischen ist `A` das UND, `I` ein Eingang und `Q` ein Ausgang. Das Programm ist dasselbe.

### Wie schreibt man „SE T 1“ in englischer Mnemonik?

`SD T 1`, die Einschaltverzögerung. Im Englischen ist `SE` der verlängerte Impuls, im Deutschen `SV`.

### Was bedeuten KOP, FUP und AWL?

Es sind die deutschen Abkürzungen der Sprachen: KOP, Kontaktplan (englisch LAD); FUP, Funktionsplan (FBD), und AWL, Anweisungsliste (STL).
