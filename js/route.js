// Weg vom Start (7,7) zum Podest (4,4), Feld für Feld als [reihe, spalte] (1-basiert, Rot oben links).
// Ermittelt aus IMG_6834/6835/6824, siehe docs/ROUTE.md. Stationen in Weg-Reihenfolge:
// (2,6) → (1,2) → (4,1) → (7,4); (7,4) ist ein Abstecher: (7,3) → (7,4) → zurück (7,3).
export const ROUTE = [
  [7,7],[7,6],[6,6],[5,6],[5,7],[4,7],[3,7],[3,6],[2,6],[2,7],
  [1,7],[1,6],[1,5],[2,5],[2,4],[1,4],[1,3],[1,2],[1,1],[2,1],
  [3,1],[3,2],[2,2],[2,3],[3,3],[4,3],[5,3],[5,2],[4,2],[4,1],
  [5,1],[6,1],[7,1],[7,2],[7,3],[7,4],[7,3],[6,3],[6,4],[5,4],
  [4,4],
];

export const BOARD_IMAGE = { src: 'assets/board.jpg', tileArea: { x0: 0.034, y0: 0.034, x1: 0.966, y1: 0.966 } };

export const TARGET_TILE_AREA = { x0: 0.034, y0: 0.034, x1: 0.966, y1: 0.966 };

export const DOTS = { rot: [3,3], gruen: [3,5], gelb: [5,3], blau: [5,5] };
