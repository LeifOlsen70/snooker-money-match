Snooker Money Match v7.78

Neu: vier Ziffern und erneutes Verbinden
- Tischcodes haben exakt vier zufällige Ziffern, z. B. 0427. Führende Nullen gehören zum Code.
- Ein Code wird in einer Datenbanktransaktion reserviert. Bereits belegte Codes werden nicht überschrieben.
- Neue Turniere erhalten neue Codes. Neuladen erhält den aktuellen Code. Alte Reservierungen werden bei einer neuen Zuordnung freigegeben.
- „Tisch verlassen“ gibt die Verbindung am Server frei und entfernt die Mitgliedschaft des Geräts. Danach kann dasselbe oder ein anderes Gerät den Code verwenden.
- Ohne Internet wird das Trennen nicht als erfolgreich ausgegeben. Bitte dann erneut versuchen oder beim Spielleiter zurücksetzen.
- Score Monitor > Tischcodes > Verbindung Tisch … zurücksetzen: alte Verbindung sperren und den Tisch für ein neues Gerät freigeben. Der Spielstand bleibt erhalten.
- Die Verbindung hat zusätzlich zum sichtbaren Zahlencode eine interne Generation. Ältere Geräte erhalten durch eine spätere Wiederverwendung derselben vier Ziffern keinen Zugriff auf eine neue Tischzuordnung.
- Pro Tisch bleibt genau ein Eingabegerät gleichzeitig verbunden.
- Tischgeräte brauchen keine Registrierung und keine E-Mail: im ☰-Menü „Mit Tischcode beitreten“ wählen. Codes nur an die vorgesehenen Geräte weitergeben.

Update:
1. Turnierstand vorsorglich als JSON sichern.
2. Alle Webdateien auf GitHub aktualisieren und die neue firestore.rules in Firebase veröffentlichen. Die Regeln aus v7.76 sind für das neue Verfahren nicht ausreichend.
3. Zuerst das Turnier am Spielleitergerät öffnen, damit die kurzen Codes erzeugt werden.
4. Alle Geräte auf v7.78 aktualisieren. Bisherige lange Codes durch die neuen vierstelligen ersetzen und Geräte erneut verbinden.
5. Kein zusätzlicher Server, keine Cloud Functions und kein Tarifwechsel erforderlich.

Prüfung: Join/Leave-Funktionen mit simulierten Firebase-Transaktionen, gleiche/andere Geräte nach Trennung, Offline-Abbruch ohne Verlust der Identität, konkurrierende Beitritte, Code-Kollisionen, führende Null, Generationswechsel ohne Scoreverlust, Undo/Redo und Frame-Ergebnisse automatisiert geprüft. Kein Live-Firebase-Mehrgerätetest oder Firebase-Regel-Emulatortest in dieser Umgebung durchgeführt.

Bisherige Hinweise:

Snooker Money Match v7.76

Neue aufgeräumte Navigation gemäß Entwurf:
- Links unter dem unveränderten Clublogo öffnet ☰ das Menü.
- Kontoanzeige, Anmelden/Abmelden/Konto wechseln, Startseite, Mit Tischcode beitreten und Benutzerfreigaben mit Anfragezahl befinden sich im Menü. Nur die für die Rolle verfügbaren Aktionen werden angezeigt.
- Direkt darunter stehen Zurück – Aktualisieren – Vor als drei Buttons in einer Zeile. Die Buttons verwenden die bestehenden Rückgängig-/Wiederholen-Aktionen.
- Aktualisieren ruft den aktuellen Serverstand ab, ohne die Seite neu zu laden; noch ausstehende Eingaben werden nicht durch den Abruf ersetzt.
- Am Tischgerät aktualisiert der Button ausschließlich dessen Tischstand. Tisch verlassen befindet sich dort im Menü.
- Die bisherigen unteren Bedienbuttons entfallen. CSV/PDF bleiben bei den Tabellen, weitere Reiter bleiben wischbar und Allgemeine Infos & Regeln weiterhin letzter Reiter.
- In der Vollbildanzeige bleiben die zur Anzeige passenden bisherigen Bedienmöglichkeiten erhalten.
- Firebase-Regeln unverändert gegenüber v7.75. Kein erneutes Veröffentlichen nötig.
- Alle Dateien auf GitHub aktualisieren und App neu öffnen, bis v7.76 erscheint.

