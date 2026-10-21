// Fragen-Pool (docs/ARCHITEKTUR.md, User-Feedback Runde 3, Punkt 2).
// 5 Stufen à 8 Fragen, jede mit leichterer Backup-Frage zum selben Thema.
// Stufe 1–4 enthalten die bisherigen Fragen aus Plan §7. Stufe 5 öffnet den Hauptschatz.
// Alle Fakten per Web geprüft, Beleg steht in `src`. Lesbare Übersicht: docs/FRAGEN.md.

export const POOL = [
  // ── Stufe 1: leicht, Klassiker ──────────────────────────────────────────
  {
    id: 'catan-entwicklungskarte', level: 1,
    q: 'Welche dieser Karten ist KEINE Entwicklungskarte im Catan-Grundspiel?',
    a: ['Monopol', 'Straßenbau', 'Räuber', 'Erfindung'], correct: 2,
    backup: { q: 'Wie viele Siegpunkte braucht man im Catan-Grundspiel zum Sieg?', a: ['8', '10', '12', '15'], correct: 1 },
    src: 'Plan §7; Kosmos-Spielregel (Fortschrittskarten Monopol/Straßenbau/Erfindung), de.wikipedia „Die Siedler von Catan“ (Räuber = Figur, 10 Siegpunkte)',
  },
  {
    id: 'uno-startkarten', level: 1,
    q: 'Wie viele Karten bekommt bei Uno jeder Spieler zu Beginn?',
    a: ['4', '5', '6', '7'], correct: 3,
    backup: { q: 'Was muss man bei Uno rufen, wenn man nur noch eine Karte hat?', a: ['Uno!', 'Stopp!', 'Mau!', 'Letzte!'], correct: 0 },
    src: 'de.wikipedia „Uno (Kartenspiel)“: sieben Karten pro Spieler, „Uno!“ rufen',
  },
  {
    id: 'monopoly-hotel', level: 1,
    q: 'Wie viele Häuser braucht man bei Monopoly auf einer Straße, bevor man ein Hotel bauen darf?',
    a: ['3', '4', '5', '6'], correct: 1,
    backup: { q: 'Was baut man bei Monopoly auf seine Straßen?', a: ['Burgen und Türme', 'Brücken und Tunnel', 'Gärten und Teiche', 'Häuser und Hotels'], correct: 3 },
    src: 'Hasbro-Spielregel Monopoly (DE und CH): max. 4 Häuser, dann Umtausch gegen Hotel',
  },
  {
    id: 'maedn-sechs', level: 1,
    q: 'Welche Zahl muss man bei „Mensch ärgere Dich nicht“ würfeln, um eine Figur ins Spiel zu bringen?',
    a: ['1', '4', '5', '6'], correct: 3,
    backup: { q: 'Wie viele Spielfiguren hat jede Farbe bei „Mensch ärgere Dich nicht“?', a: ['2', '3', '4', '5'], correct: 2 },
    src: 'de.wikipedia „Mensch ärgere Dich nicht“: vier Figuren, mit einer Sechs aufs Startfeld',
  },
  {
    id: 'schach-felder', level: 1,
    q: 'Wie viele Felder hat ein Schachbrett?',
    a: ['36', '49', '64', '81'], correct: 2,
    backup: { q: 'Welche Figur muss man im Schach mattsetzen, um zu gewinnen?', a: ['Dame', 'König', 'Turm', 'Läufer'], correct: 1 },
    src: 'Schachregeln (FIDE): 8 × 8 = 64 Felder, Ziel ist das Matt des Königs',
  },
  {
    id: 'scotland-yard-gauner', level: 1,
    q: 'Wie heißt der gesuchte Gauner in „Scotland Yard“?',
    a: ['Mister X', 'Mister Y', 'Doktor No', 'Phantom'], correct: 0,
    backup: { q: 'In welcher Stadt jagt man in „Scotland Yard“ den Gauner?', a: ['Paris', 'Berlin', 'London', 'New York'], correct: 2 },
    src: 'de.wikipedia „Scotland Yard (Spiel)“: Mister X, Spielplan London, Ravensburger, Spiel des Jahres 1983',
  },
  {
    id: 'muehle-steine', level: 1,
    q: 'Wie viele Steine hat jeder Spieler beim Mühle-Spiel?',
    a: ['8', '9', '10', '12'], correct: 1,
    backup: { q: 'Wie viele Steine in einer Reihe ergeben eine Mühle?', a: ['3', '4', '5', '6'], correct: 0 },
    src: 'de.wikipedia „Mühle (Spiel)“: je neun Steine, drei in einer Linie = Mühle',
  },
  {
    id: 'kniffel-wuerfel', level: 1,
    q: 'Mit wie vielen Würfeln spielt man Kniffel?',
    a: ['5', '6', '7', '8'], correct: 0,
    backup: { q: 'Wie heißt bei Kniffel der Wurf mit fünf gleichen Würfeln?', a: ['Pasch', 'Full House', 'Große Straße', 'Kniffel'], correct: 3 },
    src: 'de.wikipedia „Kniffel“: fünf Würfel, fünf gleiche = Kniffel',
  },

  // ── Stufe 2: mittel, Spiel des Jahres & moderne Klassiker ──────────────
  {
    id: 'sdj-erstes-von-vier', level: 2,
    q: 'Welches dieser Spiele wurde als erstes zum „Spiel des Jahres“ gekürt?',
    a: ['Carcassonne', 'Zug um Zug', 'Die Siedler von Catan', 'Dominion'], correct: 2,
    backup: { q: 'Welches dieser Spiele hat den Preis „Spiel des Jahres“ gewonnen?', a: ['Monopoly', 'Carcassonne', 'Risiko', 'Schach'], correct: 1 },
    src: 'Plan §7; de.wikipedia „Spiel des Jahres“: Catan 1995, Carcassonne 2001, Zug um Zug 2004, Dominion 2009',
  },
  {
    id: 'azul-azulejos', level: 2,
    q: 'Welche portugiesischen Wandfliesen sind das Vorbild für „Azul“?',
    a: ['Azulejos', 'Terrakotta', 'Mosaicos', 'Majolika'], correct: 0,
    backup: { q: 'Was legen die Spieler bei „Azul“ auf ihr Tableau?', a: ['Karten', 'Fliesen', 'Würfel', 'Münzen'], correct: 1 },
    src: 'de.wikipedia „Azul (Spiel)“: Azulejos für den Palast von König Manuel I. in Évora; Spiel des Jahres 2018',
  },
  {
    id: 'carcassonne-land', level: 2,
    q: 'In welchem Land liegt die Stadt, nach der „Carcassonne“ benannt ist?',
    a: ['Spanien', 'Italien', 'Portugal', 'Frankreich'], correct: 3,
    backup: { q: 'Was legt man bei „Carcassonne“ Zug für Zug aus?', a: ['Landschaftskarten', 'Spielkarten', 'Holzwürfel', 'Sechseckfelder'], correct: 0 },
    src: 'Hans-im-Glück-Spielregel: 72 Landschaftskarten; Carcassonne = Stadt in Südfrankreich (Okzitanien)',
  },
  {
    id: 'zug-um-zug-karte', level: 2,
    q: 'Welches Gebiet zeigt der Spielplan im Grundspiel von „Zug um Zug“?',
    a: ['Europa', 'Nordamerika', 'Deutschland', 'Afrika'], correct: 1,
    backup: { q: 'Was bauen die Spieler bei „Zug um Zug“?', a: ['Burgen', 'Kanäle', 'Eisenbahnstrecken', 'Flughäfen'], correct: 2 },
    src: 'en.wikipedia „Ticket to Ride“: Karte der USA und Südkanadas (1910), Strecken mit Waggons belegen',
  },
  {
    id: 'codenames-karten', level: 2,
    q: 'Wie viele Wortkarten liegen bei „Codenames“ im Raster aus?',
    a: ['16', '20', '24', '25'], correct: 3,
    backup: { q: 'Wie viele Teams treten bei „Codenames“ gegeneinander an?', a: ['2', '3', '4', '5'], correct: 0 },
    src: 'de.wikipedia „Codenames“: 25 Wortkarten im 5×5-Raster, zwei Teams (Rot/Blau); Spiel des Jahres 2016',
  },
  {
    id: 'dixit-2010', level: 2,
    q: 'Welches Spiel mit traumhaften Bildkarten wurde 2010 „Spiel des Jahres“?',
    a: ['Dixit', 'Dominion', 'Qwirkle', 'Keltis'], correct: 0,
    backup: { q: 'Was zeigen die Karten bei „Dixit“?', a: ['Zahlen', 'Wörter', 'Bilder', 'Farben'], correct: 2 },
    src: 'de.wikipedia „Spiel des Jahres“: Keltis 2008, Dominion 2009, Dixit 2010, Qwirkle 2011',
  },
  {
    id: 'kingdomino-raster', level: 2,
    q: 'Wie groß darf ein Königreich bei „Kingdomino“ nach der Standardregel höchstens werden?',
    a: ['4 × 4 Felder', '5 × 5 Felder', '6 × 6 Felder', '8 × 8 Felder'], correct: 1,
    backup: { q: 'Woran erinnern die Plättchen bei „Kingdomino“?', a: ['Puzzleteile', 'Spielkarten', 'Bauklötze', 'Dominosteine'], correct: 3 },
    src: 'de.wikipedia „Kingdomino“: Fläche von 5 × 5 Feldern, Weiterentwicklung des Domino; Spiel des Jahres 2017',
  },
  {
    id: 'cascadia-tiere', level: 2,
    q: 'Welches Tier kommt im Grundspiel von „Cascadia“ NICHT vor?',
    a: ['Lachs', 'Bussard', 'Wolf', 'Fuchs'], correct: 2,
    backup: { q: 'Welches Tier kommt in „Cascadia“ vor?', a: ['Löwe', 'Pinguin', 'Känguru', 'Bär'], correct: 3 },
    src: 'Kosmos-Produkttext Cascadia: Bussarde, Bären, Hirsche, Füchse, Lachse; Spiel des Jahres 2022',
  },

  // ── Stufe 3: schwer, Mechaniken bekannter Kennerspiele ─────────────────
  {
    id: 'terraforming-parameter', level: 3,
    q: 'Welche drei globalen Parameter müssen im Grundspiel von „Terraforming Mars“ ihr Maximum erreichen, damit die Partie endet?',
    a: ['Temperatur, Sauerstoff, Ozeane', 'Temperatur, Wasser, Pflanzen', 'Sauerstoff, Ozeane, Städte', 'Temperatur, Atmosphäre, Wälder'], correct: 0,
    backup: { q: 'Was ist KEIN globaler Parameter im Grundspiel von „Terraforming Mars“?', a: ['Temperatur', 'Sauerstoff', 'Ozeane', 'Pflanzen'], correct: 3 },
    src: 'Plan §7; en.wikipedia „Terraforming Mars“: Ende bei 14 % Sauerstoff, +8 °C, 9 Ozeanplättchen',
  },
  {
    id: 'seven-wonders-richtung', level: 3,
    q: 'In welche Richtung gibt man bei „7 Wonders“ im Zeitalter II die Karten weiter?',
    a: ['Nach links', 'Nach rechts', 'Über Kreuz', 'Zum Startspieler'], correct: 1,
    backup: { q: 'Wie viele Zeitalter umfasst eine Partie „7 Wonders“?', a: ['2', '3', '4', '5'], correct: 1 },
    src: 'Offizielle Regel (officialgamerules.org, zatu.com): Zeitalter I links, II rechts, III links; en.wikipedia: drei Zeitalter',
  },
  {
    id: 'quacksalber-knallerbsen', level: 3,
    q: 'Bei den „Quacksalbern von Quedlinburg“: Ab welcher Summe der Knallerbsen explodiert der Kessel?',
    a: ['Mehr als 5', 'Mehr als 6', 'Mehr als 7', 'Mehr als 9'], correct: 2,
    backup: { q: 'Was brauen die Spieler bei den „Quacksalbern von Quedlinburg“?', a: ['Bier', 'Suppe', 'Parfüm', 'Tränke'], correct: 3 },
    src: 'Regelheft (rulespal.com): weiße Chips über 7 = Explosion; Kennerspiel des Jahres 2018',
  },
  {
    id: 'patchwork-flaeche', level: 3,
    q: 'Wie groß ist die eigene Quilt-Fläche bei „Patchwork“?',
    a: ['9 × 9 Felder', '8 × 8 Felder', '10 × 10 Felder', '12 × 12 Felder'], correct: 0,
    backup: { q: 'Womit bezahlt man bei „Patchwork“ die Stoffflicken?', a: ['Knöpfe', 'Münzen', 'Garnrollen', 'Perlen'], correct: 0 },
    src: 'en.wikipedia „Patchwork (board game)“: 9×9-Raster; de.wikipedia: Währung Knöpfe, Uwe Rosenberg 2014',
  },
  {
    id: 'dominion-startdeck', level: 3,
    q: 'Woraus besteht bei „Dominion“ das Startdeck jedes Spielers?',
    a: ['5 Kupfer, 5 Anwesen', '6 Kupfer, 4 Anwesen', '7 Kupfer, 3 Anwesen', '8 Kupfer, 2 Anwesen'], correct: 2,
    backup: { q: 'Für welchen Spielmechanismus wurde „Dominion“ berühmt?', a: ['Arbeiter einsetzen', 'Deckbau', 'Würfeln', 'Plättchen legen'], correct: 1 },
    src: 'de.wikipedia „Dominion (Spiel)“: 7 Kupfer + 3 Anwesen, Deckbau; Spiel des Jahres 2009',
  },
  {
    id: 'pandemie-ausbrueche', level: 3,
    q: 'Nach wie vielen Ausbrüchen ist eine Partie „Pandemie“ verloren?',
    a: ['5', '6', '7', '8'], correct: 3,
    backup: { q: 'Wie viele Seuchen bekämpft man im Grundspiel von „Pandemie“?', a: ['2', '3', '4', '5'], correct: 2 },
    src: 'de.wikipedia „Pandemie (Spiel)“: nach acht Ausbrüchen verloren, vier Seuchen',
  },
  {
    id: 'splendor-prestige', level: 3,
    q: 'Ab wie vielen Prestigepunkten wird bei „Splendor“ die letzte Runde ausgelöst?',
    a: ['10', '12', '14', '15'], correct: 3,
    backup: { q: 'Was sammelt man bei „Splendor“?', a: ['Edelsteine', 'Gewürze', 'Muscheln', 'Federn'], correct: 0 },
    src: 'en.wikipedia „Splendor (game)“: 15 Prestigepunkte, Edelstein-Marker',
  },
  {
    id: 'fluegelschlag-runden', level: 3,
    q: 'Wie viele Runden dauert eine Partie „Flügelschlag“?',
    a: ['3', '4', '5', '6'], correct: 1,
    backup: { q: 'Welche Tiere sammelt man bei „Flügelschlag“?', a: ['Fische', 'Insekten', 'Vögel', 'Säugetiere'], correct: 2 },
    src: 'en.wikipedia „Wingspan (board game)“: vier Runden, Vogelkarten',
  },

  // ── Stufe 4: sehr schwer, Autor:innen, Verlage, Jahreszahlen ───────────
  {
    id: 'rosenberg-nicht', level: 4,
    q: 'Welches dieser Spiele stammt NICHT von Uwe Rosenberg?',
    a: ['Agricola', 'Patchwork', 'Caverna', 'Puerto Rico'], correct: 3,
    backup: { q: 'Welches dieser Spiele stammt von Uwe Rosenberg?', a: ['Agricola', 'Catan', 'Carcassonne', 'Azul'], correct: 0 },
    src: 'Plan §7; de.wikipedia „Uwe Rosenberg“ (Agricola, Patchwork, Caverna), „Puerto Rico (Spiel)“: Andreas Seyfarth',
  },
  {
    id: 'erstes-kennerspiel', level: 4,
    q: 'Welches Spiel wurde 2011 das allererste „Kennerspiel des Jahres“?',
    a: ['Dominion', '7 Wonders', 'Agricola', 'Village'], correct: 1,
    backup: { q: 'Welches dieser Spiele wurde „Kennerspiel des Jahres“?', a: ['Uno', 'Monopoly', '7 Wonders', 'Kniffel'], correct: 2 },
    src: 'de.wikipedia „Kennerspiel des Jahres“: 2011 7 Wonders, 2012 Village',
  },
  {
    id: 'erstes-sdj-1979', level: 4,
    q: 'Welches Spiel gewann 1979 als allererstes den Preis „Spiel des Jahres“?',
    a: ['Rummikub', 'Scotland Yard', 'Sagaland', 'Hase und Igel'], correct: 3,
    backup: { q: 'In welchem Jahrzehnt wurde „Spiel des Jahres“ zum ersten Mal vergeben?', a: ['1960er', '1970er', '1980er', '1990er'], correct: 1 },
    src: 'de.wikipedia „Spiel des Jahres“: 1979 Hase und Igel, 1980 Rummikub, 1982 Sagaland, 1983 Scotland Yard',
  },
  {
    id: 'catan-verlag', level: 4,
    q: 'In welchem Verlag erschien „Die Siedler von Catan“ 1995?',
    a: ['Ravensburger', 'Kosmos', 'Hans im Glück', 'Amigo'], correct: 1,
    backup: { q: 'Wer hat „Die Siedler von Catan“ erfunden?', a: ['Reiner Knizia', 'Wolfgang Kramer', 'Klaus Teuber', 'Uwe Rosenberg'], correct: 2 },
    src: 'de.wikipedia „Die Siedler von Catan“: Kosmos 1995, Autor Klaus Teuber',
  },
  {
    id: 'carcassonne-autor', level: 4,
    q: 'Wer ist der Autor von „Carcassonne“?',
    a: ['Klaus-Jürgen Wrede', 'Andreas Seyfarth', 'Michael Kiesling', 'Wolfgang Kramer'], correct: 0,
    backup: { q: '„Carcassonne“ stammt von Klaus-Jürgen …?', a: ['Teuber', 'Kramer', 'Knizia', 'Wrede'], correct: 3 },
    src: 'de.wikipedia „Spiel des Jahres“ (2001 Carcassonne, Klaus-Jürgen Wrede); Hans-im-Glück-Regelheft',
  },
  {
    id: 'zug-um-zug-autor', level: 4,
    q: 'Wer hat „Zug um Zug“ erfunden?',
    a: ['Reiner Knizia', 'Antoine Bauza', 'Alan R. Moon', 'Bruno Cathala'], correct: 2,
    backup: { q: 'In welchem Jahrzehnt wurde „Zug um Zug“ Spiel des Jahres?', a: ['1970er', '1980er', '1990er', '2000er'], correct: 3 },
    src: 'de.wikipedia „Spiel des Jahres“: 2004 Zug um Zug, Alan R. Moon; Verlag Days of Wonder',
  },
  {
    id: 'fluegelschlag-autorin', level: 4,
    q: 'Wer hat „Flügelschlag“ (Wingspan) entworfen?',
    a: ['Elizabeth Hargrave', 'Jamey Stegmaier', 'Vlaada Chvátil', 'Phil Walker-Harding'], correct: 0,
    backup: { q: 'Welchen Preis gewann „Flügelschlag“ 2019?', a: ['Kennerspiel des Jahres', 'Kinderspiel des Jahres', 'Goldene Kamera', 'Bambi'], correct: 0 },
    src: 'en.wikipedia „Wingspan“: Design Elizabeth Hargrave, Verlag Stonemaier Games; Kennerspiel des Jahres 2019',
  },
  {
    id: 'terraforming-verlag', level: 4,
    q: 'Welcher Verlag brachte „Terraforming Mars“ 2016 heraus?',
    a: ['Stonemaier Games', 'Days of Wonder', 'FryxGames', 'Repos Production'], correct: 2,
    backup: { q: 'Auf welchem Planeten spielt „Terraforming Mars“?', a: ['Venus', 'Mars', 'Jupiter', 'Merkur'], correct: 1 },
    src: 'en.wikipedia „Terraforming Mars“: Jacob Fryxelius, FryxGames (Karlstad, Schweden), 2016',
  },

  // ── Stufe 5: Hauptschatz, knifflig, aber fair (mit Augenzwinkern) ───────
  {
    id: 'love-letter-herkunft', level: 5,
    q: 'Aus welchem Land stammt das Liebesbrief-Spiel „Love Letter“ ursprünglich?',
    a: ['Japan', 'USA', 'Frankreich', 'Deutschland'], correct: 0,
    backup: { q: 'Wem soll bei „Love Letter“ der Liebesbrief überbracht werden?', a: ['Dem König', 'Der Prinzessin', 'Der Gräfin', 'Dem Prinzen'], correct: 1 },
    src: 'en.wikipedia „Love Letter (card game)“: Seiji Kanai, 2012, Kanai Factory (Japan); Ziel: Brief an die Prinzessin',
  },
  {
    id: 'sky-team', level: 5,
    q: 'Welches kooperative Spiel für genau zwei Personen wurde 2024 „Spiel des Jahres“?',
    a: ['Die Crew', 'Patchwork', '7 Wonders Duel', 'Sky Team'], correct: 3,
    backup: { q: 'Was landen die beiden bei „Sky Team“ gemeinsam, wie auf der Hochzeitsreise?', a: ['Ein Raumschiff', 'Einen Ballon', 'Einen Hubschrauber', 'Ein Flugzeug'], correct: 3 },
    src: 'de.wikipedia „Spiel des Jahres“ (2024 Sky Team, Luc Rémond); en.wikipedia „Sky Team“: 2 Personen, kooperativ, Verkehrsflugzeug landen',
  },
  {
    id: 'spiel-des-lebens', level: 5,
    q: 'Im „Spiel des Lebens“ wird unterwegs geheiratet. Wer brachte 1860 die allererste Version heraus?',
    a: ['Parker Brothers', 'Milton Bradley', 'Ravensburger', 'Hasbro'], correct: 1,
    backup: { q: 'Womit fährt man im „Spiel des Lebens“ über das Brett?', a: ['Mit einem Auto', 'Mit einem Schiff', 'Mit einem Zug', 'Mit einem Pferd'], correct: 0 },
    src: 'en.wikipedia „The Game of Life“: The Checkered Game of Life, Milton Bradley 1860; heute Auto mit Stiften für Ehepartner und Kinder',
  },
  {
    id: 'monopoly-magie', level: 5,
    q: 'Monopoly geht auf „The Landlord’s Game“ zurück. Wer hat es erfunden?',
    a: ['Charles Darrow', 'Elizabeth Magie', 'George Parker', 'Milton Bradley'], correct: 1,
    backup: { q: 'Worum geht es bei Monopoly?', a: ['Eisenbahnbau', 'Schatzsuche', 'Grundstückshandel', 'Weltraumflug'], correct: 2 },
    src: 'de.wikipedia „Monopoly“: Elizabeth Magie, Patent 1904; Darrow verkaufte später an Parker Brothers',
  },
  {
    id: 'schach-dame-fers', level: 5,
    q: 'Welche heutige Schachfigur hieß im mittelalterlichen Schach noch „Fers“ und zog nur ein Feld schräg?',
    a: ['Läufer', 'Turm', 'Dame', 'Springer'], correct: 2,
    backup: { q: 'Welche ist die stärkste Figur im Schach?', a: ['König', 'Dame', 'Turm', 'Springer'], correct: 1 },
    src: 'en.wikipedia „Ferz“ (ein Feld diagonal, im 15. Jh. durch die Dame ersetzt); de.wikipedia „Dame (Schach)“: heutige Zugweise ab ca. 1490',
  },
  {
    id: 'meeple-wort', level: 5,
    q: 'Das Wort „Meeple“ entstand im Jahr 2000 beim Carcassonne-Spielen. Aus welchen Wörtern?',
    a: ['my + people', 'me + pebble', 'meet + people', 'mini + people'], correct: 0,
    backup: { q: 'Wie nennt man die kleinen Holzfiguren in Brettspielen oft?', a: ['Joker', 'Würfel', 'Karten', 'Meeple'], correct: 3 },
    src: 'en.wikipedia „Meeple“: Alison Hansel, Nov. 2000, „my people“ beim Carcassonne-Spielen',
  },
  {
    id: 'hanabi-bedeutung', level: 5,
    q: 'Was bedeutet der japanische Spieltitel „Hanabi“ (Spiel des Jahres 2013) auf Deutsch?',
    a: ['Kirschblüte', 'Blumenstrauß', 'Laterne', 'Feuerwerk'], correct: 3,
    backup: { q: 'Wie spielt man „Hanabi“?', a: ['Alle gegeneinander', 'In zwei Teams', 'Alle gemeinsam', 'Jeder allein'], correct: 2 },
    src: 'en.wikipedia „Hanabi (card game)“: 花火 = Feuerwerk, kooperativ, Antoine Bauza, Spiel des Jahres 2013',
  },
  {
    id: 'duel-autoren', level: 5,
    q: 'Welches Zwei-Personen-Spiel stammt von Antoine Bauza und Bruno Cathala?',
    a: ['Jaipur', 'Patchwork', '7 Wonders Duel', 'Lost Cities'], correct: 2,
    backup: { q: 'Für wie viele Personen ist „7 Wonders Duel“ gemacht, genau wie ihr?', a: ['2', '3', '4', '5'], correct: 0 },
    src: 'en.wikipedia „7 Wonders Duel“: Bauza & Cathala, 2015, 2 Personen; Jaipur = Pauchon, Lost Cities = Knizia, Patchwork = Rosenberg',
  },
];

