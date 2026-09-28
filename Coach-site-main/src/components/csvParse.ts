export interface CsvRow {
  /** Номер строки в файле (1 = заголовок, данные с 2 — как считает backend). */
  n: number
  first_name: string
  last_name: string
  birth_date: string
  weight: string
  gender: string
  height: string
  club: string
}

function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      quoted = !quoted
      continue
    }
    if (ch === delimiter && !quoted) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

/** Минимальный клиентский разбор CSV для preview-таблицы.
 * Источник истины по ошибкам — всегда backend dry_run; здесь только
 * структура строк (номера совпадают с backend: заголовок = 1). */
export function parseCsvRows(text: string): { rows: CsvRow[]; delimiter: string } {
  const lines = text.split(/\r?\n/)
  const headerLine = lines.find((l) => l.trim() !== '') ?? ''
  const commas = (headerLine.match(/,/g) ?? []).length
  const semis = (headerLine.match(/;/g) ?? []).length
  const delimiter = semis > commas ? ';' : ','
  const header = splitLine(headerLine, delimiter).map((h) => h.trim().toLowerCase())

  const idx = (name: string) => header.indexOf(name)
  const rows: CsvRow[] = []
  let n = 0
  for (const line of lines) {
    n += 1
    if (n === 1) continue // заголовок
    if (line.trim() === '') continue
    const cells = splitLine(line, delimiter)
    const get = (name: string) => {
      const i = idx(name)
      return i >= 0 ? (cells[i] ?? '') : ''
    }
    // Полностью пустые строки backend пропускает молча — делаем так же.
    const anyValue = ['first_name', 'last_name', 'birth_date', 'weight', 'gender', 'height', 'club'].some(
      (f) => get(f).trim() !== ''
    )
    if (!anyValue) continue
    rows.push({
      n,
      first_name: get('first_name'),
      last_name: get('last_name'),
      birth_date: get('birth_date'),
      weight: get('weight'),
      gender: get('gender'),
      height: get('height'),
      club: get('club'),
    })
  }
  return { rows, delimiter }
}
