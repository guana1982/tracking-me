import {
  KITCHEN_UNITS,
  type KitchenCategoryDTO,
  type KitchenUnitDTO,
} from './kitchen-types';

/** The key two spellings of the same thing share: "Pomodori " and "pomodori" are one item */
export function kitchenNameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export type KitchenDimension = 'mass' | 'volume' | 'pieces' | 'packs';

const UNIT_BASE: Record<KitchenUnitDTO, { dimension: KitchenDimension; factor: number }> = {
  g: { dimension: 'mass', factor: 1 },
  kg: { dimension: 'mass', factor: 1000 },
  ml: { dimension: 'volume', factor: 1 },
  l: { dimension: 'volume', factor: 1000 },
  pz: { dimension: 'pieces', factor: 1 },
  conf: { dimension: 'packs', factor: 1 },
};

export function unitDimension(unit: KitchenUnitDTO): KitchenDimension {
  return UNIT_BASE[unit].dimension;
}

/** Grams, millilitres, pieces or packs */
export function toBaseAmount(quantity: number, unit: KitchenUnitDTO): number {
  return quantity * UNIT_BASE[unit].factor;
}

export function fromBaseAmount(amount: number, unit: KitchenUnitDTO): number {
  return amount / UNIT_BASE[unit].factor;
}

/** Rounded the way a person would say it: 0.5 kg, 250 g, 3 pz */
export function roundKitchenQuantity(quantity: number): number {
  return Math.round(quantity * 100) / 100;
}

export function formatKitchenQuantity(quantity: number | null, unit: KitchenUnitDTO): string {
  if (quantity === null) return '';
  let value = quantity;
  let shownUnit: string = unit;
  if (unit === 'g' && value >= 1000) {
    value /= 1000;
    shownUnit = 'kg';
  } else if (unit === 'ml' && value >= 1000) {
    value /= 1000;
    shownUnit = 'l';
  }
  const text = roundKitchenQuantity(value).toLocaleString('it-IT', { maximumFractionDigits: 2 });
  return `${text} ${shownUnit}`;
}

const CATEGORY_KEYWORDS: Array<[KitchenCategoryDTO, string[]]> = [
  ['FROZEN', ['surgelat', 'gelato', 'bastoncini', 'findus', 'piselli surgelati']],
  ['PRODUCE', [
    'mela', 'mele', 'pera', 'pere', 'banan', 'aranc', 'limon', 'mandarin', 'kiwi', 'frutta', 'fragol', 'uva',
    'pesca', 'pesche', 'albicocc', 'melone', 'anguria', 'ananas', 'insalata', 'lattuga', 'rucola', 'spinaci',
    'pomodor', 'zucchin', 'melanzan', 'peperon', 'carot', 'patat', 'cipoll', 'aglio', 'sedano', 'broccol',
    'cavolfior', 'cavol', 'finocch', 'zucca', 'funghi', 'basilico', 'prezzemolo', 'verdur', 'legum', 'ceci',
    'lenticchie', 'fagiol', 'piselli', 'avocado', 'cetriol', 'radicchio', 'asparag', 'carciof',
  ]],
  ['BAKERY', [
    'pane', 'pasta', 'spaghetti', 'penne', 'fusilli', 'riso', 'farina', 'cracker', 'fette biscottate', 'grissini',
    'cereali', 'biscott', 'pizza', 'piadin', 'tortillas', 'gnocchi', 'lasagne', 'couscous', 'farro', 'orzo',
    'pangrattato', 'brioche', 'cornetti', 'tortellini', 'ravioli',
  ]],
  ['MEAT_FISH', [
    'pollo', 'tacchino', 'manzo', 'vitello', 'maiale', 'carne', 'macinato', 'salsicc', 'hamburger', 'bistecc',
    'prosciutto', 'salame', 'bresaola', 'mortadella', 'speck', 'pancetta', 'wurstel', 'pesce', 'salmone',
    'guanciale', 'tonno fresco', 'merluzzo', 'orata', 'branzino', 'gamber', 'cozze', 'vongole', 'calamar', 'polpo', 'cotolett',
    'fesa', 'petto di pollo', 'arrosto', 'filetto',
  ]],
  ['DAIRY', [
    'latte', 'yogurt', 'burro', 'panna', 'formaggio', 'parmigiano', 'grana', 'mozzarella', 'ricotta',
    'stracchino', 'mascarpone', 'scamorza', 'uova', 'uovo', 'philadelphia', 'pecorino', 'fontina', 'gorgonzola',
    'emmental', 'provola', 'sottilette', 'kefir',
  ]],
  ['DRINKS', ['acqua', 'succo', 'vino', 'birra', 'coca', 'aranciata', 'tè', 'te freddo', 'bibit', 'spremuta']],
  ['HOUSEHOLD', [
    'detersiv', 'sapone', 'shampoo', 'dentifricio', 'carta igienica', 'scottex', 'carta cucina', 'spugn',
    'sacchetti', 'pannolin', 'salviett', 'ammorbidente', 'candeggina', 'bagnoschiuma', 'deodorante',
    'pellicola', 'alluminio', 'fazzoletti',
  ]],
  ['PANTRY', [
    'olio', 'aceto', 'sale', 'zucchero', 'caffè', 'caffe', 'passata', 'pelati', 'tonno', 'sugo', 'pesto',
    'marmellata', 'miele', 'nutella', 'cioccolat', 'spezie', 'pepe', 'origano', 'dado', 'brodo', 'legumi in scatola',
    'mais', 'olive', 'capperi', 'maionese', 'ketchup', 'senape', 'lievito', 'cacao', 'frutta secca', 'noci',
    'mandorle', 'tisana', 'camomilla',
  ]],
];

