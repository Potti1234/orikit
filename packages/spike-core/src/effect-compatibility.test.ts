import { describe, expect, it } from 'vitest'

import { runEffectCompatibilityChecks } from './effect-compatibility'

describe('Effect compatibility vector', () => {
  it('passes on Node', async () => {
    const result = await runEffectCompatibilityChecks('node')
    expect(result.checks).not.toEqual({})
    expect(Object.values(result.checks).filter((check) => check.status !== 'pass')).toEqual([])
  })
})
