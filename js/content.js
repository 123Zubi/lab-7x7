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

// Orte (Name, Gewinn, Sprechblase: Plan §3). Felder in Laufrichtung der Route zugeordnet
// (Entscheidung Stationsreihenfolge, docs/ARCHITEKTUR.md): (2,6) → (1,2) → (4,1) → (7,4) → Ziel (4,4).
const PLACES = [
  { pos: [2, 6], name: 'Weihnachtsmarkt', prize: 50, icon: '🎄', feld: '2. Reihe, 2. Feld von rechts', bubble: 'Erster Halt! Riecht ihr den Glühwein?' },
  { pos: [1, 2], name: 'Kinoabend', prize: 50, icon: '🍿', feld: 'oben, 2. Feld von links', bubble: 'Popcorn-Alarm! Aber erst das Rätsel.' },
  { pos: [4, 1], name: 'Dinner for 2', prize: 50, icon: '🕯️', feld: 'links Mitte', bubble: 'Kerzenlicht und Tisch für zwei. Fast geschafft.' },
  { pos: [7, 4], name: 'Spieleabend mit Freunden', prize: 50, icon: '🎲', feld: 'unten Mitte', bubble: 'Der Endgegner! Jetzt zeigt, was ihr könnt.' },
];

// Fragen in steigender Schwierigkeit (Plan §7), Backup = leichtere Ersatzfrage.
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
];

export const STATIONS = PLACES.map((p, i) => ({ ...p, ...QUIZ[i] }));

export const FINALE = {
  pos: [4, 4], name: 'Flitterwochen', prize: 100, icon: '🌴', feld: 'Mitte',
  bubble: 'Alle vier Schätze! Der größte wartet in der Mitte.',
  text: 'Hebt das goldene Podest an!',
};

export const TOTAL = STATIONS.reduce((s, x) => s + x.prize, FINALE.prize);