/** A first guess at the aisle from the name, so a quick add lands in the right group */
export function guessKitchenCategory(name: string): KitchenCategoryDTO {
  // Matched from the start of a word, so "tè" does not catch "detersivo"
  const key = ` ${kitchenNameKey(name)}`;
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => key.includes(` ${kitchenNameKey(keyword)}`))) return category;
  }
  return 'OTHER';
}

const UNIT_ALIASES: Record<string, KitchenUnitDTO> = {
  pz: 'pz',
  pezzi: 'pz',
  pezzo: 'pz',
  x: 'pz',
  g: 'g',
  gr: 'g',
  grammi: 'g',
  kg: 'kg',
  chili: 'kg',
  kilo: 'kg',
  ml: 'ml',
  l: 'l',
  lt: 'l',
  litri: 'l',
  litro: 'l',
  conf: 'conf',
  confezioni: 'conf',
  confezione: 'conf',
  pacchi: 'conf',
  pacco: 'conf',
  scatole: 'conf',
  scatola: 'conf',
  bottiglie: 'conf',
  bottiglia: 'conf',
};

export interface ParsedKitchenItem {
  name: string;
  quantity: number | null;
  unit: KitchenUnitDTO;
  /** Whether the line said the unit, or it is the fallback */
  hasUnit: boolean;
}

/**
 * Reads one line the way it is typed in a hurry: "latte 2 l", "2 kg patate",
 * "uova 6", "pane". Without a number the quantity stays open.
 */
export function parseKitchenLine(line: string, fallbackUnit: KitchenUnitDTO = 'pz'): ParsedKitchenItem | null {
  const text = line.replace(/\s+/g, ' ').trim();
  if (!text) return null;

  const number = String.raw`(\d+(?:[.,]\d+)?)`;
  const unit = String.raw`([a-zA-Z]+)`;
  const patterns: Array<{ regex: RegExp; name: number; quantity: number; unit?: number }> = [
    // "latte 2 l", "latte 2l", "uova 6"
    { regex: new RegExp(`^(.+?)\\s+${number}\\s*${unit}?$`), name: 1, quantity: 2, unit: 3 },
    // "2 kg patate", "2kg patate", "6 uova"
    { regex: new RegExp(`^${number}\\s*${unit}\\s+(.+)$`), name: 3, quantity: 1, unit: 2 },
    { regex: new RegExp(`^${number}\\s+(.+)$`), name: 2, quantity: 1 },
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (!match) continue;
    const rawUnit = pattern.unit ? match[pattern.unit] : undefined;
    const parsedUnit = rawUnit ? UNIT_ALIASES[rawUnit.toLowerCase()] : undefined;
    // "2 pomodori grandi" - the word after the number was not a unit, so it is part of the name
    if (rawUnit && !parsedUnit) {
      if (pattern.unit === 2) {
        return {
          name: `${rawUnit} ${match[pattern.name]}`.trim(),
          quantity: Number(match[pattern.quantity].replace(',', '.')),
          unit: fallbackUnit,
          hasUnit: false,
        };
      }
      continue;
    }
    const quantity = Number(match[pattern.quantity].replace(',', '.'));
    const name = match[pattern.name].trim();
    if (!name || !Number.isFinite(quantity) || quantity <= 0) continue;
    return { name, quantity, unit: parsedUnit ?? fallbackUnit, hasUnit: Boolean(parsedUnit) };
  }

  return { name: text, quantity: null, unit: fallbackUnit, hasUnit: false };
}

export function isKitchenUnit(value: string): value is KitchenUnitDTO {
  return (KITCHEN_UNITS as readonly string[]).includes(value);
}
