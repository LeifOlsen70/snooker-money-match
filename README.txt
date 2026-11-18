8.17 – Schutz gegen veraltete Tischzuordnungen
Vor jeder Zuordnung liest die Tisch-Synchronisierung innerhalb derselben Transaktion den bestätigten Turnierstand. Eine ältere lokale Ansicht darf dadurch weder eine laufende Partie deaktivieren noch eine vorherige Zuordnung zurückholen. Neue Eingaben bleiben erhalten; auch Ersetzen muss den aktuellen Tischstand berücksichtigen. Die separate Vorbereitung der Ergebniseingabe prüft ebenfalls die bestätigte Partie und übernimmt deren Regeln und gespeicherte Eingaben.
Reproduktion: zwei gleichzeitige Spielleiter-Sitzungen mit unterschiedlichen lokalen Ständen. In 8.16 deaktiviert die ältere Sitzung den aktiven Tisch; 8.17 verhindert dies sowie das Zurücksetzen von 1:0 und das Wiederherstellen einer alten Partie. Weitere Tests: zwei Runden/zwei Tische, BO5 8/9/10 paarungsweise, Snooker, 14/1 mit fester Spieleanzahl, Tischgeräte, Undo/Redo. Kein Test in der angemeldeten Firebase-Sitzung des Nutzers.
Bitte alle verwendeten Spielleiter-Geräte/Browser auf 8.17 aktualisieren und ältere App-Tabs schließen. Bestehendes Turnier bleibt erhalten. Regeln und Audios unverändert. Neue gemeinsame Home-Bildschirm-Icons enthalten.

Tischgerät abmelden: Ab sofort werden nur gültig per Code angemeldete Geräte angezeigt (Code-Reservierung, Mitgliedschaft und Generation geprüft). Eingerichtete Tische allein gelten nicht als angemeldet. Ohne Geräte erscheint „Keine Tischgeräte angemeldet“. Die Abfrage erstellt oder erneuert keine Tischcodes. Nach erfolgreichem Abmelden verschwindet der Eintrag; Spielstand und Code bleiben erhalten. Getestet mit Neuanmeldung und veralteter Mitgliedschaft.

8.17 – Schutz gegen veraltete Tischzuordnungen
Vor jeder Zuordnung liest die Tisch-Synchronisierung innerhalb derselben Transaktion den bestätigten Turnierstand. Eine ältere lokale Ansicht darf dadurch weder eine laufende Partie deaktivieren noch eine vorherige Zuordnung zurückholen. Neue Eingaben bleiben erhalten; auch Ersetzen muss den aktuellen Tischstand berücksichtigen. Die separate Vorbereitung der Ergebniseingabe prüft ebenfalls die bestätigte Partie und übernimmt deren Regeln und gespeicherte Eingaben.
Reproduktion: zwei gleichzeitige Spielleiter-Sitzungen mit unterschiedlichen lokalen Ständen. In 8.16 deaktiviert die ältere Sitzung den aktiven Tisch; 8.17 verhindert dies sowie das Zurücksetzen von 1:0 und das Wiederherstellen einer alten Partie. Weitere Tests: zwei Runden/zwei Tische, BO5 8/9/10 paarungsweise, Snooker, 14/1 mit fester Spieleanzahl, Tischgeräte, Undo/Redo. Kein Test in der angemeldeten Firebase-Sitzung des Nutzers.
Bitte alle verwendeten Spielleiter-Geräte/Browser auf 8.17 aktualisieren und ältere App-Tabs schließen. Bestehendes Turnier bleibt erhalten. Regeln und Audios unverändert. Neue gemeinsame Home-Bildschirm-Icons enthalten.

