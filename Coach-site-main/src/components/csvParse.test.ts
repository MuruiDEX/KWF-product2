import { describe, expect, it } from 'vitest'
import { parseCsvRows } from './csvParse'

describe('parseCsvRows', () => {
  it('запятые + нумерация с учётом заголовка', () => {
    const { rows, delimiter } = parseCsvRows(
      'first_name,last_name,birth_date,weight,gender,club\nIvan,Petrov,2015-01-15,30,male,E2E'
    )
    expect(delimiter).toBe(',')
    expect(rows).toHaveLength(1)
    expect(rows[0].n).toBe(2)
    expect(rows[0].first_name).toBe('Ivan')
    expect(rows[0].club).toBe('E2E')
  })

  it('точка с запятой определяется автоматически', () => {
    const { rows, delimiter } = parseCsvRows(
      'first_name;last_name;birth_date;weight;gender\nAnna;Sidorova;2014-05-01;28;ж'
    )
    expect(delimiter).toBe(';')
    expect(rows[0].gender).toBe('ж')
  })

  it('пустые строки пропускаются, нумерация сохраняется', () => {
    const { rows } = parseCsvRows(
      'first_name,last_name,birth_date,weight,gender\nA,B,2015-01-01,30,male\n\nC,D,2015-02-02,31,male'
    )
    expect(rows.map((r) => r.n)).toEqual([2, 4])
  })
})
