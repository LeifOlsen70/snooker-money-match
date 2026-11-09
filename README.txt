Snooker Money Match v7.23
Alle Dateien auf GitHub hochladen und die App anschließend neu öffnen.
Im Turniermodus sichern und laden die beiden Schaltflächen eine JSON-Datei.
Die Matchzeit startet mit der Tischzuweisung und endet beim Speichern des Ergebnisses.
Im Turnier nach links zum Zwischenstand mit Break-Abrechnung wischen, nach rechts zurück zu den Runden.
Alternativ die Schaltflächen Runden und Zwischenstand verwenden.
In der Tabelle schaltet „Vollbild an/aus“ die große Anzeige ein und aus.
Gespielte Breaks ab 20 stehen in der Tabelle und bei den abgeschlossenen Matches.
Die Live-Synchronisierung gilt für den Einzelmodus. Turniere werden lokal gespeichert.

Neu in v7.23:
- Die Spalte Spiele zählt Matches mit gespeichertem Ergebnis und Freilose.

Neu in v7.22:
- Die Turniertabelle zeigt gespielte Matches und Remis pro Spieler.
- Als gespielt zählen Matches mit gespeichertem Ergebnis. Freilose zählen nicht als Spiel.

Neu in v7.21:
- Ist ein Tisch frei und kein früheres Match startbereit, lässt sich die nächste Runde anlegen.
- Die App bevorzugt gültige Paarungen, die freie Tische sofort besetzen können. Die Regel gegen Wiederholungen gilt weiterhin.
- Solange ein früheres Ergebnis fehlt, zeigt die Paarung „Wartet auf ein Ergebnis“. Danach erscheint der Startbutton, sobald ein Tisch frei ist.

Neu in v7.20:
- Neue Paarungen folgen möglichst der Tabelle und berücksichtigen alle noch nötigen Runden.
- Bei acht Spielern umfasst ein Durchgang sieben Runden mit 28 verschiedenen Paarungen.
- Der nächste Durchgang beginnt nach Abschluss aller Matches des vorigen Durchgangs.
- Bei ungerader Spielerzahl gibt es in einem regulären Durchgang ein Freilos pro Spieler.
- Enthält die letzte, noch ungespielte Runde eine vorzeitige Wiederholung, können ihre Paarungen neu erstellt werden.
- Ältere Turniere mit ungünstigen Paarungen können zusätzliche Runden mit weniger Matches benötigen.

Neu in v7.19:
- Spielerliste: Über ⋯ oder Wischen nach links lässt sich ein gespeicherter Name bearbeiten.
- Bereits gespielte Turniere und JSON-Sicherungen behalten ihre ursprünglichen Einträge.

Neu in v7.18:
- Dateiname beim Speichern frei ändern; die letzte Wahl wird vorgeschlagen.
- Zeitturniere: Uhrzeit als Turnierende, später änderbar.
- Ab Endzeit keine neue Runde. Auswahl: letzte Runde fertigspielen oder Endzeit ändern.
- Beim Fertigspielen bleiben alle bereits angelegten Paarungen spielbar; danach Abschlusstabelle.
- Zurück/Vor für Turnieraktionen während der aktuellen App-Sitzung.
- Turnier jederzeit beenden: Speichern und beenden / Ohne Datei beenden / Abbrechen.
- Starten grün (dezent pulsierend), Ergebnis eintragen blau, Korrigieren orange.
- Reduzierte Bewegung wird berücksichtigt.
- Bestehende JSON-Turniersicherungen können weiterhin geladen werden.

Installation: Alle enthaltenen Dateien im bisherigen GitHub-Ordner ersetzen.
App danach neu öffnen, gegebenenfalls einmal aktualisieren. Unten muss v7.23 stehen.
Vor dem Update das laufende Turnier als JSON sichern.
Die Speicherung einer Datei wird je nach Gerät über Teilen oder Download ausgeführt.

Prüfung: JavaScript-Syntax und automatisierte Tests der Turnierlogik bestanden.
Die Paarungslogik wurde mit 2 bis 12 Spielern und älteren Turnierständen getestet.
Die vorgezogene Rundenplanung und die Freigabe nach Ergebnissen wurden automatisiert geprüft.
Ein vollständiger Browsertest und ein Test auf iOS stehen noch aus.

Änderungen v7.18:
- Deutlichere Start-Animation mit stärkerem Lichtschein und sanfter Größenänderung.
- Endzeit nur als Uhrzeit eingeben und anzeigen. Eine bereits vergangene Uhrzeit gilt für den nächsten Tag.
- Neue Runde starten steht direkt im Feld der neuesten Runde. Die Verfügbarkeitsregeln bleiben bestehen.
- Für jedes startbereite Match erscheinen Startbuttons für alle aktuell freien Tische.
- Belegte Tische werden nicht angeboten; nach einem Ergebnis stehen sie wieder zur Verfügung.

Änderungen v7.18:
- Uhrzeitfeld bleibt auf iOS in seiner Spalte und erhält eine passende Höhe.
- Endzeit ändern als kompakter Button.
- Alle noch nicht aufgerufenen Partien pulsieren am Rahmen weiter, auch wenn kein Tisch frei ist.
- Nach Aufruf an einen Tisch endet die Animation der Partie.
- Zurück/Vor bleiben beim Scrollen oben angeheftet; Turnier beenden bleibt separat.

Änderungen v7.18:
- Nicht gestartete Matches zeigen bei belegten Tischen ein grün pulsierendes „Match wartet“.
- Sobald ein Tisch frei wird, werden wieder alle verfügbaren Tischnummern zum Start angeboten.
- Ergebnis eintragen wird erst nach Tischzuweisung angeboten; Korrigieren bleibt für gespielte Matches verfügbar.

Änderungen v7.18:
- Startbereite bestehende Paarungen haben Vorrang: solange ein freier Tisch dafür genutzt werden kann, lässt sich keine neue Runde erstellen.
- Bereits angelegte Runden bleiben erhalten. Weiterhin blockieren frühere offene Matches die betroffenen Spieler.
- Dauerhafte Spielerliste auf diesem Gerät/Browser: Namen antippen, neue Spieler hinzufügen und gespeicherte Namen löschen.
- Eingaben in Spielerfeldern werden beim Verlassen des Feldes gespeichert; beim Turnierstart werden alle Namen übernommen.
- Beim ersten Öffnen werden die Spieler des vorhandenen Turniers in die Liste übernommen.
- Löschen aus der Spielerliste verändert keine bestehenden Turnierergebnisse.

Änderungen v7.18:
- Gespeicherte Teilnehmer als Liste: ein Name pro Zeile, Auswahl per Antippen mit Häkchen.
- „Neuer Spieler“ als separate Eingabezeile unter der Liste.
- Nach links wischen öffnet den roten Löschen-Button; Löschen erfolgt erst nach Bestätigung.
- Alternativ über ⋯ erreichbar, auch ohne Wischen. Nach rechts wischen schließt die Aktion.
- Löschen aus der Liste verändert keine bisherigen Turnierergebnisse.
