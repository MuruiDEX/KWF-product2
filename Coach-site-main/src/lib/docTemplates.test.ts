import { beforeEach, describe, expect, it, vi } from "vitest"
import { deleteTemplate, loadTemplates, saveTemplate } from "@/lib/docTemplates"

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  }
}

describe("docTemplates", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage())
  })

  it("saves and loads", () => {
    const t = saveTemplate({ name: "Шаблон", docType: "spravka", header: "H", footer: "F" })
    expect(t.id).toBeTruthy()
    expect(loadTemplates()).toHaveLength(1)
    expect(loadTemplates()[0].name).toBe("Шаблон")
  })

  it("deletes", () => {
    const t = saveTemplate({ name: "X", docType: "a", header: "", footer: "" })
    deleteTemplate(t.id)
    expect(loadTemplates()).toHaveLength(0)
  })

  it("returns [] without storage", () => {
    vi.stubGlobal("localStorage", undefined)
    expect(loadTemplates()).toEqual([])
  })
})