Prüfung: Menü-/Toolbar-DOM-Logik, erhaltene Button-Funktionen, Drei-Button-Reihenfolge, Status gesperrter Buttons, Aktualisierung ohne Reload, Schutz ausstehender Eingaben, Tisch-Synchronisierung und lokale/globale Warnabschaltung automatisiert geprüft. Die visuelle Prüfung im Browser konnte in dieser Umgebung nicht durchgeführt werden; bitte die Darstellung auf iPhone und iPad kontrollieren.

Bisherige Hinweise:

Ergänzung innerhalb v7.75 – unterschiedliche Warnabschaltung:
- Am Tischgerät: „Warnung aus“ gilt nur lokal auf diesem Gerät für den aktuellen Frame, auch nach Neuladen. Keine Übertragung einer Abschaltung an die Spielleitung.
- Am Spielleitergerät im Score Monitor oder in Runden: „Warnung aus“ wird für diesen Tisch und Frame an alle Geräte übertragen.
- Im folgenden Frame ist die Warnung wieder aktiv. Versionsnummer und Firebase-Regeln bleiben unverändert.

Snooker Money Match v7.75

Korrektur Zurück/Vor:
- Die oberen Turnierbuttons führen vorhandene Zählwerk-Eingaben jetzt direkt über die gemeinsame Ereignisliste des Tischstands zurück bzw. wieder aus.
- Dabei bleibt die Liste für Wiederholen auf dem Tischgerät bestehen. Punkte, Breaks, Warnung-aus und Frame-Abschlüsse folgen derselben Historie auf beiden Geräten.
- Die verfügbaren Schritte kommen aus dem gespeicherten Tischstand, auch nach einer Anmeldung auf einem anderen Gerät oder einem Neuladen.
- Echte Turnieraktionen (z. B. Tischzuweisung) behalten ihren separaten bisherigen Verlauf. Zählwerk-Rücknahmen haben Vorrang, solange entsprechende Schritte vorhanden sind.
- Neu bestätigte Tischbefehle aktualisieren den lokalen Tischcache sofort nach erfolgreicher Datenbanktransaktion.
- Bei einer zwischenzeitlichen Änderung wird der Schritt mit einer Meldung abgewiesen, statt einen fremden neueren Stand zu überschreiben.
- Warnung aus und die Voreinstellung 30 Minuten pro Frame aus v7.74 bleiben erhalten.
- Alle beteiligten Geräte auf v7.75 aktualisieren. Firestore-Regeln unverändert gegenüber v7.72/v7.73/v7.74.

Prüfung: Zwei simulierte Firebase-Geräte mit tatsächlichem Toolbar-Controller: Punkte und Frame-Ende vom Tischgerät, Undo/Redo am Spielleitergerät und umgekehrt. Prüfung der übermittelten Cursor-/Wiederholen-Liste, privaten Tischrechte und Trennung struktureller Historie. Kein echter Firebase-Mehrgerätetest durchgeführt.

Bisherige Hinweise:

Snooker Money Match v7.74

Neu:
- Bei Zeitüberschreitung steht am Rundenbutton nur „Spielzeit überschritten“, ohne Aufforderung zur Ergebniseingabe. Es öffnet sich kein automatisches Eingabefenster; die Spielleitung entscheidet selbst.
- „Warnung aus“ in Runden, Score Monitor und Tischdetails schaltet die Warnung für den aktuellen Frame ab. Beim nächsten Frame ist die Warnung wieder aktiv.
- In Tischdetails pulsiert nur der Warnhinweis; Zurück/Vor blinken nicht.
- Synchronisierungs-Rückmeldungen mit ausschließlich neuer Versionsnummer überschreiben nicht mehr den Zurück-/Vor-Verlauf. Veraltete Tischstände werden während einer Rücknahme nicht erneut angewandt.
- Kurz während einer laufenden Tisch-Synchronisierung sind globale Zurück-/Vor-Aktionen gesperrt; nach Abschluss werden die Buttons passend zur Historie wieder freigegeben.
- 30 Minuten pro Frame bleiben voreingestellt, 0 schaltet das Limit aus.
- Alle Geräte auf v7.74 aktualisieren: Das neue Warnung-aus-Ereignis setzt die neue Version auch auf den Tischgeräten voraus.
- Firestore-Regeln unverändert gegenüber v7.72/v7.73. Keine erneute Veröffentlichung erforderlich, wenn diese bereits veröffentlicht sind.

Prüfung: Warnung-aus ohne Punkteänderung, Reaktivierung im nächsten Frame, Rückgängig/Wiederholen der Abschaltung, Wiederherstellung von Undo/Redo trotz Tisch-Synchronisation, Zeitgrenzen sowie getrennte Tischstände automatisiert geprüft. Kein echter Firebase-Mehrgerätetest und keine visuelle Browserprüfung durchgeführt.

