# Offline-Modus: Druckkarten für das Hochzeits-Labyrinth

Backup, falls die App am Tag X nicht läuft. Ablauf wie online: **Frage → Weg laufen → Plättchen hochheben → Schatz**.
Inhalte stammen aus dem Repo: Route aus `js/route.js`, Stationen, Anleitung und Abschluss aus `js/content.js`, Fragen aus `js/questions.js` (eine pro Stufe 1–5, also leicht → schwer).

---

## 1. So funktioniert die Offline-Variante

- Das Brett liegt so, dass der **rote Punkt oben links** ist (wie in der App: Rot oben links, Grün oben rechts, Gelb unten links, Blau unten rechts).
- Die Spielfigur startet auf dem **Startfeld unten rechts** (Ecke mit der Fackel).
- Jede Fragekarte hat 4 Antworten (Rot, Grün, Gelb, Blau). **Jede Antwort zeigt einen Weg.**
- Schreibweise: `2↑` = 2 Felder nach oben. `↑` = Richtung obere Brettkante (die Seite mit Rot und Grün), `↓` = nach unten, `←` = nach links, `→` = nach rechts.
- **Nur der Weg der richtigen Antwort führt durch die Gänge zum Schatzfeld.** Alle drei falschen Wege führen nachweislich vom Brett herunter (per Skript geprüft), meist laufen sie vorher auch durch Mauern. Wer die Antwort nicht weiß, probiert die Wege einfach aus und findet den richtigen trotzdem.
- Am Ziel heben sie das Plättchen hoch, auf dem die Figur steht. Bei Frage 5 das **goldene Podest** in der Mitte.
- Jede Frage startet dort, wo die Figur nach der letzten Frage steht.

## 2. Lösungsblatt (nur für dich)

| Frage | Stufe | Start → Ziel (Reihe,Spalte) | Schatz | Richtig | Richtiger Weg |
|---|---|---|---|---|---|
| 1 | leicht | Start (7,7) → (2,6) | Weihnachtsmarkt / Glühwein-Date | **Gelb**: 64 | `1← 2↑ 1→ 2↑ 1← 1↑` |
| 2 | mittel | (2,6) → (1,2) | Kinoabend | **Blau**: Nordamerika | `1→ 1↑ 2← 1↓ 1← 1↑ 2←` |
| 3 | schwer | (1,2) → (4,1) | Dinner for Two | **Rot**: 9 × 9 Felder | `1← 2↓ 1→ 1↑ 1→ 3↓ 1← 1↑ 1←` |
| 4 | sehr schwer | (4,1) → (7,4) | Spieleabend | **Grün**: Hase und Igel | `3↓ 3→` |
| 5 | Hauptschatz | (7,4) → (4,4) Podest | Flitterwochen | **Blau**: Sky Team | `1← 1↑ 1→ 2↑` |

Reihe 1 = oben, Spalte 1 = links. Frage 5 enthält den Abstecher aus der App: von (7,4) erst ein Feld zurück nach links, dann hoch.

**Alle Karten im Überblick (die Texte, die auf den Karten stehen müssen):**

| Frage | Rot | Grün | Gelb | Blau |
|---|---|---|---|---|
| 1 | 36 · `1← 2↑ 1→ 2↑ 2→` | 49 · `1↑ 1← 2↑ 3→` | **64** · `1← 2↑ 1→ 2↑ 1← 1↑` | 81 · `1← 3↑ 1→ 1↑ 1← 3↑` |
| 2 | Europa · `1↑ 2← 1↓ 1← 2↑` | Deutschland · `1→ 1↑ 2← 1↓ 1← 1↑ 2↑` | Afrika · `1→ 1↑ 2← 1↓ 3→ 1↑` | **Nordamerika** · `1→ 1↑ 2← 1↓ 1← 1↑ 2←` |
| 3 | **9 × 9 Felder** · `1← 2↓ 1→ 1↑ 1→ 3↓ 1← 1↑ 1←` | 8 × 8 Felder · `1← 2↓ 2← 1↓ 1←` | 10 × 10 Felder · `1← 2↓ 1→ 1↑ 1→ 3↓ 1← 1↑ 2←` | 12 × 12 Felder · `1→ 2↓ 1← 1↑ 1← 3↓ 2←` |
| 4 | Rummikub · `4↓ 3→` | **Hase und Igel** · `3↓ 3→` | Scotland Yard · `3↑ 3→ 2↑` | Sagaland · `2↓ 1→ 3↓ 1→` |
| 5 | Die Crew · `1← 1↑ 1→ 2↓` | Patchwork · `1← 1↓ 1→ 1↓` | 7 Wonders Duel · `1→ 1↑ 1← 3↓` | **Sky Team** · `1← 1↑ 1→ 2↑` |

Quellen der Fragen stehen in `js/questions.js` (Feld `src`): Schachregeln (FIDE), en.wikipedia „Ticket to Ride“, „Patchwork (board game)“, de.wikipedia „Spiel des Jahres“ (1979 Hase und Igel, 2024 Sky Team).