8.17 – Ergebniseingabe und Tischverbindung
Die Turnierleitung bereitet den Spielstand separat von den Tischcodes vor. Fehler beim Anlegen oder Freigeben eines Codes blockieren damit die Ergebniseingabe nicht mehr. Dabei bleibt die Prüfung des gespeicherten Tischstands und seiner Revision erhalten. Bereits erfasste Punkte werden bei erneutem Öffnen übernommen. Fehler eines Tisches brechen die Vorbereitung der anderen Tische nicht mehr ab. Verbindungsfehler erscheinen direkt im Scorefenster statt nur außerhalb des Dialogs.
Geprüft mit simuliert verweigertem Zugriff auf Tischcodes: zwei Tische, zwei Runden, paarungsweise 8/9/10-Ball BO5; außerdem Best-of, 14/1 mit fester Spieleanzahl, Snooker, Tischgeräte und Undo/Redo. Kein Test in Leifs angemeldeter Firebase-Sitzung möglich; die konkrete Ursache der Sperre dort ist noch nicht ausgelesen.
Firebase-Regeln und Audios unverändert. Alle verwendeten Geräte auf 8.17 aktualisieren. Das laufende Turnier bleibt erhalten; kein neues Turnier erforderlich.

BILLARD & SNOOKER CLUB – VERSION 8.17

INSTALLATION / UPDATE
1. Die bisherige App / vorhandene Daten bei Bedarf als JSON sichern.
2. In Firebase die Firestore-Regeln vollständig durch die mitgelieferte Datei firestore.rules ersetzen und veröffentlichen.
   https://console.firebase.google.com/project/snooker-money-match/firestore/databases/-default-/security/rules
   Die Ergänzung erlaubt den eigenen Pool-Speicher und getrennte Pool-Tischgeräte. Bestehende Snooker- und Pool-Gruppenrechte bleiben bestehen.
3. Alle Dateien dieses ZIPs zusammen in das bestehende App-Verzeichnis hochladen. index.html ist jetzt die gemeinsame Startseite. app.html enthält die gemeinsame App.
4. App neu öffnen / bei Bedarf im Browser neu laden. Version 8.17 kontrollieren. Auch Tischgeräte aktualisieren.

EINSTIEG
Die erste Seite bietet Snooker / Poolbillard. Snooker verwendet die vorhandenen Kontodaten und Spielstände ohne Datenmigration. Pool ist ein neuer, separater Spielbereich und übernimmt keine alten Spielabende der bisherigen separaten Pool-App.
Ein Konto und eine Benutzerfreigabe gelten für beide Bereiche. Admin bleibt Leif Olsen. Im Menü kann der Spielbereich gewechselt werden.
Pool hat ein grünes Design und ein eigenes Kugelmotiv als Logo.

POOL
Einzel: Einzel oder festes Doppel auswählen, zwei Spieler / Teams eintragen.
Club Liga / Freies Turnier: Spieler oder feste Teams wie gewohnt für das Turnier auswählen.
Bei Doppel beide Namen als Name & Name in ein Teilnehmerfeld eintragen; ein Team ist ein Teilnehmer mit gemeinsamer Tabellen- und Elo-Wertung. Keine automatische Neuzusammenstellung der Teams pro Runde.

Eine oder mehrere Disziplinen wählen. Gespielt wird stets in der Reihenfolge 8-Ball → 9-Ball → 10-Ball → 14/1 endlos, soweit ausgewählt.
Je Disziplin die insgesamt zu spielenden Frames einstellen. Es werden alle eingestellten Frames gespielt, auch bei einem vorzeitigen Vorsprung. Wie beim Snooker sind dadurch Unentschieden möglich.
8/9/10-Ball: Name oder Frame-Sieger antippen, bestätigen. Keine Break-Eingabe und keine HB-Anzeige.
14/1: Zielpunktzahl einstellbar (Standard 100). Name antippen, Punkte im Popup eingeben. Eine einzelne Eingabe ab 20 zählt als Break. Kleinere Eingaben erhöhen nur die Punkte. HB und Break-Historie werden über das Match geführt. Punkteingaben über 147 sind möglich.
Die Zielpunktzahl erzeugt einen Hinweis. Frame-Sieger wird manuell bestätigt, danach startet der nächste Frame bei 0:0. Ein Frame kann mit ausdrücklicher Bestätigung auch vor Erreichen des Ziels vergeben werden.
Strafpunkte −1 und Zusatzstrafe −15 sind manuell auswählbar. Die App entscheidet nicht automatisch über Fouls.

