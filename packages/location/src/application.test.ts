import type { RuntimeAbortSignal } from '@orikit/runtime'
import { describe, expect, it } from 'vitest'

import { createLocationApplication } from './application'
import { createFakeLocationCapability, type LocationCapability } from './capability'
import { locationRequested } from './program'

const fix = {
  latitude: 52.52,
  longitude: 13.405,
  accuracyMeters: 8,
  capturedAtMilliseconds: 1_722_345_678_000,
  provider: 'fake',
}

describe('location application', () => {
  it('runs deterministic permission and location capability contracts', async () => {
    const capability = createFakeLocationCapability('Granted', { _tag: 'Located', fix })
    const application = createLocationApplication(capability)
    await application.settle()
    application.dispatch(locationRequested())
    await application.settle()

    expect(application.current().permission).toEqual({ _tag: 'Granted' })
    expect(application.current().location).toEqual({ _tag: 'Available', fix })
    expect(capability.calls()).toEqual(['CheckPermission', 'ReadLocation'])
    application.dispose()
  })

  it('cancels on background and quarantines a late native callback', async () => {
    let resolveRead:
      | ((value: Awaited<ReturnType<LocationCapability['readCurrentLocation']>>) => void)
      | undefined
    let readSignal: RuntimeAbortSignal | undefined
    const capability: LocationCapability = {
      checkPermission: async () => 'Granted',
      requestPermission: async () => 'Granted',
      readCurrentLocation: (signal) => {
        readSignal = signal
        return new Promise((resolve) => {
          resolveRead = resolve
        })
      },
    }
    const application = createLocationApplication(capability)
    await application.settle()
    application.dispatch(locationRequested())
    await Promise.resolve()
    expect(application.current().location).toEqual({ _tag: 'Locating' })

    await application.enterBackground()
    expect(readSignal?.aborted).toBe(true)
    expect(application.current().location).toEqual({ _tag: 'Failed', reason: 'Interrupted' })

    resolveRead?.({ _tag: 'Located', fix })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(application.current().location).toEqual({ _tag: 'Failed', reason: 'Interrupted' })
    expect(
      application
        .events()
        .some(
          (event) => event._tag === 'QuarantinedCompletion' && event.reason === 'BranchChanged',
        ),
    ).toBe(true)
    application.dispose()
  })
})
