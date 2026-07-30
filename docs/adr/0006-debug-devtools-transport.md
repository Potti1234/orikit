# ADR-0006: use a paired loopback relay for debug DevTools

Date: 2026-07-30  
Status: accepted

## Context

Phase 7 must inspect a physical Android runtime from a Windows browser without
opening a listener on the phone or making native sockets part of the Program
Model. Historical rendering must retain Foldkit's semantics: the live runtime
continues processing while the visible model is pinned, application dispatch
is disabled in that view, and resume returns to the live head.

## Decision

Use a versioned JSON protocol shared by the runtime, relay, and browser
inspector. In debug builds Android is a WebSocket client to a relay bound only
to `127.0.0.1` on Windows. `adb reverse` exposes that loopback relay to a USB
device. The browser is a second client and pairs with a fresh six-digit code
shown by the app.

History is bounded by event count and approximate serialized bytes. Periodic
full snapshots permit deterministic reconstruction without running Commands.
Configured model, Message, and Command paths are redacted before any export or
transport, and exported fingerprints use a separate `redacted-v1` namespace.

Only travel and resume mutate inspector presentation state. Native sockets,
callbacks, pairing state, and connection lifecycle remain outside the Program
Model and history. The client is guarded by NativeScript's debug constant, so
release execution creates no DevTools connection.

## Consequences

- The phone exposes no network listener and the development relay is reachable
  only from the Windows host.
- Runtime replacement invalidates prior sessions and disconnects inspectors.
- Historical native rendering is explicit and cannot dispatch stale UI input.
- Import/export can inspect redacted archives offline.
- Resource lifecycle entries remain empty until Phase 8 introduces managed
  subscriptions.

## Verification

Protocol, history, redaction, relay authorization, text-frame forwarding, and
travel semantics are covered by portable tests. The physical-device verifier
checks pairing, transport redaction, travel, and resume over USB.
