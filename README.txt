Snooker Money Match v7.12
Alle Dateien auf GitHub hochladen und die App anschließend neu öffnen.
Im Turniermodus sichern und laden die beiden Schaltflächen eine JSON-Datei.
Die Matchzeit startet mit der Tischzuweisung und endet beim Speichern des Ergebnisses.
Im Turnier nach links zum Zwischenstand mit Break-Abrechnung wischen, nach rechts zurück zu den Runden.
Alternativ die Schaltflächen Runden und Zwischenstand verwenden.
In der Tabelle schaltet „Vollbild an/aus“ die große Anzeige ein und aus.
Gespielte Breaks ab 20 stehen in der Tabelle und bei den abgeschlossenen Matches.
Die Live-Synchronisierung gilt für den Einzelmodus. Turniere werden lokal gespeichert.

Neu in v7.12:
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
App danach neu öffnen, gegebenenfalls einmal aktualisieren. Unten muss v7.12 stehen.
Vor dem Update das laufende Turnier als JSON sichern.
Die Speicherung einer Datei wird je nach Gerät über Teilen oder Download ausgeführt.

Prüfung: JavaScript-Syntax und automatisierte Tests der Turnierlogik bestanden.
Ein vollständiger Browsertest und ein Test auf iOS stehen noch aus.

Änderungen v7.12:
- Deutlichere Start-Animation mit stärkerem Lichtschein und sanfter Größenänderung.
- Endzeit nur als Uhrzeit eingeben und anzeigen. Eine bereits vergangene Uhrzeit gilt für den nächsten Tag.
- Neue Runde starten steht direkt im Feld der neuesten Runde. Die Verfügbarkeitsregeln bleiben bestehen.
- Für jedes startbereite Match erscheinen Startbuttons für alle aktuell freien Tische.
- Belegte Tische werden nicht angeboten; nach einem Ergebnis stehen sie wieder zur Verfügung.

Änderungen v7.12:
- Uhrzeitfeld bleibt auf iOS in seiner Spalte und erhält eine passende Höhe.
- Endzeit ändern als kompakter Button.
- Alle noch nicht aufgerufenen Partien pulsieren am Rahmen weiter, auch wenn kein Tisch frei ist.
- Nach Aufruf an einen Tisch endet die Animation der Partie.
- Zurück/Vor bleiben beim Scrollen oben angeheftet; Turnier beenden bleibt separat.
