Snooker Money Match v7.49
Alle Dateien auf GitHub hochladen und die App anschließend neu öffnen.
Im Turniermodus sichern und laden die beiden Schaltflächen eine JSON-Datei.
Die Matchzeit startet mit der Tischzuweisung und endet beim Speichern des Ergebnisses.
Im Turnier nach links zum Zwischenstand mit Break-Abrechnung wischen, nach rechts zurück zu den Runden.
Alternativ die Schaltflächen Runden und Zwischenstand verwenden.
In der Tabelle schaltet „Vollbild an/aus“ die große Anzeige ein und aus.
Gespielte Breaks ab 20 stehen in der Tabelle und bei den abgeschlossenen Matches.
Turniere werden lokal gespeichert. Mit Firebase-Anmeldung wird der Turnierstand automatisch über beide Geräte synchronisiert.

Neu in v7.49:
- Beim Laden einer JSON-Turnierdatei wird der gesamte Turnierstand ausschließlich aus der Datei übernommen, einschließlich Tabellen, Saison-/Jahresarchiven, Elo und mitgesicherter anderer Turnierart.
- Lokale Vorgängerstände werden beim Import vollständig ersetzt. Rückgängig/Wiederholen startet nach dem Laden neu.
- Bei aktiver Live-Synchronisierung wird der Dateistand als vollständiger Ersatz übertragen.
- Auch beim Laden eines Einzel-Matches werden alte Wiederholen- und Matchwechsel-Zustände verworfen.

Neu in v7.48:
- Eigene Auswahlbuttons für Elo-Wertung und die Spieltage nach Kalenderjahren, z. B. Saison 2026 und Saison 2027.
- Neue Saisonarchive enthalten auch die einzelnen Spieltagstabellen. Jahresansichten bleiben über Saisonwechsel erhalten.
- Gesamtes Jahr nach Warnabfrage löschbar. Für ein Jahr mit laufendem Spieltag zuerst den Spieltag beenden.
- Löschung entfernt auch aktuelle abgeschlossene Ergebnisse des betreffenden Jahres. Elo bleibt fortlaufend und kann separat geändert oder auf 1000 zurückgesetzt werden.
- Ältere Saisonarchive mit nur einer Gesamttabelle bleiben lesbar. Fehlende Spieltagsdetails benötigen eine ursprüngliche Turniersicherung.

Neu in v7.47:
- Neuer rechter Reiter „Spieltage & Elo“ mit einzelnen Spieltagstabellen und Elo-Verwaltung.
- Saisonstart unten in der Saisontabelle mit rotem Warnbutton.
- Ein Popup fragt den Archivnamen und zeigt eine deutliche Warnung. Erst die Bestätigung archiviert die Tabelle und startet die neue Saison.
- Der Saisonwechsel bildet eine Grenze für Rückgängig/Wiederholen. Eine archivierte Tabelle kann angesehen und exportiert werden.

Neu in v7.46:
- Tages- und Abschlusstabelle zeigen ausschließlich Matchpunkte sowie Spiele, Siege, Remis und Frame-Differenz.
- Rangfolge: Matchpunkte, Frame-Differenz, direkter Vergleich. Danach geteilter Platz.
- Buchholz vollständig aus Berechnung und Tabellen entfernt.
- Unter der Tageswertung stehen nur die Breaks und die Exportbuttons.
- Neue Seite „Allgemeine Infos & Regeln“ mit ausführlichen Erklärungen aller Modi und Einstellungen, auch offline verfügbar.
- Saisonpunkte bleiben in der Saisontabelle und in den einzelnen Spieltagsübersichten der Saison sichtbar.

Neu in v7.45:
- Unter der Saisontabelle stehen die einzelnen Spieltage mit Platzierung, Namen und Saisonpunkten, neuester Spieltag zuerst.
- Laufende Spieltage sind als vorläufig gekennzeichnet. Jeder Spieltag kann als CSV und PDF exportiert werden.
- Neue Tageszusammenfassungen speichern Datum und Platzierung. Bei älteren Zusammenfassungen wird das Datum aus dem Turnierstart ermittelt.
- Frühere Zusammenfassungen behalten die gespeicherten Punkte. Für Neuberechnungen ist die ursprüngliche Turnierdatei erforderlich.

