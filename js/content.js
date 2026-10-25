// Inhalte wörtlich aus Plan.md (§3 Stationen, §6 Intro, §7 Fragen). Positionen als [Reihe, Spalte].
export const LETTERS = ['A', 'B', 'C', 'D'];
// Antwort A..D = Farbpunkt Rot, Grün, Gelb, Blau (Positionen siehe Plan §2)
export const DOTS = [
  { color: 'red', label: 'Rot', pos: [3, 3], hex: '#e5383b' },
  { color: 'green', label: 'Grün', pos: [3, 5], hex: '#2e9d4f' },
  { color: 'yellow', label: 'Gelb', pos: [5, 3], hex: '#f5c518' },
  { color: 'blue', label: 'Blau', pos: [5, 5], hex: '#1e6fe0' },
];

export const INTRO = 'Hey ihr zwei! Wir sind eure Mini-Ichs. Unsere Hochzeitsschätze sind im Labyrinth verschwunden. Helft ihr uns?';

// Orte (Name, Sprechblase beim Ankommen: Plan §3, an den neuen Ablauf angepasst – erst Frage, dann Feld). Keine Geldbeträge (User-Vorgabe).
// Felder in Laufrichtung der Route zugeordnet
// (Entscheidung Stationsreihenfolge, docs/ARCHITEKTUR.md): (2,6) → (1,2) → (4,1) → (7,4) → Ziel (4,4).
const PLACES = [
  { pos: [2, 6], name: 'Weihnachtsmarkt', theme: 'weihnachtsmarkt', feld: '2. Reihe, 2. Feld von rechts', bubble: 'Erster Halt! Riecht ihr den Glühwein?' },
  { pos: [1, 2], name: 'Kinoabend', theme: 'kino', feld: 'oben, 2. Feld von links', bubble: 'Popcorn-Alarm! Hier ist etwas für euch versteckt.' },
  { pos: [4, 1], name: 'Dinner for 2', theme: 'dinner', feld: 'links Mitte', bubble: 'Kerzenlicht und Tisch für zwei. Fast geschafft!' },
  { pos: [7, 4], name: 'Spieleabend mit Freunden', theme: 'spieleabend', feld: 'unten Mitte', bubble: 'Der Endgegner ist besiegt! Das habt ihr euch verdient.' },
];

// Ersatz-Pool im Format von questions.js (POOL), falls questions.js fehlt: je Stufe 1..5 eine Frage (Plan §7 + Stufe 5).
// Altes Format { question: { text, options, correct }, backup } wird unten umgewandelt.
const QUIZ = [
  {
    question: { text: 'Welche dieser Karten ist KEINE Entwicklungskarte im Catan-Grundspiel?', options: ['Monopol', 'Straßenbau', 'Räuber', 'Erfindung'], correct: 2 },
    backup: { text: 'Wie viele Siegpunkte braucht man im Catan-Grundspiel zum Sieg?', options: ['8', '10', '12', '15'], correct: 1 },
  },
  {
    question: { text: 'Welches dieser Spiele wurde als erstes zum „Spiel des Jahres“ gekürt?', options: ['Carcassonne', 'Zug um Zug', 'Die Siedler von Catan', 'Dominion'], correct: 2 },
    backup: { text: 'Welches dieser Spiele hat den Preis „Spiel des Jahres“ gewonnen?', options: ['Monopoly', 'Carcassonne', 'Risiko', 'Schach'], correct: 1 },
  },
  {
    question: {
      text: 'Welche drei globalen Parameter müssen im Grundspiel von Terraforming Mars ihr Maximum erreichen, damit die Partie endet?',
      options: ['Temperatur, Sauerstoff, Ozeane', 'Temperatur, Wasser, Pflanzen', 'Sauerstoff, Ozeane, Städte', 'Temperatur, Atmosphäre, Wälder'], correct: 0,
    },
    backup: { text: 'Was ist KEIN globaler Parameter im Terraforming-Mars-Grundspiel?', options: ['Temperatur', 'Sauerstoff', 'Ozeane', 'Pflanzen'], correct: 3 },
  },
  {
    question: { text: 'Welches dieser Spiele stammt NICHT von Uwe Rosenberg?', options: ['Agricola', 'Patchwork', 'Caverna', 'Puerto Rico'], correct: 3 },
    backup: { text: 'Welches dieser Spiele stammt von Uwe Rosenberg?', options: ['Agricola', 'Catan', 'Carcassonne', 'Azul'], correct: 0 },
  },
  {
    question: { text: 'In welchem Jahr erschien „Die Siedler von Catan“ zum ersten Mal?', options: ['1993', '1995', '1997', '1999'], correct: 1 },
    backup: { text: 'Wer hat „Die Siedler von Catan“ erfunden?', options: ['Klaus Teuber', 'Uwe Rosenberg', 'Reiner Knizia', 'Wolfgang Kramer'], correct: 0 },
  },
];
export const MINI_POOL = QUIZ.map(({ question: q, backup: b }, i) => ({
  id: 'mini-' + (i + 1), level: i + 1, q: q.text, a: q.options, correct: q.correct, backup: { q: b.text, a: b.options, correct: b.correct },
}));
/** Anzahl Quizfragen pro Spiel: Stationen 1–4 und Frage 5 für den Hauptschatz. */
export const QUESTION_COUNT = 5;

