// Phase 2B: шаблоны ДОКУМЕНТОВ в localStorage.
// Не путать с TournamentTemplate (структура турнира) — это структура документа.

export interface DocumentTemplate {
  id: string
  name: string
  docType: string
  header: string
  footer: string
  createdAt: string
}

const KEY = "kwf-doc-templates"

function storage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null
    return localStorage
  } catch {
    return null
  }
}

export function loadTemplates(): DocumentTemplate[] {
  const s = storage()
  if (!s) return []
  try {
    const raw = s.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (t): t is DocumentTemplate =>
        !!t && typeof t === "object" && typeof (t as DocumentTemplate).name === "string"
    )
  } catch {
    return []
  }
}

function persist(all: DocumentTemplate[]) {
  storage()?.setItem(KEY, JSON.stringify(all))
}

export function saveTemplate(t: Omit<DocumentTemplate, "id" | "createdAt">): DocumentTemplate {
  const item: DocumentTemplate = {
    ...t,
    id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    createdAt: new Date().toISOString(),
  }
  const all = loadTemplates()
  all.unshift(item)
  persist(all.slice(0, 50))
  return item
}

export function deleteTemplate(id: string) {
  persist(loadTemplates().filter((t) => t.id !== id))
}
