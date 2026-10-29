export interface BankExpenseRow {
  id: string;
  date: string;
  description: string;
  amount: number;
}

const italianMonths: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
};

function normalized(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseDate(value: string): string | null {
  const text = normalized(value).toLowerCase();
  const italian = text.match(/^(\d{1,2})\s+([a-zà]+)\s+(\d{4})$/i);
  if (italian) {
    const month = italianMonths[italian[2]];
    if (!month) return null;
    return `${italian[3]}-${String(month).padStart(2, '0')}-${italian[1].padStart(2, '0')}`;
  }
  const numeric = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (numeric) return `${numeric[3]}-${numeric[2].padStart(2, '0')}-${numeric[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function parseAmount(value: string): number | null {
  let text = normalized(value).replace(/[€'\s]/g, '');
  if (!text) return null;
  if (text.includes(',') && text.includes('.')) text = text.lastIndexOf(',') > text.lastIndexOf('.')
    ? text.replace(/\./g, '').replace(',', '.')
    : text.replace(/,/g, '');
  else if (text.includes(',')) text = text.replace(',', '.');
  const amount = Math.abs(Number(text));
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null;
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) { cells.push(cell); cell = ''; }
    else cell += character;
  }
  cells.push(cell);
  return cells;
}

function textRows(text: string): string[][] {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('<')) {
    const document = new DOMParser().parseFromString(text, 'text/html');
    return Array.from(document.querySelectorAll('tr, row')).map((row) =>
      Array.from(row.querySelectorAll('th,td,cell')).map((cell) => normalized(cell.textContent ?? ''))
    );
  }
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  const headerLine = lines.find((line) => /data\s*operazione/i.test(line)) ?? lines[0] ?? '';
  const delimiter = ['\t', ';', ','].sort((a, b) => headerLine.split(b).length - headerLine.split(a).length)[0];
  return lines.map((line) => parseDelimitedLine(line, delimiter));
}

export async function parseBankStatement(file: File): Promise<BankExpenseRow[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isBinaryXls = bytes.length > 8 && bytes.slice(0, 8).every((byte, i) => byte === [208, 207, 17, 224, 161, 177, 26, 225][i]);
  if (isBinaryXls) throw new Error('Questo XLS è in formato binario. Esportalo dalla banca come CSV oppure XLS (pagina web/XML).');
  const text = new TextDecoder('utf-8').decode(bytes);
  const rows = textRows(text);
  const headerIndex = rows.findIndex((row) => row.some((cell) => normalized(cell).toLowerCase() === 'data operazione'));
  if (headerIndex < 0) throw new Error('Tabella movimenti non trovata: manca la colonna “Data operazione”.');
  const headers = rows[headerIndex].map((cell) => normalized(cell).toLowerCase());
  const dateIndex = headers.indexOf('data operazione');
  const descriptionIndex = headers.indexOf('descrizione');
  const outgoingIndex = headers.indexOf('uscite');
  if (descriptionIndex < 0 || outgoingIndex < 0) throw new Error('Servono le colonne Data operazione, Descrizione e Uscite.');

  return rows.slice(headerIndex + 1).flatMap((row, index) => {
    const date = parseDate(row[dateIndex] ?? '');
    const description = normalized(row[descriptionIndex] ?? '');
    const amount = parseAmount(row[outgoingIndex] ?? '');
    if (!date || !description || description.toLowerCase() === 'totale' || amount === null) return [];
    return [{ id: `${index}-${date}-${amount}`, date, description: description.slice(0, 200), amount }];
  });
}