export const STATIONS = PLACES;

export const FINALE = {
  pos: [4, 4], name: 'Flitterwochen', theme: 'flitterwochen', feld: 'Mitte',
  bubble: 'Alle fünf Fragen geschafft! In der Mitte wartet der letzte Schatz.',
};


// Paar-Pose je Situation (Sprechblasen und Quiz). Die Bilder je Pose stehen als --img-pose-<name> oben in style.css.
export const POSES = { intro: 'hallo', ready: 'denken', question: 'denken', right: 'jubel', wrong: 'trost', pity: 'trost', arrive: 'zeigen', finale: 'zeigen' };

// Neuer Ablauf (docs/ARCHITEKTUR.md, 2026-10-21): bereit? → Frage → Paar läuft zum Feld → Karte schwebt → Vollbild-Karte.
export const READY = {
  first: 'Seid ihr bereit für die erste Frage?',
  next: 'Seid ihr bereit für die nächste Frage?',
  last: 'Seid ihr bereit für die letzte Frage?',
  go: 'Los',
  yes: 'Ja!',
  tap: 'Tippt auf den Schatz!',
  flip: 'Tippt auf die Karte, um sie umzudrehen',
};

// Vollbild-Karten (Texte exakt aus docs/BILD-PROMPTS.md „So sieht die Karte am Bildschirm aus“), Reihenfolge = STATIONS, dann FINALE.
// Bilder: assets/cards/<theme>.png und assets/cards/rueckseite.png werden automatisch verwendet, sobald sie existieren.
export const LIFT = 'Hebt das Plättchen hoch, auf dem wir stehen – darunter liegt euer Schatz!';
export const LIFT_FINALE = 'Hebt das goldene Podest hoch – darunter liegt euer größter Schatz!';
export const CARDS = [
  { kicker: '1. SCHATZ', title: 'Glühwein-Date', text: 'Hier habt ihr was für einen gemütlichen Abend auf dem Weihnachtsmarkt – Glühwein inklusive!', lift: LIFT },
  { kicker: '2. SCHATZ', title: 'Kinoabend zu zweit', text: 'Hier habt ihr was für einen romantischen Kinoabend – Popcorn teilen ist Pflicht!', lift: LIFT },
  { kicker: '3. SCHATZ', title: 'Dinner for Two', text: 'Hier habt ihr was für ein Candle-Light-Dinner – nur ihr zwei, ganz in Ruhe.', lift: LIFT },
  { kicker: '4. SCHATZ', title: 'Spieleabend', text: 'Hier habt ihr was für einen Spieleabend mit euren Liebsten – möge der Bessere gewinnen!', lift: LIFT },
  { kicker: 'HAUPTSCHATZ', title: 'Flitterwochen', text: 'Der größte Schatz zum Schluss: etwas für eure Flitterwochen!', lift: LIFT_FINALE },
];
export const CARD_UI = { next: 'Weiter' };

