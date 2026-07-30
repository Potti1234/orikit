import {
  defineCommandContract,
  defineProgram,
  type Transition,
  tagged,
  transition,
} from '@orikit/spike-core'
import { Schema } from 'effect'

const Unknown = Schema.TaggedStruct('Unknown', {})
const Checking = Schema.TaggedStruct('Checking', {})
const Requesting = Schema.TaggedStruct('Requesting', {})
const Granted = Schema.TaggedStruct('Granted', {})
const Denied = Schema.TaggedStruct('Denied', {})
const DeniedPermanently = Schema.TaggedStruct('DeniedPermanently', {})

export const LocationPermission = Schema.Union([
  Unknown,
  Checking,
  Requesting,
  Granted,
  Denied,
  DeniedPermanently,
])
export type LocationPermission = typeof LocationPermission.Type

export const LocationFix = Schema.Struct({
  latitude: Schema.Number,
  longitude: Schema.Number,
  accuracyMeters: Schema.Number,
  capturedAtMilliseconds: Schema.Number,
  provider: Schema.String,
})
export type LocationFix = typeof LocationFix.Type

export const LocationFailure = Schema.Union([
  Schema.Literal('PermissionDenied'),
  Schema.Literal('PermissionDeniedPermanently'),
  Schema.Literal('ServicesDisabled'),
  Schema.Literal('Unavailable'),
  Schema.Literal('TimedOut'),
  Schema.Literal('Interrupted'),
  Schema.Literal('NativeFailure'),
])
export type LocationFailure = typeof LocationFailure.Type

const LocationIdle = Schema.TaggedStruct('Idle', {})
const Locating = Schema.TaggedStruct('Locating', {})
const LocationAvailable = Schema.TaggedStruct('Available', { fix: LocationFix })
const LocationFailed = Schema.TaggedStruct('Failed', { reason: LocationFailure })

export const LocationModel = Schema.Struct({
  permission: LocationPermission,
  location: Schema.Union([LocationIdle, Locating, LocationAvailable, LocationFailed]),
  lifecycle: Schema.Union([Schema.Literal('Active'), Schema.Literal('Background')]),
})
export type LocationModel = typeof LocationModel.Type

export const LocationFlags = Schema.Struct({})
export type LocationFlags = typeof LocationFlags.Type

const PermissionRequestRequested = Schema.TaggedStruct('PermissionRequestRequested', {})
const LocationRequested = Schema.TaggedStruct('LocationRequested', {})
export const PermissionResolved = Schema.TaggedStruct('PermissionResolved', {
  permission: Schema.Union([
    Schema.Literal('Granted'),
    Schema.Literal('Denied'),
    Schema.Literal('DeniedPermanently'),
  ]),
})
export type PermissionResolved = typeof PermissionResolved.Type
export const LocationResolved = Schema.TaggedStruct('LocationResolved', { fix: LocationFix })
export type LocationResolved = typeof LocationResolved.Type
export const LocationReadFailed = Schema.TaggedStruct('LocationReadFailed', {
  reason: LocationFailure,
})
export type LocationReadFailed = typeof LocationReadFailed.Type
const EnteredBackground = Schema.TaggedStruct('EnteredBackground', {})
const ReturnedForeground = Schema.TaggedStruct('ReturnedForeground', {})

export const LocationMessage = Schema.Union([
  PermissionRequestRequested,
  LocationRequested,
  PermissionResolved,
  LocationResolved,
  LocationReadFailed,
  EnteredBackground,
  ReturnedForeground,
])
export type LocationMessage = typeof LocationMessage.Type

export const CheckLocationPermission = Schema.TaggedStruct('CheckLocationPermission', {})
export type CheckLocationPermission = typeof CheckLocationPermission.Type
export const RequestLocationPermission = Schema.TaggedStruct('RequestLocationPermission', {})
export type RequestLocationPermission = typeof RequestLocationPermission.Type
export const ReadCurrentLocation = Schema.TaggedStruct('ReadCurrentLocation', {})
export type ReadCurrentLocation = typeof ReadCurrentLocation.Type