Bisherige Hinweise:

Snooker Money Match v7.73

Neu: Spielzeitlimit pro Frame
- Bei „Turnier anlegen“ Minuten pro Frame einstellen (Voreinstellung 30 Minuten; 0 = keine Warnung, bis 1440 Minuten).
- Die Warnzeit beginnt bei Matchstart. Jeder bestätigte Frame-Sieg startet die Warnzeit für den nächsten Frame neu.
- Überschreitung: Ergebnisbutton unter Runden sowie Tischzeile im Score Monitor und Tischanzeige pulsieren mit „Spielzeit überschritten“.
- Punkteingaben setzen die Warnzeit nicht zurück. Rückgängig/Wiederholen berücksichtigt den jeweiligen Frame-Verlauf.
- Bei abgeschlossenem Match oder beendetem Turnier keine Warnung. Keine automatische Vergabe eines Sieges, keine automatische Beendigung.
- Die gesamte Matchspielzeit bleibt unverändert sichtbar.
- Limit und Frame-Ereignisse werden mit dem Turnier gespeichert und an Tischgeräte synchronisiert. Ältere Sicherungen ohne Limit bleiben ohne Warnung nutzbar.
- Alle beteiligten Geräte auf v7.73 aktualisieren.
- Firestore-Regeln bytegleich mit v7.72. Keine weitere Regeländerung für die Zeitwarnung nötig. Die Löschfunktion aus v7.72 setzt weiterhin deren veröffentlichte Regeln voraus.

Prüfung: Zeitgrenze, Framewechsel 1/2/3, Punkteingaben, Rückgängig/Wiederholen, beendete Partien, deaktiviertes Limit und tatsächliche Rundenbutton-Logik automatisiert geprüft. Kein Live-Mehrgerätetest und keine visuelle Browserprüfung in dieser Umgebung durchgeführt.

Bisherige Hinweise:

Snooker Money Match v7.72

Neu:
- Spielzeit HH:MM:SS je Paarung im kompakten Score Monitor, aktualisiert jede Sekunde. Nach Ende der Partie bzw. des Turniers bleibt die Zeit stehen.
- Gesperrte/abgelehnte Benutzer können aus der Benutzerfreigabeliste gelöscht werden, nach Bestätigung. Freigegebene Konten zuerst sperren.
- Gelöscht wird der Freigabeeintrag, nicht das Firebase-Authentication-Konto und nicht der persönliche Spielstand.
- Bei späterer Anmeldung mit derselben E-Mail und dem bisherigen Passwort entsteht eine neue Freigabeanfrage. Bei vergessenem Passwort die vorhandene Wiederherstellung nutzen.
- Es ist kein zusätzlicher kostenpflichtiger Server erforderlich. Admin-Löschung des eigentlichen Authentication-Kontos wird nicht angeboten.
- Neue firestore.rules veröffentlichen: Löschen von snookerAccess ist ausschließlich dem Administrator und nur für abgelehnte Einträge gestattet.
- Alle Webdateien auf GitHub hochladen und Geräte aktualisieren, bis v7.72 angezeigt wird.

Prüfung: Zeitberechnung, höchste Breaks, Administratorrechte, Löschen nur abgelehnter Einträge, Schutz freigegebener/offener Konten, keine sofortige Neuanfrage nach Löschung und erneute Anfrage bei späterer Anmeldung automatisiert geprüft. Kein Live-Firebase-/Mehrgerätetest durchgeführt.

Bisherige Hinweise:

Snooker Money Match v7.71

Neu: Kompakter Score Monitor im bestätigten Entwurf.
- Drei Paarungen untereinander mit Spielernamen links und Live-Punkten rechts.
- Frames und ausschließlich höchstes Break (HB) je Spieler. Kein Break unter 20; ohne qualifizierendes Break erscheint –.
- Einzelne gespielte Breaks werden im Monitor nicht aufgelistet. Die Turnier-Breakhistorie bleibt erhalten.
- Tisch antippen öffnet Eingabe und Details mit bisherigen Frame-Siegern und Zurück/Vor.
- Vollbild verwendet die Bildschirmhöhe für drei Tischzeilen; zusätzliche Tische sind darunter scrollbar.
- Bestehende Funktionen aus v7.70 (Freigabezähler, Aktualisieren, Tischcodes und Synchronisierung) erhalten.
- Firebase-Regeln bytegleich mit v7.70; keine neue Veröffentlichung nötig.
- Alle Dateien wie bisher auf GitHub hochladen und Geräte aktualisieren, bis v7.71 erscheint.