## 3. Tipps für ChatGPT und den Druck

- **Vorlage immer mit hochladen.** Zu jedem Prompt steht, welches deiner Bilder als Vorlage dient:
  - **Bild 1** = Fragekarte (Paar schaut über die Labyrinthmauer, 4 Antwortfelder)
  - **Bild 2** = Hauptschatz-Karte (goldenes Herz auf dem Podest, 4 Antwortfelder)
  - **Bild 3** = leere Karte (Paar mit Schatzkarte und Kompass)
  - **Bild 4** = Paar öffnet die Steinplatte mit dem leuchtenden Briefumschlag
- **Format:** Hochformat 2:3 (z. B. 1024 × 1536). Druck z. B. 10 × 15 cm (Fotoformat) oder A6, auf mattem, dickem Papier (≥ 250 g/m²).
- **Text prüfen!** Bildgeneratoren verschreiben sich gern, vor allem bei Pfeilen und Zahlen. Vergleiche jede Karte Zeichen für Zeichen mit der Tabelle oben. Wenn etwas falsch ist: Korrektur-Prompt in Abschnitt 8 nutzen.
- **Plan B für fehlerfreien Text:** Mit den Blanko-Prompts (Abschnitt 7) leere Karten erzeugen und die Texte in Canva/Word/Keynote darüberlegen. Schrift-Tipp passend zur App: *Cormorant Garamond* (Titel), *Jost* (Fließtext), *Pinyon Script* (Namen).
- **QR-Code:** ChatGPT kann keine scanbaren QR-Codes zeichnen (sieht echt aus, funktioniert aber nicht). Deshalb lässt der Prompt ein leeres Feld frei. Den echten Code setzt du danach ein: **`offline/qr-online-spielen.png`** (führt zu https://123zubi.github.io/lab-7x7/, Scan getestet). Nach dem Druck nochmal mit dem Handy testen.

---

## 4. Anleitungskarte (Top-Karte)

### 4A · Anleitung komplett mit QR-Feld (empfohlen) — Vorlage: Bild 3

```
Verwende das hochgeladene Bild als exakte Vorlage für eine Spielkarte im Hochformat 2:3. Behalte alles unverändert bei: den cremefarbenen Papierhintergrund, den dünnen goldenen Doppelrahmen mit abgerundeten Ecken, das kleine goldene Herz oben in der Mitte, die Efeuranken mit kleinen weißen Blüten in den Ecken, die goldenen Ornamente unten links und unten rechts und oben das Chibi-Brautpaar im Aquarell-Stil (Bräutigam mit braunen Locken im dunkelblauen Anzug mit Fliege, Braut mit hochgesteckten hellbraunen Haaren, Blumenkranz und Schleier), das gemeinsam auf eine alte Labyrinth-Schatzkarte mit rotem X zeigt, daneben der goldene Kompass. Zeichne keine neuen Figuren und ändere die Gesichter nicht.

Fülle die leere cremefarbene Fläche unter der Illustration mit folgendem Text, zentriert, sauber gesetzt, viel Weißraum, gut lesbar beim Ausdrucken. Schreibe exakt diese Wörter auf Deutsch mit korrekten Umlauten, ohne zusätzliche Wörter, ohne Tippfehler:

Ganz oben, kleine goldene Kapitälchen mit Sperrung:
BEVOR ES LOSGEHT

Darunter als Überschrift in eleganter dunkelbrauner Serifenschrift (wie Cormorant Garamond), kursiv:
Liebe Fiona, lieber Mark,

Darunter ein kurzer Absatz in schlichter, gut lesbarer dunkelbrauner Schrift:
eure Mini-Ichs haben sich ins Labyrinth gewagt, denn dort sind eure Hochzeitsschätze versteckt. Mit eurer Hilfe finden sie alle!

Darunter ein feiner goldener Trenner mit kleinem Herz in der Mitte.

Darunter die Zwischenüberschrift in Gold:
So funktioniert’s

Darunter eine nummerierte Liste mit kleinen goldenen Kreisen als Nummern 1 bis 5:
1  Legt das Brett so hin, dass der rote Punkt oben links liegt. Eure Figur startet unten rechts.
2  Lest die Fragekarten der Reihe nach vor: Frage 1 bis 5.
3  Jede Antwort zeigt einen Weg. 2↑ heißt: 2 Felder nach oben (Richtung Rot und Grün).
4  Nur der Weg der richtigen Antwort führt durch die Gänge. Falsche Wege enden an einer Mauer oder neben dem Brett.
5  Am Ziel hebt ihr das Plättchen hoch, auf dem eure Figur steht. Darunter liegt euer Schatz!

Darunter eine kleine kursive Zeile in Gold:
Hebt erst ein Plättchen an, wenn ihr am Ende eines Weges steht.

Ganz unten zwischen den beiden goldenen Ecken-Ornamenten: ein leeres, rein cremeweißes Quadrat (ca. 22 % der Kartenbreite) mit dünnem goldenem Rahmen und abgerundeten Ecken, innen komplett leer, kein Muster, kein Code, kein Text. Links daneben in kleiner Schrift:
Lieber digital?
Scannt den Code und spielt online.

Stil: weiches Aquarell, warme Creme-, Gold- und Salbeigrün-Töne, romantisch, hochwertig wie eine Hochzeitspapeterie. Keine Wasserzeichen, kein zusätzlicher Text.
```

Danach `offline/qr-online-spielen.png` in das leere Quadrat legen (Canva, Word, Vorschau o. Ä.).

### 4B · Anleitung kurz und groß lesbar — Vorlage: Bild 3

```
Nutze das hochgeladene Bild exakt als Vorlage (Hochformat 2:3). Behalte Rahmen, goldenes Herz, Efeu, Ornamente und das Chibi-Brautpaar mit Schatzkarte und Kompass oben unverändert bei.

Schreibe in die leere cremefarbene Fläche, groß und gut lesbar, zentriert, exakt diesen deutschen Text ohne zusätzliche Wörter:

(goldene Kapitälchen, klein) DAS HOCHZEITS-LABYRINTH
(große elegante dunkelbraune Serifenschrift) Mark & Fiona
(darunter, normale Schrift)
Rot liegt oben links. Start ist unten rechts.
Lest Frage 1 bis 5 der Reihe nach.
Jede Antwort ist ein Weg: Zahl = Felder, Pfeil = Richtung.
Nur der richtige Weg passt durch die Gänge.
Am Ziel: Plättchen hochheben!

Darunter eine kleine Legende als Zeile mit vier goldenen Pfeilen und Wörtern:
↑ oben   ↓ unten   ← links   → rechts

Ganz unten mittig ein leeres cremeweißes Quadrat mit dünnem Goldrahmen (für einen QR-Code, der später eingefügt wird), innen absolut leer. Darunter klein: Online spielen

Stil: Aquarell, Creme, Gold, Salbeigrün, edle Hochzeitspapeterie. Keine weiteren Texte, keine Wasserzeichen.
```

### 4C · Anleitung als zwei Karten (Begrüßung + Regeln) — Vorlage: Bild 3

Gut, wenn dir 4A zu voll wird.

**Karte 1 · Begrüßung**
```
Nutze das hochgeladene Bild exakt als Vorlage (Hochformat 2:3), alles Bestehende unverändert. Schreibe in die leere Fläche, zentriert, mit viel Weißraum, exakt diesen deutschen Text:

(klein, goldene Kapitälchen) EIN HOCHZEITSGESCHENK FÜR
(groß, elegante Schreibschrift wie Pinyon Script, dunkelbraun) Mark & Fiona
(feiner goldener Trenner mit Herz)
(Serifenschrift, kursiv) Das Hochzeits-Labyrinth
(normale Schrift) Fünf Rätsel, vier Schätze und am Ende ein ganz besonderer Gewinn.
(etwas Abstand, normale Schrift) Eure Mini-Ichs haben sich ins Labyrinth gewagt, denn dort sind eure Hochzeitsschätze versteckt. Mit eurer Hilfe finden sie alle. Wir wünschen euch von Herzen alles Gute und viel Glück zur Hochzeit!

Unten mittig ein leeres cremeweißes Quadrat mit dünnem Goldrahmen, innen leer (dort kommt später ein QR-Code hin). Darunter klein: Lieber digital? Scannt den Code und spielt online.

Aquarellstil, Creme/Gold/Salbeigrün. Keine weiteren Texte.
```

**Karte 2 · Regeln**
```
Nutze das hochgeladene Bild exakt als Vorlage (Hochformat 2:3), alles Bestehende unverändert. Schreibe in die leere Fläche exakt diesen deutschen Text:

(goldene Kapitälchen) SO FUNKTIONIERT’S
(nummerierte Liste mit goldenen Kreisen 1–5, dunkelbraune gut lesbare Schrift)
1  Legt das Brett so hin, dass der rote Punkt oben links liegt.
2  Stellt eure Figur auf das Startfeld unten rechts.
3  Lest die Fragen der Reihe nach: Frage 1 bis 5.
4  Jede Antwort zeigt einen Weg. Nur der richtige passt durch die Gänge.
5  Am Ziel hebt ihr das Plättchen unter eurer Figur hoch. Bei Frage 5 das goldene Podest.

(darunter eine kleine Legende in einem zarten goldenen Kasten)
So lest ihr einen Weg:
2↑ = 2 Felder nach oben (zu Rot und Grün)
1→ = 1 Feld nach rechts
3↓ = 3 Felder nach unten
1← = 1 Feld nach links

(ganz unten, kursiv, Gold) Hebt erst ein Plättchen an, wenn ihr am Ende eines Weges steht.

Aquarellstil, Creme/Gold/Salbeigrün. Keine weiteren Texte.
```

---

## 5. Fragekarten 1–5

Bei allen fünf gilt: Die Antwortfelder (Pillen) haben **zwei Zeilen**: oben die Antwort, darunter klein der Weg. Die Reihenfolge der Farbpunkte bleibt Rot, Grün, Gelb, Blau.

### Frage 1 · leicht · Vorlage: Bild 1

```
Verwende das hochgeladene Bild als exakte Vorlage für eine Quiz-Spielkarte im Hochformat 2:3. Behalte alles unverändert: cremefarbenes Papier, dünner goldener Rahmen mit abgerundeten Ecken, kleines goldenes Herz oben mittig, Efeuranken mit weißen Blüten, oben das Chibi-Brautpaar im Aquarellstil, das fröhlich über eine graue, efeubewachsene Labyrinthmauer schaut, und unten die vier ovalen Antwortfelder mit goldenem Rand, links je ein glänzender Farbpunkt in der Reihenfolge Rot, Grün, Gelb, Blau und rechts je eine kleine goldene Kompassrose. Keine neuen Figuren, Gesichter nicht verändern.

Schreibe exakt folgende deutsche Texte, ohne zusätzliche Wörter und ohne Tippfehler:

In die leere Fläche zwischen Illustration und Antwortfeldern, zentriert:
- ganz oben klein in goldenen Kapitälchen mit Sperrung: FRAGE 1 VON 5
- darunter sehr klein, kursiv, Gold: Start: Startfeld unten rechts
- darunter die Frage groß in eleganter dunkelbrauner Serifenschrift (wie Cormorant Garamond), maximal zwei Zeilen:
  Wie viele Felder hat ein Schachbrett?

In die vier Antwortfelder, jeweils zwischen Farbpunkt und Kompassrose, linksbündig, zweizeilig. Erste Zeile: Antwort in dunkelbrauner Serifenschrift, halbfett. Zweite Zeile: der Weg, etwas kleiner, in Gold, mit gut erkennbaren Pfeilen und Abständen zwischen den Schritten:
- Rotes Feld: 36
  Weg: 1← 2↑ 1→ 2↑ 2→
- Grünes Feld: 49
  Weg: 1↑ 1← 2↑ 3→
- Gelbes Feld: 64
  Weg: 1← 2↑ 1→ 2↑ 1← 1↑
- Blaues Feld: 81
  Weg: 1← 3↑ 1→ 1↑ 1← 3↑

Ganz unten unter den Antwortfeldern, klein, kursiv, Gold, zentriert:
Am Ziel? Hebt das Plättchen hoch, auf dem eure Figur steht!

Alle Pfeile und Zahlen müssen exakt so wie angegeben erscheinen. Stil: weiches Aquarell, Creme, Gold, Salbeigrün, edle Hochzeitspapeterie, druckfertig, keine Wasserzeichen, kein weiterer Text.
```

### Frage 2 · mittel · Vorlage: Bild 1

```
Verwende das hochgeladene Bild als exakte Vorlage für eine Quiz-Spielkarte im Hochformat 2:3. Behalte alles unverändert: cremefarbenes Papier, goldener Rahmen, goldenes Herz oben, Efeu mit weißen Blüten, oben das Chibi-Brautpaar, das über die efeubewachsene Labyrinthmauer schaut, und die vier ovalen Antwortfelder mit Farbpunkten Rot, Grün, Gelb, Blau (links) und goldenen Kompassrosen (rechts). Keine neuen Figuren, Gesichter nicht verändern.

Schreibe exakt folgende deutsche Texte, ohne zusätzliche Wörter und ohne Tippfehler:

In die leere Fläche über den Antwortfeldern, zentriert:
- klein in goldenen Kapitälchen: FRAGE 2 VON 5
- darunter sehr klein, kursiv, Gold: Start: dort, wo eure Figur jetzt steht
- darunter die Frage groß in eleganter dunkelbrauner Serifenschrift, maximal drei Zeilen:
  Welches Gebiet zeigt der Spielplan im Grundspiel von „Zug um Zug“?

In die vier Antwortfelder, zweizeilig zwischen Farbpunkt und Kompassrose. Erste Zeile Antwort (dunkelbraun, halbfett), zweite Zeile Weg (kleiner, Gold, klare Pfeile):
- Rotes Feld: Europa
  Weg: 1↑ 2← 1↓ 1← 2↑
- Grünes Feld: Deutschland
  Weg: 1→ 1↑ 2← 1↓ 1← 1↑ 2↑
- Gelbes Feld: Afrika
  Weg: 1→ 1↑ 2← 1↓ 3→ 1↑
- Blaues Feld: Nordamerika
  Weg: 1→ 1↑ 2← 1↓ 1← 1↑ 2←

Ganz unten, klein, kursiv, Gold, zentriert:
Am Ziel? Hebt das Plättchen hoch, auf dem eure Figur steht!

Alle Pfeile und Zahlen exakt wie angegeben. Aquarellstil, Creme/Gold/Salbeigrün, druckfertig, kein weiterer Text.
```

### Frage 3 · schwer · Vorlage: Bild 1

Der richtige Weg ist hier lang (9 Schritte). Falls die Pille zu voll wird: im Prompt „Weg-Zeile in kleinerer Schrift“ betonen oder Variante 5X nutzen.

```
Verwende das hochgeladene Bild als exakte Vorlage für eine Quiz-Spielkarte im Hochformat 2:3. Behalte alles unverändert: cremefarbenes Papier, goldener Rahmen, goldenes Herz oben, Efeu mit weißen Blüten, oben das Chibi-Brautpaar über der efeubewachsenen Labyrinthmauer, die vier ovalen Antwortfelder mit Farbpunkten Rot, Grün, Gelb, Blau links und goldenen Kompassrosen rechts. Keine neuen Figuren, Gesichter nicht verändern.

Schreibe exakt folgende deutsche Texte, ohne zusätzliche Wörter und ohne Tippfehler:

In die leere Fläche über den Antwortfeldern, zentriert:
- klein in goldenen Kapitälchen: FRAGE 3 VON 5
- darunter sehr klein, kursiv, Gold: Start: dort, wo eure Figur jetzt steht
- darunter die Frage groß in eleganter dunkelbrauner Serifenschrift, maximal zwei Zeilen:
  Wie groß ist die eigene Quilt-Fläche bei „Patchwork“?

In die vier Antwortfelder, zweizeilig zwischen Farbpunkt und Kompassrose. Erste Zeile Antwort (dunkelbraun, halbfett), zweite Zeile Weg in kleiner, schmaler Schrift in Gold, damit auch lange Wege in eine Zeile passen:
- Rotes Feld: 9 × 9 Felder
  Weg: 1← 2↓ 1→ 1↑ 1→ 3↓ 1← 1↑ 1←
- Grünes Feld: 8 × 8 Felder
  Weg: 1← 2↓ 2← 1↓ 1←
- Gelbes Feld: 10 × 10 Felder
  Weg: 1← 2↓ 1→ 1↑ 1→ 3↓ 1← 1↑ 2←
- Blaues Feld: 12 × 12 Felder
  Weg: 1→ 2↓ 1← 1↑ 1← 3↓ 2←

Ganz unten, klein, kursiv, Gold, zentriert:
Am Ziel? Hebt das Plättchen hoch, auf dem eure Figur steht!

Alle Pfeile und Zahlen exakt wie angegeben. Aquarellstil, Creme/Gold/Salbeigrün, druckfertig, kein weiterer Text.
```

### Frage 4 · sehr schwer · Vorlage: Bild 1

```
Verwende das hochgeladene Bild als exakte Vorlage für eine Quiz-Spielkarte im Hochformat 2:3. Behalte alles unverändert: cremefarbenes Papier, goldener Rahmen, goldenes Herz oben, Efeu mit weißen Blüten, oben das Chibi-Brautpaar über der efeubewachsenen Labyrinthmauer, die vier ovalen Antwortfelder mit Farbpunkten Rot, Grün, Gelb, Blau links und goldenen Kompassrosen rechts. Keine neuen Figuren, Gesichter nicht verändern.

Schreibe exakt folgende deutsche Texte, ohne zusätzliche Wörter und ohne Tippfehler:

In die leere Fläche über den Antwortfeldern, zentriert:
- klein in goldenen Kapitälchen: FRAGE 4 VON 5
- darunter sehr klein, kursiv, Gold: Start: dort, wo eure Figur jetzt steht
- darunter die Frage groß in eleganter dunkelbrauner Serifenschrift, maximal drei Zeilen:
  Welches Spiel gewann 1979 als allererstes den Preis „Spiel des Jahres“?

In die vier Antwortfelder, zweizeilig zwischen Farbpunkt und Kompassrose. Erste Zeile Antwort (dunkelbraun, halbfett), zweite Zeile Weg (kleiner, Gold, klare Pfeile):
- Rotes Feld: Rummikub
  Weg: 4↓ 3→
- Grünes Feld: Hase und Igel
  Weg: 3↓ 3→
- Gelbes Feld: Scotland Yard
  Weg: 3↑ 3→ 2↑
- Blaues Feld: Sagaland
  Weg: 2↓ 1→ 3↓ 1→

Ganz unten, klein, kursiv, Gold, zentriert:
Am Ziel? Hebt das Plättchen hoch, auf dem eure Figur steht!

Alle Pfeile und Zahlen exakt wie angegeben. Aquarellstil, Creme/Gold/Salbeigrün, druckfertig, kein weiterer Text.
```

### Frage 5 · Hauptschatz · Vorlage: Bild 2

```
Verwende das hochgeladene Bild als exakte Vorlage für die letzte, besondere Quiz-Spielkarte im Hochformat 2:3. Behalte alles unverändert: cremefarbenes Papier, goldener Rahmen mit goldenen Sternchen, goldenes Herz oben mittig, oben die leuchtende Szene mit dem facettierten goldenen Herz auf dem Podest zwischen efeubewachsenen Labyrinthmauern mit Lichtstrahlen und Funkeln, Efeu mit weißen Blüten an den Seiten und unten die vier ovalen Antwortfelder mit Farbpunkten Rot, Grün, Gelb, Blau links und goldenen Kompassrosen rechts. Nichts Neues hinzufügen.

Schreibe exakt folgende deutsche Texte, ohne zusätzliche Wörter und ohne Tippfehler:

In die leere Fläche über den Antwortfeldern, zentriert:
- klein in goldenen Kapitälchen mit Sperrung: FRAGE 5 VON 5 · HAUPTSCHATZ
- darunter sehr klein, kursiv, Gold: Start: dort, wo eure Figur jetzt steht
- darunter die Frage groß in eleganter dunkelbrauner Serifenschrift, maximal drei Zeilen:
  Welches kooperative Spiel für genau zwei Personen wurde 2024 „Spiel des Jahres“?

In die vier Antwortfelder, zweizeilig zwischen Farbpunkt und Kompassrose. Erste Zeile Antwort (dunkelbraun, halbfett), zweite Zeile Weg (kleiner, Gold, klare Pfeile):
- Rotes Feld: Die Crew
  Weg: 1← 1↑ 1→ 2↓
- Grünes Feld: Patchwork
  Weg: 1← 1↓ 1→ 1↓
- Gelbes Feld: 7 Wonders Duel
  Weg: 1→ 1↑ 1← 3↓
- Blaues Feld: Sky Team
  Weg: 1← 1↑ 1→ 2↑

Ganz unten, klein, kursiv, Gold, zentriert:
Am Ziel? Hebt das goldene Podest hoch – darunter liegt euer größter Schatz!

Alle Pfeile und Zahlen exakt wie angegeben. Leuchtender, festlicher Aquarellstil in Creme und Gold, druckfertig, kein weiterer Text.
```

### 5X · Alternative Weg-Darstellung (für alle Fragen nutzbar)

Falls ChatGPT die Pfeil-Zeilen verunstaltet: Statt `Weg: 1← 2↑` lieber jeden Schritt als **kleines goldenes Plättchen** darstellen lassen. Ersetze im jeweiligen Prompt den Absatz zu den Antwortfeldern durch:

```
In jedes Antwortfeld: links neben dem Farbpunkt die Antwort in dunkelbrauner Serifenschrift. Rechts daneben, vor der Kompassrose, eine Reihe kleiner runder goldener Plaketten, eine pro Schritt, jeweils mit einer Zahl und einem Pfeil darin. Die Plaketten exakt in dieser Reihenfolge:
- Rot: [Antwort] — Plaketten: [Schritte, z. B. 1← | 2↑ | 1→ | 2↑ | 2→]
- Grün: ...
- Gelb: ...
- Blau: ...
```

Die Werte für `[Antwort]` und die Schritte stehen in der Tabelle in Abschnitt 2.

---

## 6. Endkarte (Gratulation)

Texte wie im Abschluss-Bildschirm der App (`END` in `js/content.js`).

### 6A · Endkarte mit Bild-4-Motiv (empfohlen) — Vorlage: Bild 4 + Bild 3

```
Erstelle eine Spielkarte im Hochformat 2:3 im exakt gleichen Stil wie die hochgeladene leere Karte (cremefarbenes Papier, dünner goldener Rahmen mit abgerundeten Ecken, goldenes Herz oben mittig, Efeuranken mit kleinen weißen Blüten, goldene Ornamente in den unteren Ecken). Platziere im oberen Drittel das hochgeladene Motiv des Chibi-Brautpaars, das gemeinsam die alte efeubewachsene Steinplatte mit dem leuchtenden Labyrinthmuster anhebt, darunter ein goldener Briefumschlag mit Herzsiegel, der warm leuchtet und funkelt. Figuren, Gesichter, Kleidung und Frisuren exakt wie in der Vorlage. Rundherum feines goldenes Konfetti und kleine Herzen.

Schreibe darunter zentriert exakt diese deutschen Texte, ohne zusätzliche Wörter und ohne Tippfehler:

(klein, goldene Kapitälchen mit Sperrung) GESCHAFFT!
(groß, elegante dunkelbraune Serifenschrift) Alle Schätze gefunden
(kleiner, kursiv, Gold) Fünf Erlebnisse für euch zwei
(Liste, jede Zeile mit einem kleinen passenden Aquarell-Icon links: Glühweintasse, Popcorn, Kerze, roter Spielstein, alter Koffer)
Weihnachtsmarkt
Kinoabend
Dinner for 2
Spieleabend mit Freunden
Flitterwochen
(feiner goldener Trenner mit Herz)
(Serifenschrift) Alles Liebe zur Hochzeit,
(große elegante Schreibschrift wie Pinyon Script) Mark & Fiona
(klein, kursiv) Möge euer gemeinsamer Weg immer zum Schatz in der Mitte führen.

Stil: weiches Aquarell, Creme, Gold, Salbeigrün, festlich und warm, edle Hochzeitspapeterie, druckfertig, keine Wasserzeichen.
```

### 6B · Endkarte als Jubel-Szene (wie der Abschluss-Bildschirm der App) — Vorlage: Bild 3

```
Erstelle eine Spielkarte im Hochformat 2:3 im exakt gleichen Stil wie die hochgeladene Karte (Creme, Goldrahmen, goldenes Herz oben, Efeu mit weißen Blüten). Oben: dasselbe Chibi-Brautpaar wie in der Vorlage, das sich lachend in die Arme fällt, die Augen vor Freude geschlossen, die Braut im weißen Spitzenkleid mit Schleier und Blumenkranz, der Bräutigam im dunkelblauen Anzug. Um die beiden schweben die fünf Schätze als kleine Aquarell-Icons: rote Glühweintasse mit Schneeflocke, rot-weiß gestreifte Popcorntüte, Kerze im Glas mit Tannenzweig, roter Spielstein, alter brauner Koffer. Dazu goldene Bänder, kleine rote Herzen und goldenes Bokeh.

Darunter zentriert exakt dieser deutsche Text, ohne zusätzliche Wörter:
(klein, goldene Kapitälchen) GESCHAFFT!
(groß, dunkelbraune Serifenschrift) Alle Schätze gefunden
(normale Schrift) Fünf Rätsel gelöst, fünf Schätze gehoben. Ihr seid ein unschlagbares Team!
(feiner goldener Trenner mit Herz)
(Serifenschrift) Alles Liebe zur Hochzeit,
(große Schreibschrift) Mark & Fiona
(klein, kursiv, Gold) Möge euer gemeinsamer Weg immer zum Schatz in der Mitte führen.

Aquarellstil, warm, golden, festlich, druckfertig, kein weiterer Text.
```

### 6C · Endkarte golden — Vorlage: Bild 2

```
Verwende das hochgeladene Bild als Vorlage (Hochformat 2:3): goldener Rahmen mit Sternchen, goldenes Herz oben, Efeu mit Blüten, oben die leuchtende Labyrinth-Szene mit dem goldenen Herz auf dem Podest. Entferne die vier Antwortfelder vollständig und ersetze sie durch cremefarbene, leere Fläche. Ergänze vor dem Podest das Chibi-Brautpaar (Bräutigam mit braunen Locken im dunkelblauen Anzug, Braut mit hochgesteckten Haaren, Blumenkranz und Schleier), das Hand in Hand jubelt. Mehr goldenes Funkeln und Konfetti.

Schreibe zentriert in die freie Fläche exakt diesen deutschen Text:
(klein, goldene Kapitälchen) GESCHAFFT!
(groß, dunkelbraune Serifenschrift) Ihr habt den Hauptschatz gefunden!
(normale Schrift) Fünf Erlebnisse für euch zwei: Weihnachtsmarkt, Kinoabend, Dinner for 2, Spieleabend mit Freunden und eure Flitterwochen.
(feiner goldener Trenner mit Herz)
(Serifenschrift) Alles Liebe zur Hochzeit,
(große Schreibschrift) Mark & Fiona
(klein, kursiv, Gold) Möge euer gemeinsamer Weg immer zum Schatz in der Mitte führen.

Leuchtender Aquarellstil in Creme und Gold, druckfertig, kein weiterer Text.
```

---

## 7. Extras (zum Aussuchen)

### 7A · Kartenrückseite (für alle Karten gleich)

```
Erstelle die Rückseite einer Spielkarte im Hochformat 2:3 im Stil der hochgeladenen Karte: cremefarbenes Aquarellpapier, dünner goldener Doppelrahmen mit abgerundeten Ecken, Efeuranken mit kleinen weißen Blüten in allen vier Ecken. In der Mitte ein rundes goldenes Medaillon mit einem fein gezeichneten Labyrinth aus konzentrischen Ringen und einem kleinen goldenen Herz im Zentrum. Darunter in eleganter Schreibschrift: Mark & Fiona. Darunter klein in goldenen Kapitälchen: DAS HOCHZEITS-LABYRINTH. Symmetrisch, ruhig, edel, keine Figuren, kein weiterer Text.
```

### 7B · Schatzkarten zum Unterlegen (5 Stück, optional) — Vorlage: Bild 4

Wie die Vollbild-Karten der App. Diese Karten kannst du unter die Plättchen legen, damit beim Hochheben ein schöner Moment entsteht. Pro Karte einmal ausführen und `[…]` ersetzen.

```
Erstelle eine Spielkarte im Hochformat 2:3 im Stil der hochgeladenen Bilder: cremefarbenes Papier, goldener Rahmen, goldenes Herz oben, Efeu mit weißen Blüten. Oben das Chibi-Brautpaar aus der Vorlage, das gemeinsam eine leuchtende Steinplatte anhebt, darunter funkelt ein goldener Briefumschlag mit Herzsiegel. Daneben ein großes Aquarell-Icon: [ICON].

Darunter zentriert exakt dieser deutsche Text:
(klein, goldene Kapitälchen) [KICKER]
(groß, dunkelbraune Serifenschrift) [TITEL]
(normale Schrift) [TEXT]

Aquarellstil, Creme/Gold/Salbeigrün, druckfertig, kein weiterer Text.
```

| Karte | [KICKER] | [TITEL] | [TEXT] | [ICON] |
|---|---|---|---|---|
| 1 | 1. SCHATZ | Glühwein-Date | Hier habt ihr was für einen gemütlichen Abend auf dem Weihnachtsmarkt – Glühwein inklusive! | rote Glühweintasse mit Zimtstange und Schneeflocke |
| 2 | 2. SCHATZ | Kinoabend zu zweit | Hier habt ihr was für einen romantischen Kinoabend – Popcorn teilen ist Pflicht! | rot-weiß gestreifte Popcorntüte |
| 3 | 3. SCHATZ | Dinner for Two | Hier habt ihr was für ein Candle-Light-Dinner – nur ihr zwei, ganz in Ruhe. | Kerze im Glas mit Tannenzweig |
| 4 | 4. SCHATZ | Spieleabend | Hier habt ihr was für einen Spieleabend mit euren Liebsten – möge der Bessere gewinnen! | roter Spielstein mit Würfeln |
| 5 | HAUPTSCHATZ | Flitterwochen | Der größte Schatz zum Schluss: etwas für eure Flitterwochen! | alter brauner Reisekoffer mit Herz-Anhänger |

### 7C · Wegweiser-Karte (Legende, liegt neben dem Brett) — Vorlage: Bild 3

```
Nutze das hochgeladene Bild exakt als Vorlage (Hochformat 2:3), alles Bestehende unverändert. Zeichne in die leere Fläche eine einfache, sehr klare Aquarell-Skizze eines quadratischen Spielbretts mit 7 × 7 Feldern in Blaugrau. Markiere darauf vier Farbpunkte: Rot in der 3. Reihe, 3. Spalte; Grün in der 3. Reihe, 5. Spalte; Gelb in der 5. Reihe, 3. Spalte; Blau in der 5. Reihe, 5. Spalte. In der Mitte ein kleines goldenes Podest. Unten rechts in der Ecke eine kleine Spielfigur mit dem Wort START. Um das Brett vier große goldene Pfeile mit Beschriftung: oben „↑ oben“, unten „↓ unten“, links „← links“, rechts „→ rechts“.

Darunter exakt dieser deutsche Text:
(goldene Kapitälchen) SO LEST IHR DEN WEG
2↑ = 2 Felder nach oben
3→ = 3 Felder nach rechts
Lauft nur durch die hellen Gänge, nie durch Mauern.

Aquarellstil, Creme/Gold/Salbeigrün, sehr gut lesbar, kein weiterer Text.
```

### 7D · Blanko-Karten (für Text in Canva/Word)

**Fragekarte leer** — Vorlage: Bild 1 oder Bild 2
```
Gib das hochgeladene Bild exakt so wieder, im Hochformat 2:3, in hoher Auflösung und druckfertig: alle Elemente, Farben, Figuren, Rahmen, Farbpunkte und Kompassrosen unverändert. Die cremefarbenen Flächen und das Innere der vier Antwortfelder bleiben komplett leer, ohne jeden Text, ohne Muster. Keine Wasserzeichen.
```

**Anleitung/Endkarte leer** — Vorlage: Bild 3
```
Gib das hochgeladene Bild exakt so wieder, im Hochformat 2:3, in hoher Auflösung und druckfertig. Die große cremefarbene Fläche bleibt komplett leer. Ergänze nur ganz unten mittig ein leeres cremeweißes Quadrat mit dünnem goldenem Rahmen und abgerundeten Ecken (für einen QR-Code), innen leer. Kein Text, keine Wasserzeichen.
```

---

## 8. Korrektur-Prompt (wenn ein Text falsch ist)

Im selben ChatGPT-Chat direkt nach dem Bild:

```
Das Bild ist sehr schön, bitte ändere ausschließlich den Text im [roten/grünen/gelben/blauen] Antwortfeld. Dort muss exakt stehen:
Zeile 1: [Antwort]
Zeile 2: Weg: [Schritte]
Alles andere am Bild bleibt pixelgenau gleich.
```
