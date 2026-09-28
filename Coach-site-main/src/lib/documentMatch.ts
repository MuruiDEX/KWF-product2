// Phase 2B: сопоставление строк «ФИО» со спортсменами турнира.
// trim → normalize (регистр, ё, пунктуация) → exact → fuzzy (Levenshtein ≤2)
// → single-surname fallback. Confidence честный, совпадения правит человек.

export interface MatchableAthlete {
  id: number
  first_name: string
  last_name: string
  birth_date?: string | null
  club?: string | null
  weight?: string | number | null
  gender?: string | null
  categoryNames?: string[]
}

export type NameMatchStatus = "matched" | "possible" | "notfound"

export interface NameMatch {
  line: string
  status: NameMatchStatus
  athlete: MatchableAthlete | null
  /** 0–100. matched ≥90, possible 50–89, notfound 0. */
  confidence: number
}

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let carry = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, carry + (a[i - 1] === b[j - 1] ? 0 : 1))
      carry = tmp
    }
  }
  return prev[b.length]
}

function tokenDistance(a: string, b: string): number {
  if (a === b) return 0
  // Одна опечатка в длинном токене — простительно, в коротком — нет.
  const maxDist = a.length >= 6 && b.length >= 6 ? 2 : 1
  const d = levenshtein(a, b)
  return d <= maxDist ? d : Infinity
}

interface Scored {
  athlete: MatchableAthlete
  score: number
}

function scoreAthlete(parts: string[], a: MatchableAthlete): Scored | null {
  const last = normalizeName(a.last_name)
  const first = normalizeName(a.first_name)
  if (!last || !first) return null
  const has = (tok: string) => parts.some((p) => tokenDistance(p, tok) !== Infinity)
  const exact = (tok: string) => parts.includes(tok)
  const dist = (tok: string) =>
    Math.min(...parts.map((p) => tokenDistance(p, tok)))

  const lastHit = has(last)
  const firstHit = has(first)
  if (!lastHit || !firstHit) {
    // Только фамилия и она уникальна — слабое предположение.
    if (parts.length === 1 && lastHit) return { athlete: a, score: 55 }
    return null
  }
  if (exact(last) && exact(first)) {
    // Полное совпадение (порядок не важен) — почти наверняка он.
    return { athlete: a, score: parts.length === 2 ? 98 : 94 }
  }
  const penalty = (dist(last) + dist(first)) * 8
  return { athlete: a, score: Math.max(60, 88 - penalty) }
}

export function matchName(line: string, athletes: MatchableAthlete[]): NameMatch {
  const trimmed = line.trim()
  if (!trimmed) return { line, status: "notfound", athlete: null, confidence: 0 }
  const parts = normalizeName(trimmed).split(" ").filter(Boolean)
  if (parts.length === 0) return { line, status: "notfound", athlete: null, confidence: 0 }

  let best: Scored | null = null
  let second = -1
  for (const a of athletes) {
    const s = scoreAthlete(parts, a)
    if (!s) continue
    if (!best || s.score > best.score) {
      second = best?.score ?? -1
      best = s
    } else if (s.score > second) {
      second = s.score
    }
  }
  if (!best) return { line: trimmed, status: "notfound", athlete: null, confidence: 0 }
  // Два близких кандидата — человек должен выбрать сам.
  if (second >= 0 && best.score - second < 8 && best.score < 95) {
    return { line: trimmed, status: "possible", athlete: best.athlete, confidence: Math.min(best.score, 74) }
  }
  if (best.score >= 90) {
    return { line: trimmed, status: "matched", athlete: best.athlete, confidence: best.score }
  }
  return { line: trimmed, status: "possible", athlete: best.athlete, confidence: best.score }
}

export function matchLines(lines: string[], athletes: MatchableAthlete[]): NameMatch[] {
  return lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => matchName(l, athletes))
}
