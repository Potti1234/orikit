import { describe, expect, it } from 'vitest'

import { applyKeyedItems, reconcileKeyedItems } from './keyed-items'

type Row = Readonly<{ id: string; title: string }>

const equal = (left: Row, right: Row): boolean => left.title === right.title

describe('native keyed Todo reconciliation', () => {
  it('preserves unchanged row objects while replacing changed content', () => {
    const first = { id: 'a', title: 'First' }
    const second = { id: 'b', title: 'Second' }
    const rows = reconcileKeyedItems(
      [first, second],
      [
        { id: 'a', title: 'First' },
        { id: 'b', title: 'Edited' },
      ],
      equal,
    )

    expect(rows[0]).toBe(first)
    expect(rows[1]).not.toBe(second)
    expect(rows[1]?.title).toBe('Edited')
  })

  it('moves, inserts, and deletes by stable identity', () => {
    const values: Array<Row> = [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
      { id: 'stale', title: 'Stale' },
    ]
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
    const desired = [
      { id: 'b', title: 'B' },
      { id: 'c', title: 'C' },
      { id: 'a', title: 'A' },
    ]

    applyKeyedItems(adapter, desired)

    expect(values).toEqual(desired)
    expect(values.map(({ id }) => id)).not.toContain('stale')
  })
})
