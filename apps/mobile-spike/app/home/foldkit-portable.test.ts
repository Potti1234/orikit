import {
  createPortableCounterRuntime,
  IncrementedPortableCounter,
  initialPortableCounterModel,
  updatePortableCounter,
  verifyPortableCommand,
} from '@orikit/foldkit-portable-spike'
import { describe, expect, it } from 'vitest'

describe('Foldkit portable Android fixture', () => {
  it('uses the real Foldkit Message and Update APIs for a pure transition', () => {
    expect(
      updatePortableCounter(initialPortableCounterModel(), IncrementedPortableCounter()),
    ).toEqual([{ count: 1 }, []])
  })

  it('defers the real Foldkit Command Effect and returns its Message', async () => {
    const runtime = createPortableCounterRuntime()
    const result = await verifyPortableCommand(runtime)

    expect(result).toEqual({
      name: 'VerifyPortableCommand',
      wasDeferred: true,
      serializedEffect: false,
    })
    expect(runtime.current()).toEqual({ count: 1 })
  })
})
