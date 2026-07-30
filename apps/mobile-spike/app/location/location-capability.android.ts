import { type AndroidActivityRequestPermissionsEventData, Application } from '@nativescript/core'
import type { LocationCapability, LocationResult, PermissionResult } from '@orikit/location'
import type { RuntimeAbortSignal } from '@orikit/runtime'

const fineLocationPermission = android.Manifest.permission.ACCESS_FINE_LOCATION
const requestCode = 4815
const timeoutMilliseconds = 15_000
let requestedBefore = false

const activity = (): android.app.Activity => {
  const current = Application.android.foregroundActivity ?? Application.android.startActivity
  if (current === undefined || current === null) {
    throw new Error('No foreground Android activity is available')
  }
  return current
}

const classifyPermission = (): PermissionResult => {
  const result = new dev.orikit.device.LocationPermissionClassifier().classify(
    activity(),
    fineLocationPermission,
    requestedBefore,
  )
  switch (result) {
    case 'Granted':
    case 'Denied':
    case 'DeniedPermanently':
      return result
    default:
      throw new Error(`Unexpected permission classification: ${result}`)
  }
}

const requestPermission = (signal: RuntimeAbortSignal): Promise<PermissionResult> =>
  new Promise((resolve, reject) => {
    signal.throwIfAborted()
    const currentActivity = activity()
    let finished = false

    const cleanUp = (): void => {
      Application.android.off(
        Application.android.activityRequestPermissionsEvent,
        onPermissionResult,
      )
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
    const onPermissionResult = (event: AndroidActivityRequestPermissionsEventData): void => {
      if (event.requestCode === requestCode) {
        finish(classifyPermission())
      }
    }

    Application.android.on(Application.android.activityRequestPermissionsEvent, onPermissionResult)
    signal.addEventListener('abort', onAbort, { once: true })
    requestedBefore = true
    currentActivity.requestPermissions([fineLocationPermission], requestCode)
  })

const locationResult = (location: android.location.Location): LocationResult => ({
  _tag: 'Located',
  fix: {
    latitude: location.getLatitude(),
    longitude: location.getLongitude(),
    accuracyMeters: location.getAccuracy(),
    capturedAtMilliseconds: location.getTime(),
    provider: location.getProvider() ?? 'unknown',
  },
})

const readCurrentLocation = (signal: RuntimeAbortSignal): Promise<LocationResult> =>
  new Promise((resolve, reject) => {
    signal.throwIfAborted()
    if (classifyPermission() !== 'Granted') {
      resolve({ _tag: 'Failed', reason: 'PermissionDenied' })
      return
    }

    const manager = activity().getSystemService(
      android.content.Context.LOCATION_SERVICE,
    ) as android.location.LocationManager
    const gpsEnabled = manager.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER)
    const networkEnabled = manager.isProviderEnabled(
      android.location.LocationManager.NETWORK_PROVIDER,
    )
    const provider = gpsEnabled
      ? android.location.LocationManager.GPS_PROVIDER
      : networkEnabled
        ? android.location.LocationManager.NETWORK_PROVIDER
        : undefined
    if (provider === undefined) {
      resolve({ _tag: 'Failed', reason: 'ServicesDisabled' })
      return
    }

    let finished = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    const listener = new android.location.LocationListener({
      onLocationChanged: (value) => {
        if (value instanceof android.location.Location) {
          finish(locationResult(value))
        }
      },
      onFlushComplete: () => undefined,
      onProviderDisabled: () => finish({ _tag: 'Failed', reason: 'ServicesDisabled' }),
      onProviderEnabled: () => undefined,
      onStatusChanged: () => undefined,
    })
    const cleanUp = (): void => {
      if (timeout !== undefined) {
        clearTimeout(timeout)
      }
      manager.removeUpdates(listener)
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
        reject(signal.reason)
      }
    }

    signal.addEventListener('abort', onAbort, { once: true })
    timeout = setTimeout(() => finish({ _tag: 'Failed', reason: 'TimedOut' }), timeoutMilliseconds)
    manager.requestSingleUpdate(provider, listener, android.os.Looper.getMainLooper())
  })

export const createAndroidLocationCapability = (): LocationCapability => ({
  checkPermission: async (signal) => {
    signal.throwIfAborted()
    return classifyPermission()
  },
  requestPermission,
  readCurrentLocation,
})
