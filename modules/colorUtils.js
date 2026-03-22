export const BOARD_SIZE = 1024;

export const PALETTE = Object.freeze([
  { index: 0, hex: "#FFFFFF", name: "Белый" },
  { index: 1, hex: "#E4E4E4", name: "Светло-серый" },
  { index: 2, hex: "#888888", name: "Серый" },
  { index: 3, hex: "#222222", name: "Тёмно-серый" },
  { index: 4, hex: "#000000", name: "Чёрный" },
  { index: 5, hex: "#5A301D", name: "Тёмно-коричневый" },
  { index: 6, hex: "#A06A42", name: "Коричневый" },
  { index: 7, hex: "#FFC48C", name: "Телесный" },
  { index: 8, hex: "#6D001A", name: "Бордовый" },
  { index: 9, hex: "#BE0039", name: "Тёмно-красный" },
  { index: 10, hex: "#E50000", name: "Красный" },
  { index: 11, hex: "#FF3881", name: "Ярко-розовый" },
  { index: 12, hex: "#FFA7D1", name: "Светло-розовый" },
  { index: 13, hex: "#DE107F", name: "Маджента" },
  { index: 14, hex: "#E59500", name: "Тёмно-оранжевый" },
  { index: 15, hex: "#FFA800", name: "Оранжевый" },
  { index: 16, hex: "#E5D900", name: "Жёлтый" },
  { index: 17, hex: "#FFF8B8", name: "Светло-жёлтый" },
  { index: 18, hex: "#005F39", name: "Тёмно-зелёный" },
  { index: 19, hex: "#02BE01", name: "Зелёный" },
  { index: 20, hex: "#94E044", name: "Салатовый" },
  { index: 21, hex: "#00756F", name: "Морской" },
  { index: 22, hex: "#0000EA", name: "Тёмно-синий" },
  { index: 23, hex: "#0083C7", name: "Синий" },
  { index: 24, hex: "#3690EA", name: "Светло-синий" },
  { index: 25, hex: "#00D3DD", name: "Бирюзовый" },
  { index: 26, hex: "#51E9F4", name: "Светло-голубой" },
  { index: 27, hex: "#493AC1", name: "Тёмный индиго" },
  { index: 28, hex: "#6A5CFF", name: "Индиго" },
  { index: 29, hex: "#B44AC0", name: "Фиолетовый" },
  { index: 30, hex: "#811E9F", name: "Тёмно-фиолетовый" },
  { index: 31, hex: "#2B2D42", name: "Холодный тёмный" }
]);

const exactColorMap = new Map();
const nearestColorCache = new Map();

export const PALETTE_RGB = PALETTE.map((entry) => {
  const value = Number.parseInt(entry.hex.slice(1), 16);
  const rgb = [
    (value >> 16) & 0xff,
    (value >> 8) & 0xff,
    value & 0xff
  ];

  exactColorMap.set(rgb.join(","), entry.index);

  return rgb;
});

export function getPaletteRgb(index) {
  return PALETTE_RGB[index] || [0, 0, 0];
}

export function findClosestPaletteIndex(r, g, b) {
  const exactKey = `${r},${g},${b}`;

  if (exactColorMap.has(exactKey)) {
    return exactColorMap.get(exactKey);
  }

  const cacheKey = (r << 16) | (g << 8) | b;

  if (nearestColorCache.has(cacheKey)) {
    return nearestColorCache.get(cacheKey);
  }

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < PALETTE_RGB.length; index += 1) {
    const [pr, pg, pb] = PALETTE_RGB[index];
    const dr = r - pr;
    const dg = g - pg;
    const db = b - pb;
    const distance = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  nearestColorCache.set(cacheKey, bestIndex);
  return bestIndex;
}

export function findClosestPaletteIndexForPixel(r, g, b, a) {
  if (a < 16) {
    return -1;
  }

  return findClosestPaletteIndex(r, g, b);
}