// Selbsttest: node -e "import('./app/js/questions.js').then(m=>console.log(m.validatePool()))"
export function validatePool(pool = POOL) {
  const errors = [];
  const ids = new Set();
  const perLevel = {};
  const checkSet = (where, q, a, correct) => {
    if (!q || typeof q !== 'string') errors.push(`${where}: Frage fehlt`);
    if (!Array.isArray(a) || a.length !== 4) return errors.push(`${where}: braucht 4 Antworten`);
    if (new Set(a).size !== 4) errors.push(`${where}: Antworten nicht verschieden`);
    if (!Number.isInteger(correct) || correct < 0 || correct > 3) errors.push(`${where}: correct ungültig`);
    a.forEach((x) => { if (typeof x !== 'string' || !x || x.length > 40) errors.push(`${where}: Antwort leer/zu lang: ${x}`); });
    if ([q, ...a].some((s) => String(s).includes('€'))) errors.push(`${where}: enthält €`);
  };
  for (const p of pool) {
    if (ids.has(p.id)) errors.push(`doppelte id: ${p.id}`);
    ids.add(p.id);
    perLevel[p.level] = (perLevel[p.level] || 0) + 1;
    if (!p.src) errors.push(`${p.id}: src fehlt`);
    checkSet(p.id, p.q, p.a, p.correct);
    if (!p.backup) errors.push(`${p.id}: Backup fehlt`);
    else checkSet(`${p.id}/backup`, p.backup.q, p.backup.a, p.backup.correct);
  }
  for (let l = 1; l <= 5; l++) if (perLevel[l] !== 8) errors.push(`Level ${l}: ${perLevel[l] || 0} statt 8 Fragen`);
  return errors.length ? { ok: false, errors } : { ok: true, total: pool.length, perLevel };
}