export const LocationCommand = Schema.Union([
  CheckLocationPermission,
  RequestLocationPermission,
  ReadCurrentLocation,
])
export type LocationCommand = typeof LocationCommand.Type

export const permissionRequestRequested = (): LocationMessage =>
  tagged('PermissionRequestRequested')
export const locationRequested = (): LocationMessage => tagged('LocationRequested')
export const permissionResolved = (
  permission: PermissionResolved['permission'],
): PermissionResolved => tagged('PermissionResolved', { permission })
export const locationResolved = (fix: LocationFix): LocationResolved =>
  tagged('LocationResolved', { fix })
export const locationReadFailed = (reason: LocationFailure): LocationReadFailed =>
  tagged('LocationReadFailed', { reason })
export const enteredBackground = (): LocationMessage => tagged('EnteredBackground')
export const returnedForeground = (): LocationMessage => tagged('ReturnedForeground')

const checkPermission = (): CheckLocationPermission => tagged('CheckLocationPermission')
const requestPermission = (): RequestLocationPermission => tagged('RequestLocationPermission')
const readLocation = (): ReadCurrentLocation => tagged('ReadCurrentLocation')

export const initialLocationModel = (): LocationModel => ({
  permission: { _tag: 'Checking' },
  location: { _tag: 'Idle' },
  lifecycle: 'Active',
})

const unchanged = (model: LocationModel): Transition<LocationModel, LocationCommand> =>
  transition(model)

export const updateLocation = (
  model: LocationModel,
  message: LocationMessage,
): Transition<LocationModel, LocationCommand> => {
  switch (message._tag) {
    case 'PermissionRequestRequested':
      return model.lifecycle === 'Background' || model.permission._tag === 'Requesting'
        ? unchanged(model)
        : transition({ ...model, permission: { _tag: 'Requesting' } }, requestPermission())
    case 'PermissionResolved':
      return unchanged({
        ...model,
        permission: { _tag: message.permission },
        location:
          message.permission === 'Granted'
            ? model.location._tag === 'Failed' &&
              (model.location.reason === 'PermissionDenied' ||
                model.location.reason === 'PermissionDeniedPermanently')
              ? { _tag: 'Idle' }
              : model.location
            : {
                _tag: 'Failed',
                reason:
                  message.permission === 'DeniedPermanently'
                    ? 'PermissionDeniedPermanently'
                    : 'PermissionDenied',
              },
      })
    case 'LocationRequested':
      return model.lifecycle === 'Active' && model.permission._tag === 'Granted'
        ? transition({ ...model, location: { _tag: 'Locating' } }, readLocation())
        : unchanged(model)
    case 'LocationResolved':
      return model.lifecycle === 'Active' && model.location._tag === 'Locating'
        ? unchanged({ ...model, location: { _tag: 'Available', fix: message.fix } })
        : unchanged(model)
    case 'LocationReadFailed':
      return model.location._tag === 'Locating'
        ? unchanged({ ...model, location: { _tag: 'Failed', reason: message.reason } })
        : unchanged(model)
    case 'EnteredBackground':
      return unchanged({
        ...model,
        lifecycle: 'Background',
        location:
          model.location._tag === 'Locating'
            ? { _tag: 'Failed', reason: 'Interrupted' }
            : model.location,
      })
    case 'ReturnedForeground':
      return transition(
        { ...model, lifecycle: 'Active', permission: { _tag: 'Checking' } },
        checkPermission(),
      )
  }
}

export const locationProgram = defineProgram<
  LocationFlags,
  LocationModel,
  LocationMessage,
  LocationCommand
>({
  identity: { name: 'location', schemaVersion: 1, buildVersion: '0.0.0-phase5' },
  Flags: LocationFlags,
  Model: LocationModel,
  Message: LocationMessage,
  Command: LocationCommand,
  commandContract: defineCommandContract<LocationCommand, LocationMessage>({
    CheckLocationPermission: ['PermissionResolved'],
    RequestLocationPermission: ['PermissionResolved'],
    ReadCurrentLocation: ['LocationResolved', 'LocationReadFailed'],
  }),
  init: () => transition(initialLocationModel(), checkPermission()),
  update: updateLocation,
})