TABELLE / ELO / HISTORIE
Die Frames aller ausgewählten Disziplinen werden addiert. Nur dieser Gesamtausgang zählt für Tabellen und Elo (Club Liga). Beispiel: 8-Ball 2:0, 9-Ball 1:2, 14/1 2:1 → gesamt 5:3.
Spieltagspunkte, Saisonwertung und Elo funktionieren wie beim Snooker. Pool- und Snooker-Wertungen bleiben getrennt.
Im freien Turnier gibt es wie bisher keine Elo.
In den Runden / im Score-Monitor und im neuen Reiter Spielhistorie lassen sich Disziplinen, einzelne Frames sowie bei 14/1 Punkte-Endstände, Breaks und HB ansehen. Historien vorheriger Spieltage werden beim Anlegen des nächsten Turniers mitgenommen und in der Turniersicherung gespeichert.
Einzel-Spielabende haben eine eigene Match-Historie und können als PoolMatch.json gesichert / geladen werden.

TISCHGERÄTE
Im passenden Bereich (Snooker oder Pool) mit dem zufälligen vierstelligen Tischcode beitreten. Ein Code verbindet genau ein Tischgerät. Neu erzeugte Codes werden projektweit auf freie Belegung geprüft.
Tische, Spielstände und Verbindungen beider Spielbereiche sind getrennt. Gleiche Tischnummern in Snooker und Pool überschreiben einander nicht; die physische Tischbelegung entscheidet die Turnierleitung.
Die Turnierleitung kann wie bisher unter Tischgerät abmelden eine Verbindung entziehen. Spielstand und Code bleiben erhalten, ein anderes Gerät kann beitreten.
Warnung aus am Tischgerät wirkt lokal; an der Turnierleitung wirkt sie für diesen Tisch auf alle Anzeigen. Warnung wird pro Frame erneuert.

PRÜFUNGEN
Geprüft: JavaScript-Syntax; Snooker-Regressionsprüfungen; Pool-Disziplinfolgen und Gesamtscores; 14/1-Punkte/Breaks/Strafen; Zurück/Vor; automatische Turnierergebnisse; Tabellen und Elo; Datei-/Historienvalidierung; simulierte Mehrgeräte-Synchronisierung und getrennte Tischbereiche; Bedienabläufe im DOM-Test einschließlich erneutem Laden.
Nicht durchgeführt: Veröffentlichung, Live-Test gegen euer Firebase-Projekt, visueller Browser-/iPhone-/iPad-Gerätetest. Firebase-Regeln sind vollständig beigefügt, müssen von dir veröffentlicht werden.

NEU IN 8.01 – POOL-TURNIERPLANUNG
Eine Runde umfasst jeden gegen jeden in jeder gewählten Disziplin. Bei 4 Spielern und 3 Disziplinen sind es 18 Disziplin-Begegnungen pro Runde. Bei ungerader Teilnehmerzahl entstehen keine künstlichen Freilos-Punkte; jeder spielt gegen alle anderen.
Jeder Spieler muss seine offenen Begegnungen früherer Disziplinen beenden, bevor er in die nächste wechselt. Ein freier Tisch und zwei bereite Spieler erlauben den gleitenden Übergang, während andere noch die vorherige Disziplin spielen. Keine Doppelbelegung von Spielern oder Tischen.
Neue Runde starten erscheint bei freien Tischen und bereiten Spielern, sobald die letzte gewählte Disziplin läuft, sofern keine aktuell startbare Begegnung der bisherigen Runde zuerst zu besetzen ist. Kein Spieler überspringt offene Begegnungen.
Übersicht: laufende Tische oben; darunter Runde / Disziplin mit Fortschritt, startbereiten Begegnungen sowie eingeklappten wartenden / pausierten und abgeschlossenen Begegnungen.
Pausieren / Pause beenden ist für wartende Begegnungen verfügbar. Eine Pause gibt keinen Tisch vor und gilt nicht als Ergebnis.
Tabellen und Elo: Ergebnisse einer Paarung werden erst gewertet, wenn diese Paarung in allen gewählten Disziplinen Ergebnisse hat. Ihre Frames werden dann zusammengezählt. Historie bleibt nach Runde und Disziplin nachvollziehbar.
Bereits gespeicherte Pool-Turniere aus 8.00 behalten aus Gründen der Datenerhaltung ihren bisherigen Ablauf. Die neue Planung gilt für neu angelegte Pool-Turniere. Einzel-Spielabende und Snooker behalten ihren bisherigen Ablauf.
Firebase-Regeln identisch zu 8.00. Wer diese bereits veröffentlicht hat, muss sie nicht erneut ändern.

