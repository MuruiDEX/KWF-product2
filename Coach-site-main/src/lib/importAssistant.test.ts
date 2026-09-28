import { describe, expect, it } from "vitest"
import {
  countDuplicates,
  detectFormat,
  formatBytes,
  mappingComplete,
} from "@/lib/importAssistant"

describe("detectFormat", () => {
  it("detects by extension", () => {
    expect(detectFormat("kids.csv")).toBe("csv")
    expect(detectFormat("Заявка.XLSX")).toBe("xlsx")
    expect(detectFormat("team.docx")).toBe("docx")
    expect(detectFormat("photo.png")).toBe(null)
    expect(detectFormat("noext")).toBe(null)
  })
})

describe("mappingComplete", () => {
  it("requires all required fields mapped once", () => {
    expect(
      mappingComplete({
        "Фамилия": "last_name",
        "Имя": "first_name",
        "Дата рождения": "birth_date",
        "Вес": "weight",
        "Пол": "gender",
        "Мусор": "",
      }).ok
    ).toBe(true)
    const res = mappingComplete({ "Фамилия": "last_name" })
    expect(res.ok).toBe(false)
    expect(res.missing).toContain("weight")
  })
})

describe("formatBytes/countDuplicates", () => {
  it("formats sizes", () => {
    expect(formatBytes(500)).toBe("500 Б")
    expect(formatBytes(2048)).toBe("2 КБ")
  })
  it("counts duplicate errors", () => {
    expect(
      countDuplicates([
        { row: 2, error: "Дубликат: уже есть в базе." },
        { row: 3, error: "Вес: укажите вес." },
      ])
    ).toBe(1)
  })
})
