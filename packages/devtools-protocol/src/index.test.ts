import { describe, expect, it } from 'vitest'
import { parseInspectorRequest } from './index'

describe('DevTools protocol', () => {
  it('validates travel mutation identity', () => {
    expect(
      parseInspectorRequest({
        id: '1',
        _tag: 'TravelTo',
        sequence: 2,
        expectedSessionId: 'session-1',
      }),
    ).toEqual({ id: '1', _tag: 'TravelTo', sequence: 2, expectedSessionId: 'session-1' })
    expect(() => parseInspectorRequest({ id: '1', _tag: 'TravelTo', sequence: 2 })).toThrow()
  })
})
