import { describe, expect, it } from 'vitest'

import {
  createPortableCounterRuntime,
  runPortableCounterFixture,
  verifyPortableCommand,
} from './index'

describe('shared FoldKit portable kernel spike', () => {
  it('runs the same deterministic fixture for every host', () => {
    expect(runPortableCounterFixture()).toEqual({
      finalCount: 1,
      messageTags: [
        'IncrementedPortableCounter',
        'IncrementedPortableCounter',
        'ResetPortableCounter',
        'IncrementedPortableCounter',
      ],
    })
  })

  it('runs a real FoldKit Command through the production adapter', async () => {
    const runtime = createPortableCounterRuntime()
    const evidence = await verifyPortableCommand(runtime)

    expect(evidence).toEqual({
      name: 'VerifyPortableCommand',
      wasDeferred: true,
      serializedEffect: false,
    })
    expect(runtime.current().count).toBe(1)
    expect(runtime.metrics()).toMatchObject({ commandsCompleted: 1 })
  })
})


