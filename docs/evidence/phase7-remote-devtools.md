# Phase 7 remote DevTools

Date: 2026-07-30

## Outcome

Phase 7 adds canonical runtime history, bounded snapshots, pre-transport
redaction, a versioned protocol, a paired loopback relay, a browser inspector,
and native Android travel/resume integration.

The inspector displays Messages, Models, path-level model diffs, Commands, and
the currently empty managed-resource set. It can export redacted history and
open an archive without a connected device. Double-clicking a timeline entry
re-renders the native Todo screen from that historical model while the live
head stays visible in the status bar; resume restores the live model.

## Security boundary

- The relay binds `127.0.0.1`, accepts one runtime, and requires its six-digit
  pairing code for inspector connections.
- Android connects outward through `adb reverse`; it never listens for network
  connections.
- Runtime state is redacted before it is placed in a relay envelope.
- Debug payloads are capped at 2 MiB.
- `connectTodoDevtools` returns before constructing a client when `__DEV__` is
  false, leaving release builds with no active inspector connection.

## Automated evidence

`pnpm verify:portable` covers protocol parsing, deterministic canonical JSON,
count/byte history bounds, replay, travel while live processing continues,
resume, redaction without source mutation, and relay pairing/forwarding.

`pnpm verify:inspector`, `pnpm verify:web`, `pnpm evidence:renderer`, and
`pnpm verify:docs` cover both browser builds and prior renderer/documentation
gates. The Android debug build validates the Kotlin transport compilation.

A locally signed release APK also built successfully. Its optimized production
bundle contains neither the relay path, pairing marker, nor debug-client
constructor, confirming that the `__DEV__` guard is eliminated rather than
leaving an inactive endpoint at runtime. The disposable test signing key was
deleted after this check.

## Physical Android evidence

The remote verifier passed against a Samsung SM-G781B running Android 13. The
runtime appeared over USB with session and live-sequence metadata. A configured
sensitive Todo draft did not occur in any received envelope. Traveling to event
0 returned a `Traveling` runtime state and resume returned `Live` while the
runtime remained healthy.

Development workflow:

```text
pnpm devtools:relay
adb reverse tcp:4317 tcp:4317
pnpm --filter @orikit/mobile-spike exec ns run android --no-hmr --pnpm
pnpm --filter @orikit/inspector dev
```

The app's six-digit code is entered in the inspector at its local Vite URL.

## Deferred

Managed subscription/resource lifecycle records belong to Phase 8. iOS remains
unverified until the macOS/Xcode phase.
