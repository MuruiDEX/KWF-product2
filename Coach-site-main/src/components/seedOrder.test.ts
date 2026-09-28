import { describe, expect, it } from 'vitest'
import { dropSeedId, isSameIdSet, moveSeedId, normalizeSeedOrder } from './seedOrder'

describe('moveSeedId', () => {
  it('сдвиг вверх/вниз меняет соседей местами', () => {
    expect(moveSeedId([1, 2, 3], 2, -1)).toEqual([2, 1, 3])
    expect(moveSeedId([1, 2, 3], 2, 1)).toEqual([1, 3, 2])
  })

  it('границы и неизвестный id — без изменений (тот же массив по значению)', () => {
    expect(moveSeedId([1, 2, 3], 1, -1)).toEqual([1, 2, 3])
    expect(moveSeedId([1, 2, 3], 3, 1)).toEqual([1, 2, 3])
    expect(moveSeedId([1, 2, 3], 9, 1)).toEqual([1, 2, 3])
  })

  it('входной массив не мутирует', () => {
    const src = [1, 2, 3]
    moveSeedId(src, 2, -1)
    expect(src).toEqual([1, 2, 3])
  })
})

describe('dropSeedId', () => {
  it('перетаскивание на позицию', () => {
    expect(dropSeedId([1, 2, 3, 4], 4, 0)).toEqual([4, 1, 2, 3])
    expect(dropSeedId([1, 2, 3, 4], 1, 3)).toEqual([2, 3, 4, 1])
  })

  it('та же позиция и clamp границ', () => {
    expect(dropSeedId([1, 2, 3], 2, 1)).toEqual([1, 2, 3])
    expect(dropSeedId([1, 2, 3], 3, 99)).toEqual([1, 2, 3])
    expect(dropSeedId([1, 2, 3], 1, -5)).toEqual([1, 2, 3])
  })
})

describe('isSameIdSet', () => {
  it('перестановка — true, другой состав/дубли — false', () => {
    expect(isSameIdSet([1, 2, 3], [3, 2, 1])).toBe(true)
    expect(isSameIdSet([1, 2], [1, 2, 3])).toBe(false)
    expect(isSameIdSet([1, 1, 2], [1, 1, 2])).toBe(false)
    expect(isSameIdSet([1, 2], [1, 9])).toBe(false)
  })
})

describe('normalizeSeedOrder', () => {
  it('дубли схлопываются, чужие id отбрасываются', () => {
    expect(normalizeSeedOrder([1, 2, 2, 9, 3], [1, 2, 3])).toEqual([1, 2, 3])
    expect(normalizeSeedOrder([], [1])).toEqual([])
  })
})
