import {
  Application,
  type Button,
  type EventData,
  type Label,
  type NavigatedData,
  type Page,
} from '@nativescript/core'
import {
  createLocationApplication,
  type LocationApplication,
  type LocationModel,
  locationRequested,
  permissionRequestRequested,
} from '@orikit/location'

import { createAndroidLocationCapability } from './location-capability.android'

let application: LocationApplication | undefined
let unsubscribe: (() => void) | undefined
let page: Page | undefined
let lifecycleAttached = false

const requireView = <ViewType>(id: string): ViewType => {
  const match = page?.getViewById(id)
  if (match === undefined) {
    throw new Error(`Missing native location view #${id}`)
  }
  return match as ViewType
}

const permissionText = (model: LocationModel): string => {
  switch (model.permission._tag) {
    case 'Unknown':
      return 'Unknown'
    case 'Checking':
      return 'Checking Android permission…'
    case 'Requesting':
      return 'Waiting for your choice…'
    case 'Granted':
      return 'Granted'
    case 'Denied':
      return 'Not granted yet'
    case 'DeniedPermanently':
      return 'Blocked — enable it in app settings'
  }
}

const locationText = (model: LocationModel): string => {
  switch (model.location._tag) {
    case 'Idle':
      return 'Not requested'
    case 'Locating':
      return 'Waiting for one Android location fix…'
    case 'Available':
      return `${model.location.fix.latitude.toFixed(5)}, ${model.location.fix.longitude.toFixed(5)} · ±${Math.round(model.location.fix.accuracyMeters)} m`
    case 'Failed':
      return `Unavailable: ${model.location.reason}`
  }
}

const render = (model: LocationModel): void => {
  requireView<Label>('permissionStatus').text = permissionText(model)
  requireView<Label>('locationStatus').text = locationText(model)
  requireView<Label>('lifecycleStatus').text = `Lifecycle: ${model.lifecycle}`
  requireView<Button>('permissionButton').visibility =
    model.permission._tag === 'Granted' ? 'collapsed' : 'visible'
  requireView<Button>('locateButton').isEnabled =
    model.permission._tag === 'Granted' && model.location._tag !== 'Locating'
  requireView<Button>('settingsButton').visibility =
    model.permission._tag === 'DeniedPermanently' ? 'visible' : 'collapsed'

  console.log(`ORIKIT_LOCATION_STATE:${JSON.stringify(model)}`)
  if (
    model.permission._tag !== 'Checking' &&
    model.permission._tag !== 'Requesting' &&
    model.location._tag !== 'Locating'
  ) {
    console.log(
      `ORIKIT_LOCATION_READY:${JSON.stringify({
        permission: model.permission._tag,
        location: model.location._tag,
        lifecycle: model.lifecycle,
      })}`,
    )
  }
}

const onSuspend = (): void => {
  void application?.enterBackground()
}

const onResume = (): void => application?.returnForeground()

const attachLifecycle = (): void => {
  if (!lifecycleAttached) {
    lifecycleAttached = true
    Application.on(Application.suspendEvent, onSuspend)
    Application.on(Application.resumeEvent, onResume)
  }
}

const detachLifecycle = (): void => {
  if (lifecycleAttached) {
    lifecycleAttached = false
    Application.off(Application.suspendEvent, onSuspend)
    Application.off(Application.resumeEvent, onResume)
  }
}

export function onNavigatingTo(args: NavigatedData): void {
  onUnloaded()
  page = args.object as Page
  application = createLocationApplication(createAndroidLocationCapability())
  application.reportLifecycle('Launched')
  application.reportLifecycle('BecameActive')
  attachLifecycle()
  unsubscribe = application.subscribe(render)
}

export function onRequestPermission(_args: EventData): void {
  application?.dispatch(permissionRequestRequested())
}

export function onReadLocation(_args: EventData): void {
  application?.dispatch(locationRequested())
}

export function onOpenSettings(_args: EventData): void {
  const intent = new android.content.Intent(
    android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
  )
  intent.setData(android.net.Uri.parse(`package:${Application.android.packageName}`))
  activity().startActivity(intent)
}

const activity = (): android.app.Activity => {
  const current = Application.android.foregroundActivity ?? Application.android.startActivity
  if (current === undefined || current === null) {
    throw new Error('No foreground Android activity is available')
  }
  return current
}

export function onUnloaded(): void {
  detachLifecycle()
  unsubscribe?.()
  application?.dispose()
  unsubscribe = undefined
  application = undefined
  page = undefined
}