// Anleitungs-Screen nach der Modus-Wahl (main.js). `ar: true` = nur mit Kamera zeigen.
export const GUIDE = {
  kicker: 'Bevor es losgeht',
  title: 'Liebe Fiona, lieber Mark,',
  intro: 'schön, dass ihr euch einen Moment für dieses kleine Abenteuer nehmt. Eure Mini-Ichs haben sich ins Labyrinth gewagt, denn dort sind eure Hochzeitsschätze versteckt. Mit eurer Hilfe finden sie alle. Wir wünschen euch von Herzen alles Gute und viel Glück zur Hochzeit!',
  stepsTitle: 'So funktioniert’s',
  steps: [
    'Zuerst kommt eine Quizfrage. Fünf sind es insgesamt.',
    'Richtig beantwortet? Dann läuft das kleine Brautpaar zu einem geheimen Feld.',
    'Dort wartet eine Schatztruhe. Tippt auf den Schatz, dann verrät er euch, was ihr gewonnen habt und wo er versteckt liegt.',
  ],
  tipsTitle: 'Gut zu wissen',
  tips: [
    { text: 'Legt das Brett auf einen Tisch, schön hell, aber so, dass es nicht zu stark spiegelt.' },
    { text: 'Haltet zu Beginn das ganze Spielbrett ins Kamerabild und wartet kurz, bis eure Spielfiguren erscheinen – danach könnt ihr auch näher ran.', ar: true },
    { text: 'Haltet das Handy ruhig und eher schräg von oben über das Brett.', ar: true },
    { text: 'Ihr könnt auch mit einem iPad spielen – dort seht ihr Brett und Fragen größer.' },
    { text: 'Antworten könnt ihr per Button geben oder indem ihr den passenden Farbpunkt auf dem Brett im Bild antippt.', ar: true },
    { text: 'Ein 50:50-Joker hilft euch einmal pro Spiel.' },
  ],
  warn: 'Hebt erst ein Plättchen an, wenn die App es euch sagt.',
  go: 'Los geht’s mit dem Abenteuer',
  cancel: 'Lieber ohne Kamera spielen',
  status: {
    loading: 'Kamera wird vorbereitet …',
    permission: 'Bitte Kamera erlauben',
    starting: 'Kamera startet …',
    ready: 'Kamera bereit',
    plain: 'Ihr spielt mit dem Bild vom Brett.',
    cancelled: 'Alles klar, ihr spielt ohne Kamera.',
    percent: 'Spielbrett-Erkennung lädt … {p} %',
  },
};

// Ladescreen beim Wiedereinstieg mit Kamera (Spielstand vorhanden, „Kamera nochmal versuchen“): statt der Anleitung, gleicher Fortschritt.
export const RESUME = {
  kicker: 'Station {n} von 5',
  title: 'Gleich geht’s weiter!',
  intro: 'Eure Mini-Ichs warten schon auf euch. Die Kamera startet im Hintergrund.',
  tipsTitle: 'Kleiner Tipp',
  tips: [
    'Haltet das Handy ruhig und schräg von oben aufs Brett.',
    'Nah ran geht jetzt auch – zu nah? Einfach etwas zurück.',
    'Tippt das schwebende Icon über der Truhe an.',
  ],
  go: 'Weiter spielen',
  cancel: 'Lieber ohne Kamera',
};

export const END = {
  kicker: 'Geschafft!',
  title: 'Alle Schätze gefunden',
  list: 'Fünf Erlebnisse für euch zwei',
  again: 'Nochmals spielen',
  wish: 'Alles Liebe zur Hochzeit',
  note: 'Möge euer gemeinsamer Weg immer zum Schatz in der Mitte führen.',
};

// „Zurück zum Start“ (Tipp auf den Titel im HUD)
export const HOME = { ask: 'Zurück zum Start? Euer Spielstand bleibt gespeichert.', yes: 'Ja', no: 'Nein' };
