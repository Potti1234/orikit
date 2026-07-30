import type { RuntimeAbortSignal } from '@orikit/runtime'

import type { LocationFailure, LocationFix, LocationPermission } from './program'

export type PermissionResult = Extract<
  LocationPermission['_tag'],
  'Granted' | 'Denied' | 'DeniedPermanently'
>

export type LocationResult =
  | Readonly<{ _tag: 'Located'; fix: LocationFix }>
  | Readonly<{ _tag: 'Failed'; reason: LocationFailure }>

export type LocationCapability = Readonly<{
  checkPermission: (signal: RuntimeAbortSignal) => Promise<PermissionResult>
  requestPermission: (signal: RuntimeAbortSignal) => Promise<PermissionResult>
  readCurrentLocation: (signal: RuntimeAbortSignal) => Promise<LocationResult>
}>

export type FakeLocationCapability = LocationCapability &
  Readonly<{
    setPermission: (permission: PermissionResult) => void
    setLocationResult: (result: LocationResult) => void
    calls: () => ReadonlyArray<'CheckPermission' | 'RequestPermission' | 'ReadLocation'>
  }>

const throwIfAborted = (signal: RuntimeAbortSignal): void => signal.throwIfAborted()

export const createFakeLocationCapability = (
  initialPermission: PermissionResult = 'Denied',
  initialLocationResult: LocationResult = { _tag: 'Failed', reason: 'Unavailable' },
): FakeLocationCapability => {
  let permission = initialPermission
  let locationResult = initialLocationResult
  const recordedCalls: Array<'CheckPermission' | 'RequestPermission' | 'ReadLocation'> = []
  return {
    checkPermission: async (signal) => {
      throwIfAborted(signal)
      recordedCalls.push('CheckPermission')
      return permission
    },
    requestPermission: async (signal) => {
      throwIfAborted(signal)
      recordedCalls.push('RequestPermission')
      return permission
    },
    readCurrentLocation: async (signal) => {
      throwIfAborted(signal)
      recordedCalls.push('ReadLocation')
      return locationResult
    },
    setPermission: (next) => {
      permission = next
    },
    setLocationResult: (next) => {
      locationResult = next
    },
    calls: () => [...recordedCalls],
  }
}
