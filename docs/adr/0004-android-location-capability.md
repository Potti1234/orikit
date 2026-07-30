# ADR-0004: use a portable location Program with a narrow Android boundary

Date: 2026-07-30  
Status: accepted

## Decision

OriKit's first production-style device capability is one-shot location.
Permission, lifecycle, success, and failure are represented by portable
serializable values in `@orikit/location`. Android objects never enter the
Model, Message, Command, history, or evidence records.

NativeScript TypeScript calls Android's permission and `LocationManager` APIs
directly. A small Kotlin class performs only the platform-specific permanent
denial classification. Its boundary has an explicit TypeScript declaration.

An active read is cancelled when the app enters the background. The runtime
then replaces its branch, so a callback arriving after cancellation is
quarantined and cannot mutate the current Model.

## Consequences

- The portable Program and deterministic fake run under Node without Android.
- Android permission outcomes include denied and denied permanently.
- Location failures include disabled services, timeout, interruption, and
  unexpected native failure without throwing native objects into state.
- Continuous location remains deferred to the Subscriptions phase.
- iOS will implement the same capability contract later with an iOS host.
