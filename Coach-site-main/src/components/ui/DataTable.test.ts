import { describe, expect, it } from "vitest"
import {
  filterTableRows,
  paginateTableRows,
  sortTableRows,
  type DataTableColumn,
} from "@/components/ui/DataTable"

interface Row {
  id: number
  name: string
  count: number
}

const rows: Row[] = [
  { id: 1, name: "Вихрь", count: 10 },
  { id: 2, name: "Барс", count: 3 },
  { id: 3, name: "Тигр", count: 7 },
]

const nameCol: DataTableColumn<Row> = {
  id: "name",
  header: "Имя",
  render: (r) => r.name,
  sortValue: (r) => r.name,
}

const countCol: DataTableColumn<Row> = {
  id: "count",
  header: "Кол-во",
  render: (r) => r.count,
  sortValue: (r) => r.count,
}

describe("filterTableRows", () => {
  it("returns all rows on empty query", () => {
    expect(filterTableRows(rows, "  ", (r) => r.name)).toHaveLength(3)
  })

  it("filters case-insensitively", () => {
    expect(filterTableRows(rows, "барс", (r) => r.name)).toEqual([rows[1]])
  })
})

describe("sortTableRows", () => {
  it("sorts strings with ru locale", () => {
    expect(sortTableRows(rows, nameCol, "asc").map((r) => r.name)).toEqual([
      "Барс",
      "Вихрь",
      "Тигр",
    ])
  })

  it("sorts numbers desc", () => {
    expect(sortTableRows(rows, countCol, "desc").map((r) => r.count)).toEqual([10, 7, 3])
  })

  it("returns rows untouched without sort column", () => {
    expect(sortTableRows(rows, null, "asc")).toBe(rows)
  })
})

describe("paginateTableRows", () => {
  it("slices pages", () => {
    expect(paginateTableRows(rows, 0, 2)).toHaveLength(2)
    expect(paginateTableRows(rows, 1, 2)).toEqual([rows[2]])
    expect(paginateTableRows(rows, 5, 2)).toEqual([])
  })
})