NEU 8.02: Kompaktere Pool-Historie und auffälliger, nicht blockierender Zielpunkte-Hinweis. Break-Daten bleiben intern erhalten. Firebase-Regeln unverändert.

NEU 8.03: Fertige Pool-Begegnungen zusätzlich in der normalen Liste sichtbar; Historie bleibt erhalten.

NEU 8.04: Laufende Pool-Begegnungen mit Ergebnis eintragen direkt im Abschnitt der jeweiligen Runde und Disziplin. Separater Am-Tisch-Block oben entfällt. Regeln unverändert.

NEU 8.05: Reihenfolge je Pool-Runde/Disziplin: fertige Begegnungen, laufende Begegnungen, startbereite Begegnungen. Startbuttons zeigen weiterhin nur tatsächlich freie Tische; bei belegten Tischen ist kein Start möglich.

NEU 8.17: Klappzustände bleiben während der App-Nutzung bei Aktualisierungen erhalten. Keine Änderung an den Firebase-Regeln.

NEU 8.17: Doppelturnier mit zwei einzelnen Teampartnern pro Team. Nur Einzelnamen werden in der Spielerliste gespeichert.

NEU 8.17: In der Doppel-Teamaufstellung Namen kurz antippen zum Bearbeiten; länger halten und auf einen anderen Partnerplatz ziehen zum Tauschen.

NEU 8.17: Partnertausch auch bei Einzel → Doppel. Freigabeanfragen mit gespeichertem Datum und Uhrzeit.

NEU 8.17: Namens-Popup für alle Spielarten, eine gemeinsame Namensliste je Konto für beide Sportarten. Nur der Admin darf gespeicherte Namen ändern/löschen. WICHTIG: Die mitgelieferte firestore.rules erneut veröffentlichen.

NEU 8.17: Kai-Audios in Snooker Einzel, zunächst stumm. Schalter nur für Admin im Dreistrichemenü. Keine neuen Firebase-Regeln gegenüber 8.10.

NEU 8.17: Kai-Sprüche nur beim Wechsel der Audio-Stufe, keine Wiederholung bei aufeinanderfolgenden Eingaben derselben Stufe.

NEU 8.17: Pool-Turniere mit Auswahl Spielablauf: Disziplinweise oder Paarungsweise. Nur bei neuen Turnieren wählen; bestehende Turniere laufen wie gespeichert weiter. Keine Änderung an Firebase-Regeln oder Audios.

NEU 8.17: Turnier-Eingaben sofort ohne Rückfrage. Match-Sieger zum vorzeitigen Abschluss mit echtem Frame-Stand; letzten Frame vorher erfassen. Pool-Feldkorrektur. Tischgeräte mit aktualisieren. Keine neuen Firebase-Regeln; Audios unverändert.

NEU 8.17: Neue Turniere mit Best of (Snooker / 8-, 9-, 10-Ball). 14/1 weiterhin feste Spielezahl. Zusätzliche Frame-Sieger-Buttons bei 8/9/10 entfallen, Eingabe über Namen. Aktive Neusynchronisierung bei blockiertem Tischzählwerk nach Rundenwechsel. Bestehende Turniere behalten ihren Ablauf. Alle Tischgeräte aktualisieren; keine neuen Firebase-Regeln oder Audios.