Prüfung: JavaScript-Syntax, kompakte Zeilen, HB-Schwelle, Rücknahme des höchsten Breaks und Datenzugriffsdateien geprüft. Die visuelle Browserprüfung war in dieser Umgebung wegen eines blockierten Browserstarts nicht möglich. Bitte auf iPhone und iPad/TV die tatsächliche Darstellung kontrollieren.

Bisherige Anleitung:

Snooker Money Match v7.71
Alle Dateien auf GitHub hochladen und die App anschließend neu öffnen.
Im Turniermodus sichern und laden die beiden Schaltflächen eine JSON-Datei.
Die Matchzeit startet mit der Tischzuweisung und endet beim Speichern des Ergebnisses.
Im Turnier nach links zum Zwischenstand mit Break-Abrechnung wischen, nach rechts zurück zu den Runden.
Alternativ die Schaltflächen Runden und Zwischenstand verwenden.
In der Tabelle schaltet „Vollbild an/aus“ die große Anzeige ein und aus.
Gespielte Breaks ab 20 stehen in der Tabelle und bei den abgeschlossenen Matches.
Turniere werden lokal gespeichert. Mit Firebase-Anmeldung wird der Turnierstand automatisch über beide Geräte synchronisiert.

Neu in v7.61 – Live-Übernahme und höchstes Saisonbreak:
- Laufende Frame-Zwischenstände erscheinen im Reiter Runden, ohne das Match vorzeitig zu beenden.
- Breaks ab 20 aus dem Score Monitor erscheinen auch vor Matchabschluss in Tabelle Turniertag.
- Tabelle Saison enthält je Teilnehmer HB Saison (nur den höchsten Wert über alle Spieltage der Saison).
- Höchstes Break wird beim Abschließen eines Spieltags in der Saisonhistorie gespeichert und beim Saisonwechsel archiviert.
- Alte Spieltage ohne gespeicherte Breakdaten können rückwirkend nicht rekonstruiert werden.
- Vor Installation bitte Turnier-JSON sichern; GitHub-Dateien auf allen Geräten aktualisieren.

Neu in v7.60 – Korrektur auf Basis von v7.58:
- Firebase-Fehler „Nested arrays are not supported“ bei vollständigen Ergebnissen mit Break-Listen behoben.
- Break-Listen werden nur für die Datenbankübertragung umgewandelt und beim Empfang wiederhergestellt. JSON-Dateien und Spielauswertung behalten ihr bisheriges Format.
- Manuelle Ergebnisübernahme, importierte Ergebnisstände sowie Rückgängig/Wiederholen geprüft.
- Lange Tischcodes und Kontentrennung aus v7.58 bleiben erhalten. v7.59 mit kurzen Codes ist nicht enthalten.
- Firebase-Regeln sind unverändert identisch mit v7.58. Kein erneutes Veröffentlichen erforderlich.
- Alle beteiligten Geräte auf v7.61 aktualisieren. Bestehende Daten vorsorglich zuvor als JSON sichern.

Neu in v7.58 – Tischcodes ohne E-Mail:
- Jeder normale E-Mail-/Passwort-Nutzer kann seine eigenen Tischgeräte verbinden.
- Score Monitor > Tischcodes anzeigen: zufälliger Code je Tisch und Turnier.
- Tischgerät > Mit Tischcode beitreten: keine E-Mail-Adresse und kein Passwort nötig. Firebase meldet das Gerät im Hintergrund anonym an.
- Ein neu erstelltes Turnier erzeugt neue Codes und entzieht vorherigen Tischgeräten den Zugriff. Neuladen desselben Turniers erhält die Codes und Verbindung.
- Die Codes sind Zugangsschlüssel: nur an die vorgesehenen Tischgeräte weitergeben.
- Live-Punkte, Frame-Ergebnisse, automatische Breaks ab 20 und Ergebnisübernahme bleiben erhalten.
- Bis zu sechs Tischgeräte entsprechend der eingestellten Tischzahl. Ein Gerät kann auch nur zur Anzeige genutzt werden.
- Tisch verlassen trennt nur dieses Gerät. Alte Tischkonten bleiben in Firebase bestehen, werden aber nicht mehr benötigt.
- Die bereits veröffentlichten firestore.rules aus v7.58 bleiben gültig. Authentication: E-Mail/Passwort und Anonym aktivieren.
- Spark beibehalten: kein zusätzlicher Server, keine Cloud Functions, keine Abrechnung aktivieren.
- Anleitung: TISCHMONITORE_EINRICHTUNG.txt.

