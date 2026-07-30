import { describe, expect, it } from 'vitest'

import {
  enteredBackground,
  initialLocationModel,
  locationReadFailed,
  locationRequested,
  permissionRequestRequested,
  permissionResolved,
  returnedForeground,
  updateLocation,
} from './program'

describe('location program', () => {
  it('represents denial and permanent denial explicitly', () => {
    const denied = updateLocation(initialLocationModel(), permissionResolved('Denied'))[0]
    expect(denied.permission).toEqual({ _tag: 'Denied' })
    expect(denied.location).toEqual({ _tag: 'Failed', reason: 'PermissionDenied' })

    const permanent = updateLocation(denied, permissionResolved('DeniedPermanently'))[0]
    expect(permanent.permission).toEqual({ _tag: 'DeniedPermanently' })
    expect(permanent.location).toEqual({
      _tag: 'Failed',
      reason: 'PermissionDeniedPermanently',
    })
  })

  it('describes permission requests and location reads as Commands', () => {
    const [requesting, permissionCommands] = updateLocation(
      initialLocationModel(),
      permissionRequestRequested(),
    )
    expect(requesting.permission).toEqual({ _tag: 'Requesting' })
    expect(permissionCommands).toEqual([{ _tag: 'RequestLocationPermission' }])

    const granted = updateLocation(requesting, permissionResolved('Granted'))[0]
    const [locating, locationCommands] = updateLocation(granted, locationRequested())
    expect(locating.location).toEqual({ _tag: 'Locating' })
    expect(locationCommands).toEqual([{ _tag: 'ReadCurrentLocation' }])
  })

  it('interrupts an active read when entering the background', () => {
    const granted = updateLocation(initialLocationModel(), permissionResolved('Granted'))[0]
    const locating = updateLocation(granted, locationRequested())[0]
    const background = updateLocation(locating, enteredBackground())[0]
    expect(background.lifecycle).toBe('Background')
    expect(background.location).toEqual({ _tag: 'Failed', reason: 'Interrupted' })
  })

  it('clears a permission failure after access is granted', () => {
    const denied = updateLocation(initialLocationModel(), permissionResolved('Denied'))[0]
    const granted = updateLocation(denied, permissionResolved('Granted'))[0]
    expect(granted.location).toEqual({ _tag: 'Idle' })
  })

  it('rechecks permission after returning to the foreground', () => {
    const background = updateLocation(initialLocationModel(), enteredBackground())[0]
    const [foreground, commands] = updateLocation(background, returnedForeground())
    expect(foreground.lifecycle).toBe('Active')
    expect(foreground.permission).toEqual({ _tag: 'Checking' })
    expect(commands).toEqual([{ _tag: 'CheckLocationPermission' }])
  })

  it('ignores stale failures after an interrupted read', () => {
    const model = {
      ...initialLocationModel(),
      permission: { _tag: 'Granted' } as const,
      location: { _tag: 'Failed', reason: 'Interrupted' } as const,
    }
    expect(updateLocation(model, locationReadFailed('TimedOut'))[0]).toEqual(model)
  })
})
