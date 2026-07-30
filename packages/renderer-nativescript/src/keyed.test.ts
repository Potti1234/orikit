import { describe, expect, it } from 'vitest'

import { applyKeyedValues, reconcileKeyedValues } from './keyed'

type Row = Readonly<{ key: string; title: string }>

describe('keyed virtualized values', () => {
  it('preserves unchanged row values and updates changed content', () => {
    const first = { key: 'a', title: 'First' }
    const second = { key: 'b', title: 'Second' }
    const values = reconcileKeyedValues(
      [first, second],
      [
        { key: 'a', title: 'First' },
        { key: 'b', title: 'Edited' },
      ],
      (left, right) => left.title === right.title,
    )
    expect(values[0]).toBe(first)
    expect(values[1]).not.toBe(second)
  })

  it('moves, inserts, and removes without replacing stable values', () => {
    const a = { key: 'a', title: 'A' }
    const b = { key: 'b', title: 'B' }
    const values: Array<Row> = [a, b, { key: 'stale', title: 'Stale' }]
    const adapter = {
      get length() {
        return values.length
      },
      getItem: (index: number) => values[index] as Row,
      setItem: (index: number, value: Row) => {
        values[index] = value
      },
      splice: (start: number, deleteCount = 0, ...items: Array<Row>) =>
        values.splice(start, deleteCount, ...items),
    }
    applyKeyedValues(adapter, [b, { key: 'c', title: 'C' }, a])
    expect(values[0]).toBe(b)
    expect(values[2]).toBe(a)
    expect(values.map(({ key }) => key)).toEqual(['b', 'c', 'a'])
  })
})
