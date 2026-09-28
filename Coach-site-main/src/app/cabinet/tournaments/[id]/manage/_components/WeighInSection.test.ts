import { describe, expect, it } from "vitest"
import {
  filterWeighinRows,
  type WeighinRow,
} from "@/app/cabinet/tournaments/[id]/manage/_components/WeighInSection"

const rows: WeighinRow[] = [
  { id: 1, name: "Иванов Иван", club: "Барс", categoryNames: "A", categoryId: 10, weightActual: "38", limit: 40, overweight: false, weighed: true },
  { id: 2, name: "Петров Пётр", club: null, categoryNames: "A", categoryId: 10, weightActual: null, limit: 40, overweight: false, weighed: false },
  { id: 3, name: "Сидоров Сидор", club: "Тигр", categoryNames: "B", categoryId: 20, weightActual: "45", limit: 40, overweight: true, weighed: true },
]

describe("filterWeighinRows", () => {
  it("пустой запрос возвращает всех", () => {
    expect(
      filterWeighinRows(rows, { query: "", status: "all", categoryId: null })
    ).toHaveLength(3)
  })

  it("поиск по имени — регистронезависимый, главный способ поиска", () => {
    expect(
      filterWeighinRows(rows, { query: "иванов", status: "all", categoryId: null }).map((r) => r.id)
    ).toEqual([1])
    expect(
      filterWeighinRows(rows, { query: "  ПЕТР ", status: "all", categoryId: null }).map((r) => r.id)
    ).toEqual([2])
  })

  it("фильтр без веса", () => {
    expect(
      filterWeighinRows(rows, { query: "", status: "unweighed", categoryId: null }).map((r) => r.id)
    ).toEqual([2])
  })

  it("фильтр перевеса", () => {
    expect(
      filterWeighinRows(rows, { query: "", status: "overweight", categoryId: null }).map((r) => r.id)
    ).toEqual([3])
  })

  it("фильтр категории комбинируется с поиском", () => {
    expect(
      filterWeighinRows(rows, { query: "", status: "all", categoryId: 20 }).map((r) => r.id)
    ).toEqual([3])
    expect(
      filterWeighinRows(rows, { query: "сидор", status: "overweight", categoryId: 20 })
    ).toHaveLength(1)
    expect(
      filterWeighinRows(rows, { query: "иванов", status: "all", categoryId: 20 })
    ).toHaveLength(0)
  })
})
