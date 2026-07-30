# Phase 5 native location capability

Date: 2026-07-30

## Outcome

Phase 5 adds `@orikit/location`, a portable Elm-style Program for Android
location permission and a one-shot current-location request. The NativeScript
host renders the state with native controls and interprets three Commands:

```text
CheckLocationPermission
RequestLocationPermission
ReadCurrentLocation
```

Their terminal results return as typed Messages. The portable Model contains
only permission state, lifecycle state, plain numeric location data, and
closed failure values.

## Boundary and lifecycle evidence

- Android permission callbacks are converted to `PermissionResolved`.
- A narrow Kotlin classifier distinguishes denied from denied permanently.
- `LocationManager.requestSingleUpdate` is removed on completion, timeout, or
  cancellation.
- Entering the background commits `Interrupted`, cancels active work, and
  replaces the runtime branch to quarantine late callbacks.
- Returning to the foreground rechecks permission rather than trusting stale
  host state.
- A deterministic fake covers portable tests without a device.

## Verification

Passed locally:

```text
pnpm --filter @orikit/location typecheck
pnpm --filter @orikit/location test
pnpm --filter @orikit/mobile-spike typecheck
pnpm verify:portable:imports
pnpm --filter @orikit/mobile-spike android:build
```

The portable suite contains eight location tests, including explicit denial,
permanent denial, lifecycle interruption, permission recheck, and a late
callback quarantined after branch replacement.

The generated debug APK was installed successfully on the connected physical
Samsung SM-G781B running Android 13. The device displayed real native buttons,
requested Android location permission, returned to the foreground with
`Granted`, started a one-shot read, and settled to the typed `TimedOut` failure
when no indoor fix arrived within 15 seconds. Log evidence contained
`ORIKIT_LOCATION_STATE` and settled `ORIKIT_LOCATION_READY` records with no
native Android objects.

No iOS verification was performed because this Windows host has no Xcode.
