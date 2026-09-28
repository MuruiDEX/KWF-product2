import { describe, expect, it } from 'vitest'
import { EMPTY_TOURNAMENT_INFO } from './wizardTypes'
import { hasErrors, validateInfo } from './wizardValidation'

describe('validateInfo', () => {
  it('пустая форма — ошибки name/start/end', () => {
    const errors = validateInfo(EMPTY_TOURNAMENT_INFO)
    expect(errors.name).toBeTruthy()
    expect(errors.start_date).toBeTruthy()
    expect(errors.end_date).toBeTruthy()
    expect(hasErrors(errors)).toBe(true)
  })

  it('валидная форма — без ошибок', () => {
    const errors = validateInfo({
      ...EMPTY_TOURNAMENT_INFO,
      name: 'Кубок KWF 2026',
      start_date: '2026-10-01',
      end_date: '2026-10-05',
    })
    expect(hasErrors(errors)).toBe(false)
  })

  it('старт позже финиша — dateRange', () => {
    const errors = validateInfo({
      ...EMPTY_TOURNAMENT_INFO,
      name: 'Кубок',
      start_date: '2026-10-05',
      end_date: '2026-10-01',
    })
    expect(errors.dateRange).toBeTruthy()
  })

  it('ноль татами — mats_count', () => {
    const errors = validateInfo({
      ...EMPTY_TOURNAMENT_INFO,
      name: 'Кубок',
      start_date: '2026-10-01',
      end_date: '2026-10-02',
      mats_count: 0,
    })
    expect(errors.mats_count).toBeTruthy()
  })
})