Neu in v7.44:
- Tagesrangfolge: Matchpunkte, Frame-Differenz, direkter Vergleich, Buchholz.
- Direkter Vergleich bei vollständigen Begegnungen der gleichplatzierten Gruppe. Bei Wiederholungen zählt der Punktedurchschnitt je Gegner.
- Buchholz summiert die Tagespunkte der Gegner je gespielter Begegnung. Freilose zählen mit den eigenen Tagespunkten als Ersatzgegner.
- Club Liga: Saisonpunkte nach Teilnehmerzahl bis 1. Geteilte Plätze erhalten den Mittelwert ihrer Platzpunkte.
- Laufende Tagestabelle zeigt Matchpunkte. Nach Ende stehen Saisonpunkte und Matchpunkte in der Abschlusstabelle.
- Die Saisontabelle enthält während des laufenden Spieltags vorläufige Platzpunkte. Teilnahmen erst nach Turnierende mit Ergebnis.
- Bereits gespeicherte Tageszusammenfassungen und Saisonarchive behalten ihre bisherigen Punkte.

Neu in v7.43:
- Einzel: PDF-Abrechnung mit Spielstand, Breaks, Match-Historie, kumulierten Salden und verrechneten Zahlungen.

Neu in v7.42:
- Turniertag, laufende Saison, Saisonarchiv und Elo als CSV oder PDF speichern.

Neu in v7.41:
- Einzel, Club Liga und Freies Turnier sind mittig auf der Startseite angeordnet und direkt auswählbar.
- Im Einzelmodus steht „Startseite“ unter dem Club-Logo.

Neu in v7.40:
- Datum, Uhrzeit und Auswahllisten verwenden dieselbe Feldgröße.

Neu in v7.39:
- Das Club-Logo füllt den Kopfbereich auf allen Ansichten mit Logo proportional aus.

Neu in v7.38:
- Turnierdatum, einheitliche Auswahlfelder und nummerierte Club-Liga-Spieltage.

Neu in v7.37:
- Kompakter Ergebnisdialog. Namen antippen für +1 Frame, Breaks bei Bedarf einblenden.

Neu in v7.36:
- Vollbildtabellen passen die Schrift an Bildschirm und Teilnehmerzahl an. Hinweise und Breaks bleiben in der Normalansicht sichtbar.

Neu in v7.35:
- Teilnahmen werden erst beim Beenden eines Turniers mit mindestens einem gespeicherten Matchergebnis gebucht.

Neu in v7.34:
- Die Turnier-Spielerliste wird nach Firebase-Anmeldung automatisch synchronisiert.

Neu in v7.33:
- Club Liga: Elo unter Gesamt, Startwert 1000, K-Faktor 32, Fortschreibung über Saisonwechsel.
- Einzelwerte manuell ändern oder die gesamte Elo-Wertung auf 1000 zurücksetzen.

Neu in v7.32:
- Turnier öffnet die Auswahl Freies Turnier oder Club Liga. Der Wechsel erfolgt über die Startseite.

Neu in v7.31:
- Archivierte Saisons lassen sich unter Gesamt einzeln löschen.

Neu in v7.30:
- Club Liga Saison und Freies Turnier haben getrennte Spielstände. Beim Wechsel wird das andere Turnier geparkt.
- Turnier-JSONs enthalten auch den geparkten Spielstand.

Neu in v7.29:
- Unter Gesamt nach Turnierende eine neue Saison starten. Die alte Tabelle bleibt im Saisonarchiv und kann als CSV gespeichert werden.

Neu in v7.28:
- Einzel-Spielstände werden auf dem zweiten Gerät direkt in der geöffneten Ansicht aktualisiert.

Neu in v7.27:
- Automatische Turnier-Synchronisierung nach Firebase-Anmeldung im Einzelmodus. Eingaben sind auf beiden Geräten möglich.
- Aktuelle Tabelle und Gesamt wechseln auf beiden Geräten mit. Vollbild bleibt gerätebezogen.

Neu in v7.26:
- Startbuttons für freie Tische pulsieren wieder grün.

Neu in v7.25:
- Gesamt zählt Teilnahmen pro Spieltag.
- Horizontal zwischen Runden, aktueller Tabelle und Gesamt wechseln. Im Vollbild wechseln nur die beiden Tabellen.
- Für zwei Geräte im Einzelmodus mit demselben Firebase-Konto anmelden. Im Turnier auf dem Eingabegerät Live senden und auf dem anderen Gerät Live ansehen wählen. Vollbild wird pro Gerät eingestellt.

Neu in v7.24:
- Gesamt zeigt Platz, Name und Punkte aus abgeschlossenen Spieltagen plus aktuellem Turnier.
- Die Gesamtwertung wird mit der Turnier-JSON gesichert. Gleich geschriebene Namen werden zusammengezählt.

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
App danach neu öffnen, gegebenenfalls einmal aktualisieren. Unten muss v7.49 stehen.
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
