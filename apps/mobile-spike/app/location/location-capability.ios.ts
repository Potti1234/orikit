import type { LocationCapability, LocationResult, PermissionResult } from '@orikit/location'
import type { RuntimeAbortSignal } from '@orikit/runtime'

import { OriKitLocationDelegate } from './location-delegate.ios'

const timeoutMilliseconds = 15_000

const delegate = OriKitLocationDelegate.new() as OriKitLocationDelegate
const manager = CLLocationManager.new()
manager.delegate = delegate
manager.desiredAccuracy = kCLLocationAccuracyBest

const classify = (status: CLAuthorizationStatus): PermissionResult => {
  switch (status) {
    case CLAuthorizationStatus.kCLAuthorizationStatusAuthorizedAlways:
    case CLAuthorizationStatus.kCLAuthorizationStatusAuthorizedWhenInUse:
      return 'Granted'
    case CLAuthorizationStatus.kCLAuthorizationStatusNotDetermined:
      return 'Denied'
    default:
      // iOS prompts once. Denied and Restricted both require the Settings app.
      return 'DeniedPermanently'
  }
}

const classifyPermission = (): PermissionResult => classify(manager.authorizationStatus)

const requestPermission = (signal: RuntimeAbortSignal): Promise<PermissionResult> =>
  new Promise((resolve, reject) => {
    signal.throwIfAborted()
    if (manager.authorizationStatus !== CLAuthorizationStatus.kCLAuthorizationStatusNotDetermined) {
      resolve(classifyPermission())
      return
    }

    let finished = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    const cleanUp = (): void => {
      if (timeout !== undefined) clearTimeout(timeout)
      delegate.authorizationObserver = undefined
      signal.removeEventListener('abort', onAbort)
    }
    const finish = (result: PermissionResult): void => {
      if (!finished) {
        finished = true
        cleanUp()
        resolve(result)
      }
    }
    const onAbort = (): void => {
      if (!finished) {
        finished = true
        cleanUp()
        reject(signal.reason)
      }
    }

    signal.addEventListener('abort', onAbort, { once: true })
    delegate.authorizationObserver = (status) => {
      if (status !== CLAuthorizationStatus.kCLAuthorizationStatusNotDetermined) {
        finish(classify(status))
      }
    }
    timeout = setTimeout(() => finish(classifyPermission()), timeoutMilliseconds)
    manager.requestWhenInUseAuthorization()
  })

const locationResult = (location: CLLocation): LocationResult => ({
  _tag: 'Located',
  fix: {
    latitude: location.coordinate.latitude,
    longitude: location.coordinate.longitude,
    accuracyMeters: location.horizontalAccuracy,
    capturedAtMilliseconds: location.timestamp.getTime(),
    provider: 'corelocation',
  },
})

const readCurrentLocation = (signal: RuntimeAbortSignal): Promise<LocationResult> =>
  new Promise((resolve, reject) => {
    signal.throwIfAborted()
    if (classifyPermission() !== 'Granted') {
      resolve({ _tag: 'Failed', reason: 'PermissionDenied' })
      return
    }
    if (!CLLocationManager.locationServicesEnabled()) {
      resolve({ _tag: 'Failed', reason: 'ServicesDisabled' })
      return
    }

    let finished = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    const cleanUp = (): void => {
      if (timeout !== undefined) clearTimeout(timeout)
      delegate.locationObserver = undefined
      signal.removeEventListener('abort', onAbort)
    }
    const finish = (result: LocationResult): void => {
      if (!finished) {
        finished = true
        cleanUp()
        resolve(result)
      }
    }
    const onAbort = (): void => {
      if (!finished) {
        finished = true
        cleanUp()
        manager.stopUpdatingLocation()
        reject(signal.reason)
      }
    }

    signal.addEventListener('abort', onAbort, { once: true })
    delegate.locationObserver = {
      onLocation: (location) => finish(locationResult(location)),
      onFailure: () => finish({ _tag: 'Failed', reason: 'NativeFailure' }),
    }
    timeout = setTimeout(() => finish({ _tag: 'Failed', reason: 'TimedOut' }), timeoutMilliseconds)
    manager.requestLocation()
  })

export const createPlatformLocationCapability = (): LocationCapability => ({
  checkPermission: async (signal) => {
    signal.throwIfAborted()
    return classifyPermission()
  },
  requestPermission,
  readCurrentLocation,
})

export const openApplicationSettings = (): void => {
  const url = NSURL.URLWithString(UIApplicationOpenSettingsURLString)
  UIApplication.sharedApplication.openURLOptionsCompletionHandler(
    url,
    NSDictionary.dictionary() as NSDictionary<string, unknown>,
    () => undefined,
  )
}
