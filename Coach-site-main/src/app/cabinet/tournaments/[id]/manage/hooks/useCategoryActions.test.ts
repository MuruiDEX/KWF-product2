import { describe, expect, it } from "vitest"
import { validateCategoryForm } from "@/app/cabinet/tournaments/[id]/manage/hooks/useCategoryActions"

const base = {
  name: "Мальчики 10-11, до 40 кг",
  gender: "male",
  age_min: "10",
  age_max: "11",
  weight_min: "0",
  weight_max: "40",
}

describe("validateCategoryForm", () => {
  it("валидная форма — parsed с числами", () => {
    const r = validateCategoryForm(base)
    expect("parsed" in r && r.parsed).toMatchObject({
      name: base.name,
      ageMin: 10,
      ageMax: 11,
      weightMin: 0,
      weightMax: 40,
    })
  })

  it("пустое название — ошибка", () => {
    expect(validateCategoryForm({ ...base, name: "  " })).toEqual({
      error: "Введите название категории.",
    })
  })

  it("возраст: инверсия и отрицательные — ошибка", () => {
    expect(validateCategoryForm({ ...base, age_min: "12", age_max: "10" })).toEqual({
      error: "Укажите корректный возрастной диапазон.",
    })
    expect(validateCategoryForm({ ...base, age_min: "-1", age_max: "10" })).toEqual({
      error: "Укажите корректный возрастной диапазон.",
    })
  })

  it("вес: ноль/мусор в максимуме — ошибка", () => {
    expect(validateCategoryForm({ ...base, weight_max: "0" })).toEqual({
      error: "Укажите корректный максимальный вес.",
    })
    expect(validateCategoryForm({ ...base, weight_max: "abc" })).toEqual({
      error: "Укажите корректный максимальный вес.",
    })
  })

  it("минимум больше максимума — ошибка", () => {
    expect(validateCategoryForm({ ...base, weight_min: "45", weight_max: "40" })).toEqual({
      error: "Минимальный вес должен быть в пределах от 0 до максимального.",
    })
  })

  it("запятая в весе парсится", () => {
    const r = validateCategoryForm({ ...base, weight_max: "40,5" })
    expect("parsed" in r && r.parsed.weightMax).toBe(40.5)
  })
})