Neu in v7.55:
- Anmelde-/Kontobutton und Startseite gemeinsam am Seitenende, gleich groß. Auf der Startseite bleibt der violette Anmeldebutton zentriert und so breit wie die Auswahlbuttons.
- Turnierreiter stehen direkt nach den Zurück-/Vor-Steuerungen unter dem Logo.
- Horizontales Wischen wechselt die Seite einschließlich Infos und richtet die sichtbaren Reiter passend aus. Maximal vier Reiter bleiben gleichzeitig sichtbar.
- Turnier-Vollbild wechselt weiterhin zwischen Tages- und Saisontabelle.
- Break-Eingabe bleibt nach Rückfrage unverändert. Automatische Break-Übernahme wartet auf eine definierte Zählwerkquelle.

Neu in v7.54:
- Allgemeine Infos & Regeln als vierter gelber Button auf der Startseite.
- In Einzel, Club Liga, Freiem Turnier und den Einrichtungsansichten steht die Info als letzter Reiter.
- Maximal vier Reiter sind gleichzeitig sichtbar. Die Leiste lässt sich horizontal scrollen/wischen, auf dem Rechner auch mit dem Mausrad.
- Reiterleisten-Wischen löst keinen Wechsel der Spielansicht aus. Beim Öffnen der Infos bleibt der aktuelle Eingabestand erhalten.
- Die Info wird innerhalb der App angezeigt; „Zurück zur App“ schließt sie wieder.

Neu in v7.53:
- „Elo-Wertung“ und die Jahresbuttons öffnen beim ersten Tippen und schließen beim erneuten Tippen.
- Die Elo-Tabelle erscheint direkt ohne zusätzlichen aufklappbaren Elo-Pfeil.
- Freie Turniere besitzen ebenfalls den Reiter „Spieltage“ mit auf-/zuklappbaren Jahresbuttons, ohne Elo-Funktion.
- CSV-/PDF-Export und Elo bearbeiten/zurücksetzen bleiben erreichbar.

Neu in v7.52:
- Einzel-Live-Scoreboard ohne dauerhaft sichtbaren Ziffernblock, mit größeren Punktefeldern.
- Spielerkarte antippen öffnet ein großes Eingabepopup auch im Vollbild.
- „Zurück zur Punkteanzeige“, Escape oder Antippen außerhalb schließt ohne Punkteübernahme.
- Erst „BREAK ÜBERNEHMEN“ verbucht die eingegebenen Punkte mit der bisherigen Break-/Prämienlogik.
- Eingabe bleibt je Gerät lokal; ein empfangener neuer Spielstand schließt einen offenen Entwurf, um Eingaben in einen veralteten Stand zu verhindern.

Neu in v7.51:
- „Ohne Anmeldung fortfahren“ öffnet Einzel, Club Liga oder Freies Turnier ohne Cloud-Verbindung.
- Ein eigener lokaler Gastbereich bleibt auf dem Gerät erhalten. Kontodaten und Gastdaten werden nicht automatisch vermischt.
- „Anmelden / Registrieren“ bleibt im Gastmodus erreichbar. „Abbrechen“ führt weiterhin zur Startseite.
- „Abmelden / Konto wechseln“ ist bei angemeldeten Konten wie bisher oben erreichbar.
- Eine gespeicherte Firebase-Anmeldung im Hintergrund verbindet den Gastbereich nicht mit der Cloud.

Neu in v7.50:
- Kontoanmeldung nach Auswahl von Einzel, Club Liga oder Freiem Turnier.
- Registrierung per E-Mail/Passwort, dauerhaft gespeicherte Anmeldung und Passwort-zurücksetzen.
- Eigene Cloud-Daten und lokale Spielstände je Benutzerkonto. Abmelden/Kontowechsel lädt die App neu.
- Bestehender Betreiber-Spielstand und Spielerliste werden einmalig in den bisherigen Betreiberbereich übernommen.
- Dateiimporte, Saison-/Jahresarchive, Elo und Exporte bleiben in den Benutzerbereichen verfügbar.
- Vor Nutzung mit neuen Konten die Firebase-Einrichtung gemäß FIREBASE_EINRICHTUNG.txt durchführen und firestore.rules veröffentlichen.

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
App danach neu öffnen, gegebenenfalls einmal aktualisieren. Unten muss v7.61 stehen.
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
